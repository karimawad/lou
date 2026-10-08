import { describe, expect, it } from 'vitest';
import { carryoverToNextYear, isLongTerm, saleRow, scheduleD, type Form8949Row } from './capital';
import { computeReturn } from './compute';
import { dailyRate } from './fx';
import type { Flag, ReturnInput } from './model';

describe('holding period (more than one year = long-term)', () => {
  it.each([
    ['2024-01-01', '2025-01-01', false], ['2024-01-01', '2025-01-02', true], ['2024-02-29', '2025-02-28', false],
    ['2024-02-29', '2025-03-01', true], ['2025-03-01', '2025-11-30', false],
  ])('%s -> %s', (a, s, lt) => expect(isLongTerm(a, s)).toBe(lt));
});

describe('Form 8949 row', () => {
  it('converts cost on the purchase date and proceeds on the sale date (Bank of Canada)', () => {
    const flags: Flag[] = [];
    const row = saleRow({ id: 's', owner: 'taxpayer', description: '100 sh RY', acquired: '2020-03-16', sold: '2025-06-02', proceedsCad: 17500, costCad: 9800 }, flags)!;
    const a = dailyRate('2020-03-16')!.rate;
    const b = dailyRate('2025-06-02')!.rate;
    expect(row.basis).toBe(Math.round(9800 / a));
    expect(row.proceeds).toBe(Math.round(17500 / b));
    expect(row.longTerm).toBe(true);
    expect(flags).toEqual([]);
  });
  it('carries the digital asset flag onto the row', () => {
    const row = saleRow({ id: 's', owner: 'taxpayer', description: '0.5 BTC', acquired: '2024-01-10', sold: '2025-05-20', proceedsCad: 40000, costCad: 30000, digital: true }, [])!;
    expect(row.digital).toBe(true);
    expect(saleRow({ id: 's', owner: 'taxpayer', description: 'x', acquired: '2024-01-10', sold: '2025-05-20', proceedsCad: 1, costCad: 1 }, [])!.digital).toBeUndefined();
  });
  it('asks for a rate before 2007-05-01', () => {
    const flags: Flag[] = [];
    expect(saleRow({ id: 's', owner: 'taxpayer', description: 'old', acquired: '2005-01-10', sold: '2025-06-02', proceedsCad: 1, costCad: 1 }, flags)).toBeNull();
    expect(flags[0].severity).toBe('block');
  });
});

const row = (gain: number, longTerm: boolean): Form8949Row => ({ description: 'x', acquired: '2020-01-01', sold: '2025-06-01', proceeds: Math.max(gain, 0) + 1000, basis: 1000 - Math.min(gain, 0), gain, longTerm, owner: 'taxpayer' });

describe('Schedule D', () => {
  it('nets short and long term, applies the carryover and the $3,000 loss limit', () => {
    const d = scheduleD('single', [row(-5000, false), row(2000, true)], { shortTerm: 1000, longTerm: 0 }, 500);
    // 3h -5,000; 6 -1,000; 7 -6,000. 10h 2,000; 13 500; 15 2,500. 16 -3,500 -> 21 -3,000.
    expect([d.lines['3h'], d.lines['6'], d.lines['7'], d.lines['10h'], d.lines['13'], d.lines['15'], d.lines['16'], d.lines['21']])
      .toEqual([-5000, -1000, -6000, 2000, 500, 2500, -3500, -3000]);
    expect(d.line7).toBe(-3000);
    expect(d.qdcgLine3).toBe(0);
    // Carryover worksheet with taxable income 50,000: 2) 3,000; 4) 3,000; 5) 6,000; 6) 2,500 -> 8) 500 short-term.
    expect(carryoverToNextYear(d.lines, 50000)).toEqual({ shortTerm: 500, longTerm: 0 });
  });
  it('married filing separately limits the loss to $1,500', () => {
    expect(scheduleD('mfs', [row(-4000, true)], { shortTerm: 0, longTerm: 0 }, 0).line7).toBe(-1500);
  });
  it('net capital gain for the tax worksheet is the smaller of lines 15 and 16', () => {
    const d = scheduleD('single', [row(-1000, false), row(5000, true)], { shortTerm: 0, longTerm: 0 }, 0);
    expect(d.lines['16']).toBe(4000);
    expect(d.qdcgLine3).toBe(4000);
  });
  it('long-term carryover when line 15 is the loss', () => {
    const d = scheduleD('single', [row(-10000, true)], { shortTerm: 0, longTerm: 0 }, 0);
    // 9) 10,000; 10) 0; 11) 3,000 - 0 = 3,000 -> 13) 7,000.
    expect(carryoverToNextYear(d.lines, 40000)).toEqual({ shortTerm: 0, longTerm: 7000 });
  });
});

describe('sales inside a return', () => {
  const base: ReturnInput = {
    year: 2025, filingStatus: 'single',
    taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
    dependents: [], address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
    slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 100000 } }],
    assessments: [{ owner: 'taxpayer', totalIncome: 110000, netIncome: 110000, netFederalTax: 15000, provincialTax: 9000 }],
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    sales: [{ id: 's1', owner: 'taxpayer', description: '100 sh RY', acquired: '2020-03-16', sold: '2025-06-02', proceedsCad: 30000, costCad: 10000 }],
  };
  it('puts the gain on Schedule D and line 7, taxed at capital gain rates', () => {
    const r = computeReturn(base).best;
    const g = r.scheduleD!.lines['10h'];
    expect(g).toBeGreaterThan(0);
    expect(r.f1040['7a']).toBe(g);
    expect(r.netCapitalGain).toBe(g);
    expect(r.line16.method).toBe('qdcg');
  });
  it('a gain Canada taxes at 10%+ is foreign source (passive category)', () => {
    // Canadian tax 24,000 / 120,000 taxable (100,000 wages + half of the 20,000 gain) = 20% -> 10% on the whole gain.
    const r = computeReturn(base).best;
    expect(r.f1116.find((f) => f.category === 'passive')).toBeTruthy();
    expect(r.flags.some((f) => f.id === 'gain-us-source')).toBe(false);
  });
  it('a gain Canada taxes at under 10% is US source', () => {
    const r = computeReturn({ ...base, assessments: [{ ...base.assessments[0], netFederalTax: 8000, provincialTax: 3000 }] }).best;
    // 11,000 / 110,000 = 10% average x 50% inclusion = 5%.
    expect(r.flags.some((f) => f.id === 'gain-us-source')).toBe(true);
    expect(r.f1116.find((f) => f.category === 'passive')).toBeUndefined();
  });
});
