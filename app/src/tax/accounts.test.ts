import { describe, expect, it } from 'vitest';
import { analyzeAccounts, fbarType, type ForeignAccount } from './accounts';

const acct = (over: Partial<ForeignAccount>): ForeignAccount => ({
  id: Math.random().toString(36), owner: 'taxpayer', kind: 'bank', institution: 'RBC', street: '200 Bay St', city: 'Toronto',
  province: 'ON', postalCode: 'M5J 2J5', accountNumber: '1234567', maxValueCad: 0, yearEndValueCad: 0, opened: false, closed: false, ...over,
});

describe('FBAR', () => {
  it('converts at the Treasury Dec 31 rate and rounds up (2025: 1.369)', () => {
    // 20,000 / 1.369 = 14,609.20 -> 14,610
    const a = analyzeAccounts(2025, 'single', [acct({ maxValueCad: 20000 })]);
    expect(a.rows[0].fbarMaxUsd).toBe(14610);
    expect(a.fbar[0]).toEqual({ owner: 'taxpayer', aggregateMaxUsd: 14610, required: true });
  });
  it('is not required at US$10,000 or less in aggregate', () => {
    const a = analyzeAccounts(2025, 'single', [acct({ maxValueCad: 6000 }), acct({ maxValueCad: 7000, kind: 'tfsa' })]);
    // 4,383 + 5,114 = 9,497
    expect(a.fbar[0].required).toBe(false);
  });
  it('joint accounts count in full for each spouse; pension plans are not FBAR accounts', () => {
    const a = analyzeAccounts(2024, 'mfj', [acct({ owner: 'joint', maxValueCad: 15000 }), acct({ kind: 'pension', maxValueCad: 500000 })]);
    // 15,000 / 1.438 = 10,431.15 -> 10,432
    expect(a.fbar.map((f) => [f.owner, f.aggregateMaxUsd])).toEqual([['taxpayer', 10432], ['spouse', 10432]]);
  });
  it('a spouse with no US status is not told to file an FBAR', () => {
    const a = analyzeAccounts(2025, 'mfs', [acct({ owner: 'joint', maxValueCad: 50000 })], { spouseIsUsPerson: false });
    expect(a.fbar.map((f) => f.owner)).toEqual(['taxpayer']);
  });
  it('registered plans are "Other" with a description', () => {
    expect(fbarType('rrsp')).toEqual({ type: 'Other', other: 'RRSP (Registered Retirement Savings Plan)' });
    expect(fbarType('investment').type).toBe('Securities');
  });
});

describe('Form 8938 (living abroad thresholds)', () => {
  it('single: required above US$200,000 at year end', () => {
    // 280,000 / 1.369 = 204,529
    const a = analyzeAccounts(2025, 'single', [acct({ kind: 'rrsp', maxValueCad: 280000, yearEndValueCad: 280000 })]);
    expect(a.f8938.yearEndTotal).toBe(204529);
    expect(a.f8938.required).toBe(true);
    expect(a.f8938.custodial).toEqual({ count: 1, max: 204529 });
  });
  it('married filing jointly: US$400,000 / US$600,000', () => {
    const a = analyzeAccounts(2025, 'mfj', [acct({ maxValueCad: 500000, yearEndValueCad: 500000 })]);
    expect(a.f8938.required).toBe(false);
  });
  it('separate return counts half of jointly owned assets', () => {
    const a = analyzeAccounts(2025, 'mfs', [acct({ owner: 'joint', maxValueCad: 300000, yearEndValueCad: 300000 })]);
    expect(a.f8938.yearEndTotal).toBe(Math.round(219138 * 0.5));
  });
  it('employer pensions are "other foreign assets" (Part VI)', () => {
    const a = analyzeAccounts(2025, 'single', [acct({ kind: 'pension', maxValueCad: 100000 })]);
    expect(a.f8938.other.count).toBe(1);
    expect(a.f8938.custodial.count).toBe(0);
  });
});
