import { describe, expect, it } from 'vitest';
import { allocateByYear, applyFilingException, computePfic, highestRate, interestFactor, section1291, type PficFund } from './pfic';
import { dailyRate } from './fx';

describe('IRC 6621 interest, compounded daily', () => {
  it('one year from April 15, 2025 to April 15, 2026: 350 days at 7%, then 15 days at 6% (Q2 2026)', () => {
    const f = interestFactor('2025-04-15', '2026-04-15')!;
    expect(f).toBeCloseTo((1 + 0.07 / 365) ** 350 * (1 + 0.06 / 365) ** 15, 12);
  });
  it('a full leap year at 8% (2024) matches the 366-day daily compounding rate', () => {
    expect(interestFactor('2023-12-31', '2024-12-31')! - 1).toBeCloseTo((1 + 0.08 / 366) ** 366 - 1, 12);
  });
  it('highest rates from the i8621 table', () => {
    expect([highestRate(2025), highestRate(2017), highestRate(2010), highestRate(2002), highestRate(1986)]).toEqual([0.37, 0.396, 0.35, 0.386, null]);
  });
});

describe('section 1291 allocation (Form 8621 line 16)', () => {
  it('spreads a gain over the holding period by day', () => {
    // Bought Dec 31, 2023; holding period Jan 1, 2024 - Dec 31, 2025 = 731 days.
    const m = allocateByYear(7310, '2023-12-31', '2025-12-31');
    expect(m.get(2024)).toBeCloseTo(3660, 6);
    expect(m.get(2025)).toBeCloseTo(3650, 6);
  });
  it('current-year part is ordinary income; earlier years get the top rate plus interest', () => {
    const r = section1291(2025, 7310, '2023-12-31', '2025-12-31');
    expect(r.ordinary).toBeCloseTo(3650, 6);
    expect(r.increase).toBeCloseTo(3660 * 0.37, 6);
    // Interest on 2024's increase runs from April 15, 2025 to April 15, 2026.
    expect(r.interest).toBeCloseTo(3660 * 0.37 * (interestFactor('2025-04-15', '2026-04-15')! - 1), 6);
  });
  it('foreign tax on an excess distribution reduces each year\'s increase, not below zero', () => {
    const r = section1291(2025, 7310, '2023-12-31', '2025-12-31', 2000);
    // 2024 share of the tax: 2,000 x 3,660 / 7,310 = 1,001.37; increase 1,354.20 -> 352.83.
    expect(r.rows[0].netIncrease).toBeCloseTo(3660 * 0.37 - 2000 * 3660 / 7310, 6);
  });
});

const fund = (over: Partial<PficFund>): PficFund => ({
  id: 'f', owner: 'taxpayer', name: 'Maple Balanced Fund', account: 'taxable', regime: '1291', acquired: '2020-06-01',
  sharesYearEnd: 1000, valueYearEndCad: 20000, distributions: [{ date: '2025-12-15', amountCad: 1000 }], priorDistributionsCad: [400, 400, 400], ...over,
});

describe('Form 8621 for a section 1291 fund', () => {
  it('splits distributions at 125% of the 3-year average (lines 15a-15e)', () => {
    const r = computePfic(2025, fund({}), [], 1.398);
    expect(r.lines['15b']).toBe(1200);
    expect(r.lines['15d']).toBe(500);
    expect(r.lines['15e1']).toBe(500);
    // Excess translated on the distribution date; non-excess (500 CAD) stays an ordinary dividend.
    expect(r.lines['15e2']).toBe(Math.round(500 / dailyRate('2025-12-15')!.rate));
    expect(r.items.find((i) => i.kind === 'dividend')!.usd).toBeCloseTo(500 / 1.398, 6);
    expect(r.deferredTax).toBeGreaterThan(0);
    expect(r.mustFile).toBe(true);
  });
  it('no excess distribution in the year the holding period began', () => {
    const r = computePfic(2025, fund({ acquired: '2025-02-01', priorDistributionsCad: [] }), [], 1.398);
    expect(r.lines['15e1']).toBeUndefined();
    expect(r.items.find((i) => i.kind === 'dividend')!.usd).toBeCloseTo(1000 / 1.398, 6);
  });
  it('a gain on sale is an excess distribution; a loss goes to Form 8949', () => {
    const gain = computePfic(2025, fund({ distributions: [] }), [{ date: '2025-09-02', acquired: '2020-06-01', shares: 1, proceedsCad: 15000, costCad: 10000 }], 1.398);
    expect(gain.lines['15f']).toBeGreaterThan(0);
    expect(gain.details).toHaveLength(1);
    const loss = computePfic(2025, fund({ distributions: [] }), [{ date: '2025-09-02', acquired: '2020-06-01', shares: 1, proceedsCad: 8000, costCad: 10000 }], 1.398);
    expect(loss.items[0].kind).toBe('capitalLoss');
    expect(loss.deferredTax).toBe(0);
  });
  it('$25,000 exception: small holdings with no excess distribution or gain need no Form 8621', () => {
    const r = [computePfic(2025, fund({ priorDistributionsCad: [1000, 1000, 1000] }), [], 1.398)];
    applyFilingException(r, false);
    expect(r[0].mustFile).toBe(false);
    const big = [computePfic(2025, fund({ valueYearEndCad: 40000, priorDistributionsCad: [1000, 1000, 1000] }), [], 1.398)];
    applyFilingException(big, false);
    expect(big[0].mustFile).toBe(true); // 40,000 / 1.3706 = 29,184 > 25,000
  });
  it('held in an RRSP: nothing to file', () => {
    expect(computePfic(2025, fund({ account: 'rrsp' }), [], 1.398).mustFile).toBe(false);
  });
});

describe('mark-to-market fund (Part IV)', () => {
  it('year-end value over adjusted basis is ordinary income', () => {
    const r = computePfic(2025, fund({ regime: 'mtm', distributions: [], valueYearEndCad: 15000, mtm: { firstYear: 2022, basisUsdStart: 10000, sharesStart: 1000, unreversedUsd: 500 } }), [], 1.398);
    const fmv = 15000 / dailyRate('2025-12-31')!.rate;
    expect(r.lines['10a']).toBe(Math.round(fmv));
    expect(r.lines['10c']).toBe(Math.round(fmv - 10000));
  });
  it('a decline is deductible only up to unreversed inclusions', () => {
    const r = computePfic(2025, fund({ regime: 'mtm', distributions: [], valueYearEndCad: 10000, mtm: { firstYear: 2022, basisUsdStart: 9000, sharesStart: 1000, unreversedUsd: 500 } }), [], 1.398);
    expect(r.lines['12']).toBe(500);
  });
  it('first election year for units held earlier is taxed under section 1291', () => {
    const r = computePfic(2025, fund({ regime: 'mtm', distributions: [], valueYearEndCad: 15000, mtm: { firstYear: 2025, basisUsdStart: 8000, sharesStart: 1000, unreversedUsd: 0 } }), [], 1.398);
    expect(r.details[0].label).toMatch(/First mark-to-market/);
    expect(r.lines['10c']).toBeUndefined();
  });
});
