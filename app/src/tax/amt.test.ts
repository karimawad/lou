import { describe, expect, it } from 'vitest';
import { amtPart3, amtRateTax, computeAmt, type AmtInput } from './amt';
import { computeReturn } from './compute';
import type { ReturnInput } from './model';
import { line16Tax } from './taxComputation';

// Expected values are worked out by hand from Form 6251 and its instructions
// (2023, 2024, 2025). The arithmetic is written out so it can be re-checked.

describe('26% / 28% rate (Form 6251 line 7 "All others", lines 18 and 39)', () => {
  it.each([
    [2025, 'single', 100000, 26000], // 100,000 x 26%
    [2025, 'single', 239100, 62166], // at the breakpoint: 239,100 x 26%
    [2025, 'single', 300000, 79218], // 300,000 x 28% - 4,782
    [2025, 'mfs', 150000, 39609], // over 119,550: 150,000 x 28% - 2,391
    [2024, 'mfj', 300000, 79348], // 300,000 x 28% - 4,652
    [2023, 'single', 220700, 57382], // 220,700 x 26%
    [2023, 'hoh', 250000, 65586], // 250,000 x 28% - 4,414
  ] as const)('%i %s %i', (year, status, amount, tax) => expect(amtRateTax(year, status, amount)).toBe(tax));
});

const synthetic = (over: Partial<AmtInput> & { f1040: Record<string, number> }): AmtInput => ({
  year: 2025, status: 'single', schedule1a: {}, schedule2: { '1z': 0 }, schedule3: { '1': 0 },
  line16: { tax: over.f1040['16'], method: 'tcw', worksheet: {} }, feieExcluded: 0, taxed: [], f1116: [],
  adjustmentException: false, ...over,
});

describe('Form 6251 Part I and II', () => {
  it('phases out the exemption above $626,350 (2025, single)', () => {
    // Line 4 = 700,001. Exemption Worksheet: 4) 700,001 - 626,350 = 73,651; 5) x 25% = 18,412.75 -> 18,413;
    // 6) 88,100 - 18,413 = 69,687. Line 6 = 630,314. Line 7 = 630,314 x 28% - 4,782 = 171,705.92 -> 171,706.
    const r = computeAmt(synthetic({ f1040: { '11a': 700001, '11b': 700001, '12e': 15750, '14': 15750, '15': 684251, '16': 200000, '3a': 0, '7a': 0 } }));
    expect(r.lines['1a']).toBe(15750);
    expect(r.lines['1b']).toBe(684251);
    expect(r.lines['4']).toBe(700001);
    expect(r.lines['5']).toBe(69687);
    expect(r.lines['6']).toBe(630314);
    expect(r.lines['7']).toBe(171706);
    // Line 10 = 200,000 regular tax, more than line 9: no AMT and no Form 6251 needed.
    expect(r.amt).toBe(0);
    expect(r.mustFile).toBe(false);
  });

  it('uses Form 1040 line 15 as line 1 for 2024 and 2023', () => {
    const r = computeAmt(synthetic({ year: 2024, f1040: { '11a': 150000, '11b': 150000, '12e': 14600, '14': 14600, '15': 135400, '16': 25000, '3a': 0, '7a': 0 } }));
    // Line 1 135,400 + line 2a 14,600 = 150,000; exemption 85,700; line 6 64,300; line 7 = 64,300 x 26% = 16,718.
    expect(r.lines['1']).toBe(135400);
    expect(r.lines['4']).toBe(150000);
    expect(r.lines['6']).toBe(64300);
    expect(r.lines['7']).toBe(16718);
  });

  it('adds the extra amount to line 4 for married filing separately above $900,350 (2025)', () => {
    // 920,350 -> 925,350 (the example in the line 4 instructions); exemption is then zero.
    const r = computeAmt(synthetic({ status: 'mfs', f1040: { '11a': 920350, '11b': 920350, '12e': 15750, '14': 15750, '15': 904600, '16': 300000, '3a': 0, '7a': 0 } }));
    expect(r.lines['4']).toBe(925350);
    expect(r.lines['5']).toBe(0);
  });

  it('is zero when AMTI is under the exemption', () => {
    const r = computeAmt(synthetic({ f1040: { '11a': 80000, '11b': 80000, '12e': 15750, '14': 15750, '15': 64250, '16': 9000, '3a': 0, '7a': 0 } }));
    expect(r.lines['6']).toBe(0);
    expect(r.lines['7']).toBe(0);
    expect(r.amt).toBe(0);
  });
});

