import { describe, expect, it } from 'vitest';
import { computeReturn, computeScenario, scheduleB1116 } from './compute';
import type { ReturnInput } from './model';

// Expected values below were worked out by hand from the 2025 forms and
// instructions (Form 1040, QDCG Worksheet, Form 1116, Schedule 8812). The
// arithmetic for each is written out in comments so it can be re-checked.

const base = (over: Partial<ReturnInput>): ReturnInput => ({
  year: 2025,
  filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
  dependents: [],
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  slips: [],
  assessments: [],
  elections: { feie: 'auto', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  ...over,
});

describe('single employee in Toronto with bank interest and dividends (2025)', () => {
  const input = base({
    slips: [
      { id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 100000, '16': 4034, '18': 1077, '22': 22000 } },
      { id: 't5', type: 'T5', owner: 'taxpayer', payer: 'RBC', boxes: { '13': 1000, '24': 2000, '25': 2760, '26': 414 },
        answers: { dividendSource: 'company', metHoldingPeriod: true } },
    ],
    assessments: [{ owner: 'taxpayer', totalIncome: 103760, netIncome: 103760, netFederalTax: 13000, provincialTax: 7000 }],
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  });
  const r = computeReturn(input).best;

  it('converts and places income on the right lines', () => {
    // 100000/1.398 = 71530.76; 1000/1.398 = 715.31; 2000/1.398 = 1430.62
    expect(r.f1040['1h']).toBe(71531);
    expect(r.f1040['2b']).toBe(715);
    expect(r.f1040['3b']).toBe(1431);
    expect(r.f1040['3a']).toBe(1431);
    expect(r.f1040['9']).toBe(73677);
    expect(r.f1040['11a']).toBe(73677);
    expect(r.f1040['12e']).toBe(15750);
    expect(r.f1040['15']).toBe(57927);
  });

  it('computes line 16 with the QDCG worksheet', () => {
    // L22 tax on 56,496 (table row 56,450-56,500) = 7,339; L18 = 1,431 x 15% = 215; L23 = 7,554 < L24 7,658
    expect(r.line16.method).toBe('qdcg');
    expect(r.f1040['16']).toBe(7554);
  });

  it('computes Form 1116 for each category', () => {
    const passive = r.f1116.find((f) => f.category === 'passive')!.lines;
    const general = r.f1116.find((f) => f.category === 'general')!.lines;
    // Passive: 1a 2,146; 3f 0.0291; 3g 458; 7 1,688; tax 20,000 x 3,760/103,760 = 724.75 CAD = 518 USD; 19 0.0291; 21 = 7,554 x 0.0291 = 220
    expect(passive['1a']).toBe(2146);
    expect(passive['3f']).toBe(0.0291);
    expect(passive['3g']).toBe(458);
    expect(passive['7']).toBe(1688);
    expect(passive['9']).toBe(518);
    expect(passive['21']).toBe(220);
    expect(passive['24']).toBe(220);
    // General: 1a 71,531; 3f 0.9709; 3g 15,292; 7 56,239; tax 19,275.25 CAD = 13,788 USD; 21 = 7,554 x 0.9709 = 7,334
    expect(general['1a']).toBe(71531);
    expect(general['3g']).toBe(15292);
    expect(general['7']).toBe(56239);
    expect(general['9']).toBe(13788);
    expect(general['24']).toBe(7334);
    expect(r.schedule3['1']).toBe(7554);
  });

  it('ends with zero US tax and no balance due', () => {
    expect(r.f1040['22']).toBe(0);
    expect(r.f1040['24']).toBe(0);
    expect(r.refund).toBe(0);
  });

  it('never uses T4 box 22 withholding as a payment', () => {
    expect(r.f1040['25d']).toBe(0);
  });
});

