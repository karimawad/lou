import { describe, expect, it } from 'vitest';
import { computeReturn } from './compute';
import type { ForeignAccount } from './accounts';
import type { ReturnInput } from './model';

const tfsa = (over: Partial<ForeignAccount> = {}): ForeignAccount => ({
  id: 'a1', owner: 'taxpayer', kind: 'tfsa', institution: 'RBC Direct Investing', street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J5',
  accountNumber: '555', maxValueCad: 60000, yearEndValueCad: 58000, opened: false, closed: false,
  registered: { openedDate: '2015-03-01', startValueCad: 50000, contributionsCad: 7000, withdrawalsCad: 0, interestCad: 300, companyDividendsCad: 1200,
    dividendsQualified: true, holdsInvestments: true, file3520: true },
  ...over,
});

const base = (accounts: ForeignAccount[]): ReturnInput => ({
  year: 2025, filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
  dependents: [], address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 100000 } }],
  assessments: [{ owner: 'taxpayer', totalIncome: 100000, netIncome: 100000, netFederalTax: 13000, provincialTax: 7000 }],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true }, accounts,
});

describe('TFSA', () => {
  it('reports the income inside on Schedule B and prepares Form 3520 figures', () => {
    const r = computeReturn(base([tfsa()])).best;
    // 300 / 1.398 = 214.59; 1,200 / 1.398 = 858.37
    expect(r.scheduleB.interest.find((x) => x.payer.startsWith('Interest - TFSA'))?.amount).toBe(215);
    expect(r.f1040['3a']).toBe(858);
    expect(r.trusts).toHaveLength(1);
    const t = r.trusts[0];
    expect(t.contributionsUsd).toBe(5007); // 7,000 / 1.398
    expect(t.yearEndUsd).toBe(42367); // 58,000 / 1.369 (Treasury Dec 31, 2025)
    expect(t.startUsd).toBe(34771); // 50,000 / 1.438 (Treasury Dec 31, 2024)
  });
  it('no Form 3520 when switched off, with a warning', () => {
    const r = computeReturn(base([tfsa({ registered: { ...tfsa().registered!, file3520: false } })])).best;
    expect(r.trusts).toHaveLength(0);
    expect(r.flags.some((f) => f.id === 'no3520-a1')).toBe(true);
  });
  it('RESP: income reported, never Form 3520', () => {
    const r = computeReturn(base([tfsa({ kind: 'resp' })])).best;
    expect(r.trusts).toHaveLength(0);
    expect(r.flags.some((f) => f.id === 'resp-a1')).toBe(true);
  });
  it('asks for the details when missing', () => {
    expect(computeReturn(base([tfsa({ registered: undefined })])).best.flags.some((f) => f.id === 'registered-a1' && f.severity === 'block')).toBe(true);
  });
});