describe('Form 6251 Part III (qualified dividends)', () => {
  it('2025 single: line 12 211,900, dividends 50,000, regular QDCG line 5 234,250', () => {
    const L = amtPart3(2025, 'single', 211900, 50000, 234250);
    // 16 = 50,000; 17 = 161,900; 18 = 161,900 x 26% = 42,094; 19 48,350; 20 234,250; 21 0; 22 50,000; 23 0; 24 50,000;
    // 25 533,400; 28 234,250; 29 299,150; 30 50,000; 31 7,500; 32 50,000; 33 0; 38 49,594; 39 = 211,900 x 26% = 55,094; 40 49,594.
    expect([L['16'], L['17'], L['18'], L['21'], L['23'], L['24'], L['29'], L['30'], L['31'], L['32'], L['33'], L['38'], L['39'], L['40']])
      .toEqual([50000, 161900, 42094, 0, 0, 50000, 299150, 50000, 7500, 50000, 0, 49594, 55094, 49594]);
  });

  it('puts dividends in the 0% band when ordinary income is low (2025 single)', () => {
    const L = amtPart3(2025, 'single', 100000, 60000, 40000);
    // 17 40,000; 18 10,400; 21 = 48,350 - 40,000 = 8,350; 22 60,000; 23 8,350; 24 51,650; 28 48,350; 29 485,050;
    // 30 51,650; 31 7,747.50 -> 7,748; 32 60,000; 33 0; 38 18,148; 39 26,000; 40 18,148.
    expect([L['18'], L['23'], L['30'], L['31'], L['38'], L['40']]).toEqual([10400, 8350, 51650, 7748, 18148, 18148]);
  });

  it('feeds line 7 from Part III', () => {
    const r = computeAmt(synthetic({
      f1040: { '11a': 300000, '11b': 300000, '12e': 15750, '14': 15750, '15': 284250, '16': 60000, '3a': 50000, '7a': 0 },
      line16: { tax: 60000, method: 'qdcg', worksheet: { 5: 234250 } },
    }));
    expect(r.lines['6']).toBe(211900);
    expect(r.lines['7']).toBe(49594);
  });
});

describe('Foreign Earned Income Tax Worksheet for line 7 (Form 2555 filers)', () => {
  it('stacks excluded wages under the AMT rates (2025 single, 300,000 wages, 130,000 excluded)', () => {
    const regular = line16Tax(2025, 'single', { taxableIncome: 154250, qualifiedDividends: 0, netCapitalGain: 0, feieExcluded: 130000 });
    const r = computeAmt(synthetic({
      f1040: { '11a': 170000, '11b': 170000, '12e': 15750, '14': 15750, '15': 154250, '16': regular.tax, '3a': 0, '7a': 0 },
      line16: regular, feieExcluded: 130000,
    }));
    // Line 6 = 170,000 - 88,100 = 81,900. Worksheet: 3) 81,900 + 130,000 = 211,900; 4) x 26% = 55,094;
    // 5) 130,000 x 26% = 33,800; 6) 21,294.
    expect(r.feitw).toEqual({ '1': 81900, '2a': 130000, '2b': 0, '2c': 130000, '3': 211900, '4': 55094, '5': 33800, '6': 21294 });
    expect(r.lines['7']).toBe(21294);
    expect(r.amt).toBe(0); // regular tax under the worksheet is higher
  });
});

