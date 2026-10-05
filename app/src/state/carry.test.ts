import { describe, expect, it } from 'vitest';
import type { ForeignAccount } from '../tax/accounts';
import type { Business } from '../tax/business';
import type { PficFund } from '../tax/pfic';
import { accountKey, carryAccounts, carryBusinesses, carryFunds, missingFrom } from './carry';
import { initialState, switchYear, type AppState } from './store';

const account = (over: Partial<ForeignAccount>): ForeignAccount => ({
  id: 'a', owner: 'taxpayer', kind: 'bank', institution: 'CIBC', street: '199 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5L 1A2',
  accountNumber: '111', maxValueCad: 20000, yearEndValueCad: 15000, opened: false, closed: false, ...over,
});
const business: Business = {
  id: 'b', owner: 'taxpayer', name: 'Lee Design', activity: 'Design', code: '541430', accounting: 'cash', grossCad: 60000, returnsCad: 0, cogsCad: 0,
  otherIncomeCad: 0, expensesCad: { '18': 2000 }, mealsCad: 300, homeOffice: { homeSqM: 100, officeSqM: 10, regularExclusive: true },
  assets: [{ description: 'Camera', kind: 'computer', costCad: 6000, placedInService: '2024-11-20', businessUsePct: 100 }],
  deMinimis: false, capitalMaterial: false, materiallyParticipated: true,
};
const fund: PficFund = {
  id: 'f', owner: 'taxpayer', name: 'Maple Balanced', account: 'taxable', regime: '1291', acquired: '2018-06-01', sharesYearEnd: 1000,
  valueYearEndCad: 40000, distributions: [{ date: '2024-12-15', amountCad: 800 }], priorDistributionsCad: [700, 600, 500], slipIds: ['t3'],
};

/** A household that finished 2024, then opens 2025 for the first time. */
function after2024(): AppState {
  let s = switchYear({ ...initialState(), taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123456789', dateOfBirth: '1985-05-01' } }, 2024);
  s = { ...s, filingStatus: 'mfs', spouseIsUsPerson: false, livedInCanadaAllYear: true,
    dependents: [{ firstName: 'Ava', lastName: 'Lee', ssn: '', relationship: 'Daughter', dateOfBirth: '2019-02-01', hasValidSsn: true, usPerson: true, livedWithYouOverHalfYear: true }],
    accounts: [account({}), account({ id: 'c', accountNumber: '222', closed: true }), account({ id: 't', kind: 'tfsa', accountNumber: '333', yearEndValueCad: 9000,
      registered: { openedDate: '2015-01-02', startValueCad: 8000, contributionsCad: 500, withdrawalsCad: 0, interestCad: 50, companyDividendsCad: 0, dividendsQualified: true, holdsInvestments: true, file3520: true } })],
    businesses: [business], pficFunds: [fund],
    feie2555: { taxpayer: { employerAddress: '1 Maple Rd', employerType: 'foreign', filedBefore: true, priorYear: '2023', revoked: false, revokedDetail: '', residenceStart: '2016-08-01', quarters: 'rented', familyWithYou: true, familyWho: 'Spouse', status: 'pr', statusOther: '', visaLimited: false, usHome: false, usHomeAddress: '', trips: [{ arrived: '2024-07-01', left: '2024-07-10', businessDays: 0 }] } },
  };
  return switchYear(s, 2025);
}

describe('reusing information across years', () => {
  it('starts a new year with what rarely changes, and nothing that changes every year', () => {
    const s = after2024();
    expect(s.year).toBe(2025);
    expect(s.carryFrom).toBe(2024);
    expect([s.filingStatus, s.spouseIsUsPerson, s.livedInCanadaAllYear]).toEqual(['mfs', false, true]);
    expect(s.dependents.map((d) => d.firstName)).toEqual(['Ava']);
    // The closed account is gone; the others keep their identity, lose their balances and wait for 2025 figures.
    expect(s.accounts.map((a) => [a.accountNumber, a.maxValueCad, a.yearEndValueCad, a.carried])).toEqual([['111', 0, 0, 2024], ['333', 0, 0, 2024]]);
    expect(s.accounts[1].registered).toMatchObject({ startValueCad: 9000, openedDate: '2015-01-02', contributionsCad: 0, interestCad: 0, file3520: true });
    // The business keeps its set-up and equipment (still depreciating); income and expenses start empty.
    expect(s.businesses[0]).toMatchObject({ name: 'Lee Design', grossCad: 0, expensesCad: {}, mealsCad: 0, carried: 2024, homeOffice: business.homeOffice });
    expect(s.businesses[0].assets).toHaveLength(1);
    // The fund's 2024 distributions become the most recent prior year.
    expect(s.pficFunds[0]).toMatchObject({ valueYearEndCad: 0, distributions: [], slipIds: [], priorDistributionsCad: [800, 700, 600], carried: 2024 });
    // Form 2555 background carries; trips don't.
    expect(s.feie2555.taxpayer).toMatchObject({ employerAddress: '1 Maple Rd', residenceStart: '2016-08-01', trips: [] });
    // Slips never carry.
    expect(s.slips).toEqual([]);
  });

  it('also works backwards (2025 done first, then 2024)', () => {
    const items = carryAccounts([account({ opened: true, accountNumber: '9' }), account({ kind: 'tfsa', accountNumber: '8',
      registered: { openedDate: '2015-01-02', startValueCad: 7000, contributionsCad: 0, withdrawalsCad: 0, interestCad: 0, companyDividendsCad: 0, dividendsQualified: true, holdsInvestments: true, file3520: true } })], 2025, 2024);
    // An account opened in 2025 didn't exist in 2024; the TFSA's 2025 start value is its 2024 year-end value.
    expect(items.map((a) => [a.accountNumber, a.yearEndValueCad])).toEqual([['8', 7000]]);
    expect(carryBusinesses([{ ...business, assets: [{ ...business.assets[0], placedInService: '2025-03-01' }] }], 2025, 2024)[0].assets).toEqual([]);
    expect(carryFunds([{ ...fund, acquired: '2025-02-01' }], 2025, 2024)).toEqual([]);
    expect(carryFunds([fund], 2025, 2024)[0].priorDistributionsCad).toEqual([600, 500]);
  });

  it('offers only what this year is missing', () => {
    const s = after2024();
    const none = missingFrom(s, 2025, (d) => d.accounts, carryAccounts, accountKey, s.accounts);
    expect(none).toBeNull();
    const one = missingFrom(s, 2025, (d) => d.accounts, carryAccounts, accountKey, s.accounts.slice(1));
    expect(one?.year).toBe(2024);
    expect(one?.items.map((a) => a.accountNumber)).toEqual(['111']);
  });
});