describe('married couple, two kids with SSNs, one Canadian salary (2025)', () => {
  const kid = (name: string, dob: string) => ({ firstName: name, lastName: 'Lee', ssn: '111-22-3333', relationship: 'Son',
    dateOfBirth: dob, hasValidSsn: true, usPerson: true, livedWithYouOverHalfYear: true });
  const input = base({
    filingStatus: 'mfj',
    spouse: { firstName: 'Ana', lastName: 'Lee', ssn: '987-65-4321', dateOfBirth: '1986-02-02' },
    dependents: [kid('Ben', '2015-03-03'), kid('Cal', '2018-07-07')],
    slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 80000 } }],
    assessments: [{ owner: 'taxpayer', totalIncome: 80000, netIncome: 80000, netFederalTax: 8000, provincialTax: 4000 }],
    feieFacts: { bonaFideResident: true, residenceStart: '2015-01-01', daysInUs: 5 },
  });
  const { best, alternative } = computeReturn(input);

  it('foreign tax credit wipes out US tax', () => {
    // AGI 57,225; std 31,500; TI 25,725 -> table MFJ row 25,700-25,750 = 2,610
    expect(best.f1040['11a']).toBe(57225);
    expect(best.f1040['16']).toBe(2610);
    expect(best.schedule3['1']).toBe(2610);
    expect(best.f1040['22']).toBe(0);
  });

  it('pays the refundable child tax credit (ACTC)', () => {
    // 12: 4,400; 13: 0 (FTC used the tax); 16a 4,400; 16b 2 x 1,700 = 3,400; 20 = (57,225-2,500) x 15% = 8,209; 27 = 3,400
    expect(best.schedule8812['12']).toBe(4400);
    expect(best.schedule8812['14']).toBe(0);
    expect(best.schedule8812['20']).toBe(8209);
    expect(best.schedule8812['27']).toBe(3400);
    expect(best.refund).toBe(3400);
  });

  it('auto-picks the foreign tax credit over the FEIE because FEIE blocks the ACTC', () => {
    expect(best.usedFeie).toBe(false);
    expect(alternative?.usedFeie).toBe(true);
    expect(alternative?.schedule8812['27'] ?? 0).toBe(0);
  });
});

describe('Foreign earned income exclusion scenario (2025)', () => {
  it('excludes wages up to $130,000 and disallows the related Canadian tax', () => {
    const input = base({
      slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 150000 } }],
      assessments: [{ owner: 'taxpayer', totalIncome: 150000, netIncome: 150000, netFederalTax: 24000, provincialTax: 14000 }],
      feieFacts: { bonaFideResident: true, residenceStart: '2015-01-01', daysInUs: 5 },
    });
    const r = computeScenario(input, true);
    // 150000/1.398 = 107,296.14 -> 107,296; exclusion 107,296 (under the 130,000 cap)
    expect(r.f2555[0].exclusion).toBe(107296);
    expect(r.schedule1['8d']).toBe(-107296);
    expect(r.f1040['11a']).toBe(0);
    expect(r.f1040['24']).toBe(0);
    const general = r.f1116.find((f) => f.category === 'general')!.lines;
    expect(general['12']).toBe(general['9']); // all wages excluded -> all wage tax disallowed
  });
});

describe('CPP/OAS', () => {
  const slips = [{ id: 'cpp', type: 'T4AP' as const, owner: 'taxpayer' as const, payer: 'Service Canada', boxes: { '20': 12000 } }];
  it('defaults to treaty-exempt with Form 8833', () => {
    const r = computeScenario(base({ slips }), false);
    expect(r.f1040['9']).toBe(0);
    expect(r.needsForm8833).toBe(true);
  });
  it('can be included instead', () => {
    const r = computeScenario(base({ slips, elections: { feie: 'no', canadianSocialSecurityExempt: false, useAdjustmentException: true } }), false);
    expect(r.schedule1['8z']).toBe(8584); // 12000/1.398 = 8,583.69
  });
});

describe('pension vs annuity categories (Form 1116)', () => {
  const items = (slips: ReturnInput['slips']) => computeScenario(base({ slips }), false).items;
  it('RRIF withdrawals are general category, on lines 5a/5b', () => {
    const [i] = items([{ id: 'r', type: 'T4RIF', owner: 'taxpayer', payer: 'TD', boxes: { '16': 20000 }, answers: { usBasisCad: 0 } }]);
    expect(i.category).toBe('general');
    expect(i.usLine).toBe('5b');
  });
  it('T4A annuities (box 024) are passive, pensions (016) general, with basis shared pro rata', () => {
    const it2 = items([{ id: 'a', type: 'T4A', owner: 'taxpayer', payer: 'Sun Life', boxes: { '016': 30000, '024': 10000 }, answers: { usBasisCad: 4000 } }]);
    const pension = it2.find((x) => x.box === '016')!;
    const annuity = it2.find((x) => x.box === '024')!;
    expect(pension.category).toBe('general');
    expect(annuity.category).toBe('passive');
    // basis 4,000 split 3,000 / 1,000: taxable CAD 27,000 and 9,000
    expect(pension.usd).toBeCloseTo(27000 / 1.398, 2);
    expect(annuity.usd).toBeCloseTo(9000 / 1.398, 2);
  });
  it('T4RSP annuity payments (box 16) are passive; withdrawals (22) general', () => {
    const it3 = items([{ id: 'b', type: 'T4RSP', owner: 'taxpayer', payer: 'RBC', boxes: { '16': 5000, '22': 15000 }, answers: { usBasisCad: 0 } }]);
    expect(it3.find((x) => x.box === '16')!.category).toBe('passive');
    expect(it3.find((x) => x.box === '22')!.category).toBe('general');
  });
});