const person = { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' };
const input = (wagesCad: number, fed: number, prov: number): ReturnInput => ({
  year: 2025, filingStatus: 'single', taxpayer: person, dependents: [],
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': wagesCad } }],
  assessments: [{ owner: 'taxpayer', totalIncome: wagesCad, netIncome: wagesCad, netFederalTax: fed, provincialTax: prov }],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
});

describe('AMT inside a full return', () => {
  it('a typical Toronto salary is under the exemption', () => {
    const r = computeReturn(input(100000, 13000, 7000)).best;
    expect(r.f6251.lines['6']).toBe(0);
    expect(r.f6251.mustFile).toBe(false);
    expect(r.schedule2['2']).toBe(0);
  });

  it('a high salary: Canadian tax covers the AMT too, but Form 6251 must be attached', () => {
    // 400,000 / 1.398 = 286,123. AMTI 286,123; line 6 = 198,023; line 7 = x 26% = 51,485.98 -> 51,486.
    // Regular credit wipes out the regular tax, so line 10 = 0 < line 7 (Who Must File, statement 1).
    // AMT Form 1116 (general): 1a 286,123; line 18 = AMTI 286,123; ratio 1; line 21 51,486;
    // taxes available (70,000 + 45,000) / 1.398 = 82,260 -> credit 51,486. Line 9 = 0, AMT = 0.
    const r = computeReturn(input(400000, 70000, 45000)).best;
    const L = r.f6251.lines;
    expect(L['4']).toBe(286123);
    expect(L['6']).toBe(198023);
    expect(L['7']).toBe(51486);
    expect(L['10']).toBe(0);
    expect(r.f6251.f1116).toHaveLength(1);
    expect(r.f6251.f1116[0].lines['1a']).toBe(286123);
    expect(r.f6251.f1116[0].lines['14']).toBe(82260);
    expect(L['8']).toBe(51486);
    expect(L['11']).toBe(0);
    expect(r.f6251.mustFile).toBe(true);
    expect(r.f1040['17']).toBe(0);
  });

  it('low Canadian tax: AMT is the gap between tentative minimum tax and regular tax after credits', () => {
    // Same salary, Canadian tax only 20,000 CAD = 14,306 USD. Both credits are capped by that tax:
    // line 8 = 14,306 and Schedule 3 line 1 = 14,306. AMT = max(0, (51,486 - 14,306) - (regular - 14,306)) = 0
    // because regular tax on 270,373 is higher than 51,486.
    const r = computeReturn(input(400000, 12000, 8000)).best;
    expect(r.f6251.lines['8']).toBe(14306);
    expect(r.schedule3['1']).toBe(14306);
    expect(r.f6251.lines['11']).toBe(0);
  });
});

describe('AMT foreign tax credit carryover', () => {
  it('uses AMT carryovers on line 10 and tracks the AMT carryforward by year of origin', () => {
    const inp = { ...input(400000, 70000, 45000), carryover: { general: 0, passive: 0, amtVintages: [{ year: 2024, general: 5000, passive: 0 }] } };
    const r = computeReturn(inp).best;
    const F = r.f6251.f1116[0];
    // Line 10 5,000; line 14 = 82,260 + 5,000 = 87,260; line 24 = 51,486 (limit). Nothing old is used:
    // the current-year excess 82,260 - 51,486 = 30,774 is generated, and the 2024 amount carries on.
    expect(F.lines['10']).toBe(5000);
    expect(F.lines['14']).toBe(87260);
    expect(F.lines['24']).toBe(51486);
    expect(F.scheduleB?.next).toEqual([{ year: 2024, amount: 5000 }, { year: 2025, amount: 30774 }]);
    // The regular carryover is untouched.
    expect(r.f1116[0].lines['10']).toBe(0);
  });

  it('a year with no tentative minimum tax carries all of its Canadian tax forward for the AMT', () => {
    const r = computeReturn(input(100000, 13000, 7000)).best;
    // Line 6 is 0, so AMT Form 1116 line 20 is 0 and the whole 20,000 / 1.398 = 14,306 carries forward.
    expect(r.f6251.f1116[0].lines['24']).toBe(0);
    expect(r.f6251.f1116[0].scheduleB?.next).toEqual([{ year: 2025, amount: 14306 }]);
    expect(r.f6251.lines['8']).toBe(0);
  });
});