describe('Schedule B (Form 1116) carryovers', () => {
  const L = (available: number, limit: number) => ({ '9': available, '12': 0, '13': 0, '23': limit });
  it('uses carryovers oldest first, up to the excess limitation (2025)', () => {
    // Excess limitation 600: 2015 (10th preceding) 200, then 2020 300, then 100 of 2024's 400.
    const s = scheduleB1116(2025, L(1000, 1600), new Map([[2015, 200], [2020, 300], [2024, 400]]));
    expect(s.cols[10]).toMatchObject({ l3: 200, l4: -200, l5: 0, l8: 0 });
    expect(s.cols[5]).toMatchObject({ l3: 300, l4: -300, l8: 0 });
    expect(s.cols[1]).toMatchObject({ l3: 400, l4: -100, l8: 300 });
    expect(s.cols[0].l6).toBe(0);
    expect(s.next).toEqual([{ year: 2024, amount: 300 }]);
  });
  it('expires the 10th preceding year and generates current excess when there is no room', () => {
    const s = scheduleB1116(2025, L(2000, 1500), new Map([[2015, 200], [2024, 400]]));
    expect(s.cols[10]).toMatchObject({ l3: 200, l4: 0, l5: -200, l8: 0 });
    expect(s.cols[0]).toMatchObject({ l6: 500, l8: 500 });
    expect(s.next).toEqual([{ year: 2024, amount: 400 }, { year: 2025, amount: 500 }]);
  });
  it('carries back to the prior year first, up to its room, then forward (line 7 negative, line 8 the rest)', () => {
    // i1116sb line 6/7/8: excess foreign taxes 500, prior year room 150 -> line 7 = (150), line 8 = 350.
    const s = scheduleB1116(2025, L(2000, 1500), new Map(), 150);
    expect(s.cols[0]).toMatchObject({ l6: 500, l7: -150, l8: 350 });
    expect(s.next).toEqual([{ year: 2025, amount: 350 }]);
  });
  it('never carries back more than the excess or into a prior year with no room', () => {
    expect(scheduleB1116(2025, L(2000, 1500), new Map(), 9999).cols[0]).toMatchObject({ l7: -500, l8: 0 });
    expect(scheduleB1116(2025, L(2000, 1500), new Map(), 0).cols[0]).toMatchObject({ l7: 0, l8: 500 });
    // No excess foreign tax this year: nothing to carry back.
    expect(scheduleB1116(2025, L(1000, 1600), new Map(), 300).cols[0]).toMatchObject({ l6: 0, l7: 0, l8: 0 });
  });
  it('the Toronto return generates a 2025 carryover that matches Form 1116', () => {
    const r = computeReturn(base({
      slips: [
        { id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 100000 } },
        { id: 't5', type: 'T5', owner: 'taxpayer', payer: 'RBC', boxes: { '13': 1000, '24': 2000 }, answers: { dividendSource: 'company', metHoldingPeriod: true } },
      ],
      assessments: [{ owner: 'taxpayer', totalIncome: 103760, netIncome: 103760, netFederalTax: 13000, provincialTax: 7000 }],
      elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    })).best;
    const general = r.f1116.find((f) => f.category === 'general')!;
    expect(general.scheduleB?.cols[0].l6).toBe(13788 - 7334);
    expect(general.excessCredit).toBe(6454);
    expect(general.scheduleB?.next).toEqual([{ year: 2025, amount: 6454 }]);
  });
});
