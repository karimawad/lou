// Reusing what the user typed in one tax year in the others. Things that rarely change (who you are,
// which accounts and businesses you have, your funds, your dependents, your Form 2555 background) are
// copied; amounts that are different every year (balances, income, distributions) start empty and the
// item is marked `carried` until the user enters or confirms that year's figures. Works in both
// directions: a household can do 2025 first and then go back to 2023.

import type { ForeignAccount } from '../tax/accounts';
import type { Business } from '../tax/business';
import type { Dependent, Feie2555Details } from '../tax/model';
import type { PficFund } from '../tax/pfic';
import { TAX_YEARS, type TaxYear } from '../tax/years';
import { uid, yearData, type AppState, type YearData } from './store';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const yearOf = (iso: string | undefined) => (iso ? Number(iso.slice(0, 4)) : NaN);

/** Other years with data, nearest first; on a tie the earlier year wins (last year is the usual source). */
export function otherYears(state: AppState, to: TaxYear): { year: TaxYear; data: YearData }[] {
  return TAX_YEARS.filter((y) => y !== to)
    .map((y) => ({ year: y, data: yearData(state, y) }))
    .filter((x): x is { year: TaxYear; data: YearData } => !!x.data)
    .sort((a, b) => Math.abs(a.year - to) - Math.abs(b.year - to) || a.year - b.year);
}

// ---- Accounts ----
export const accountKey = (a: ForeignAccount) => `${a.kind}|${norm(a.institution)}|${a.accountNumber.replace(/\W/g, '') || a.owner}`;

export function carryAccounts(list: ForeignAccount[], from: TaxYear, to: TaxYear): ForeignAccount[] {
  return list
    // An account closed in an earlier year doesn't exist later; one opened in a later year didn't exist before.
    .filter((a) => !(to > from && a.closed) && !(to < from && a.opened))
    .filter((a) => !(a.registered?.openedDate && yearOf(a.registered.openedDate) > to))
    .map((a) => ({
      ...a, id: uid(), maxValueCad: 0, yearEndValueCad: 0, opened: false, closed: false, carried: from,
      registered: a.registered && {
        ...a.registered,
        // The year-end value of one year is the start value of the next.
        startValueCad: to === from + 1 ? a.yearEndValueCad : 0,
        contributionsCad: 0, withdrawalsCad: 0, interestCad: 0, companyDividendsCad: 0,
      },
      ...(to === from - 1 && a.registered ? { yearEndValueCad: a.registered.startValueCad } : {}),
    }));
}

// ---- Businesses ----
export const businessKey = (b: Business) => `${b.owner}|${norm(b.name || b.activity)}`;

export function carryBusinesses(list: Business[], from: TaxYear, to: TaxYear): Business[] {
  return list.map((b) => ({
    ...b, id: uid(), carried: from,
    grossCad: 0, returnsCad: 0, cogsCad: 0, otherIncomeCad: 0, expensesCad: {}, otherDescription: undefined, mealsCad: 0, canadianNetCad: undefined,
    vehicle: b.vehicle && { ...b.vehicle, businessKm: 0, commutingKm: 0, totalKm: 0, parkingTollsCad: 0 },
    // Equipment keeps depreciating in later years; in an earlier year only what was already in service counts.
    assets: b.assets.filter((x) => !x.placedInService || yearOf(x.placedInService) <= to),
  }));
}

// ---- Canadian funds (PFICs) ----
export const fundKey = (f: PficFund) => `${f.owner}|${norm(f.name)}`;

export function carryFunds(list: PficFund[], from: TaxYear, to: TaxYear): PficFund[] {
  return list
    .filter((f) => !(f.acquired && yearOf(f.acquired) > to))
    .map((f) => {
      const thisYear = f.distributions.reduce((s, d) => s + d.amountCad, 0);
      return {
        ...f, id: uid(), carried: from, valueYearEndCad: 0, distributions: [], slipIds: [],
        // Distribution history: one year later, this year's total becomes the most recent prior year.
        priorDistributionsCad: to === from + 1 ? [thisYear, ...f.priorDistributionsCad].slice(0, 3) : to === from - 1 ? f.priorDistributionsCad.slice(1) : [],
        // Election figures roll from Form 8621 each year; the user enters the new starting figures.
        mtm: f.mtm && { ...f.mtm, basisUsdStart: 0, sharesStart: 0, unreversedUsd: 0 },
        qef: f.qef && { ...f.qef, ordinaryEarningsCad: 0, netCapitalGainCad: 0, basisUsdStart: 0, sharesStart: 0, previouslyTaxedUsd: 0 },
      };
    });
}

// ---- Dependents ----
export const dependentKey = (d: Dependent) => `${norm(d.firstName)}|${d.dateOfBirth}`;

export function carryDependents(list: Dependent[], to: TaxYear): Dependent[] {
  return list.filter((d) => !(d.dateOfBirth && yearOf(d.dateOfBirth) > to)).map((d) => ({ ...d }));
}

// ---- Form 2555 background ----
export function carryFeie2555(d: Feie2555Details): Feie2555Details {
  // Same employer, same move date, same home; the trips and housing costs are each year's own.
  return { ...d, trips: [], housing: d.housing && { ...d.housing, expensesCad: 0 } };
}

/** Items from the nearest other year that this year doesn't have yet. */
export function missingFrom<T>(state: AppState, to: TaxYear, pick: (d: YearData) => T[] | undefined, carry: (list: T[], from: TaxYear, to: TaxYear) => T[], key: (t: T) => string, current: T[]) {
  const have = new Set(current.map(key));
  for (const { year, data } of otherYears(state, to)) {
    const list = pick(data) ?? [];
    if (!list.length) continue;
    const items = carry(list, year, to).filter((t) => !have.has(key(t)));
    return items.length ? { year, items } : null;
  }
  return null;
}

/** The reusable parts of the nearest year with data, for a year being started. */
export function seedYear(state: AppState, to: TaxYear): Partial<YearData> {
  const near = otherYears(state, to);
  if (!near.length) return {};
  const { year: from, data } = near[0];
  const firstWith = <T>(pick: (d: YearData) => T[] | undefined) => near.find((n) => (pick(n.data) ?? []).length);
  const acc = firstWith((d) => d.accounts);
  const biz = firstWith((d) => d.businesses);
  const funds = firstWith((d) => d.pficFunds);
  const deps = firstWith((d) => d.dependents);
  const feie2555: YearData['feie2555'] = {};
  for (const who of ['taxpayer', 'spouse'] as const) {
    const src = near.find((n) => n.data.feie2555?.[who])?.data.feie2555?.[who];
    if (src) feie2555[who] = carryFeie2555(src);
  }
  return {
    filingStatus: data.filingStatus,
    spouseIsUsPerson: data.spouseIsUsPerson,
    livedInCanadaAllYear: data.livedInCanadaAllYear,
    elections: data.elections,
    feieFacts: { ...data.feieFacts, daysInUs: 0 },
    feie2555,
    dependents: deps ? carryDependents(deps.data.dependents, to) : [],
    accounts: acc ? carryAccounts(acc.data.accounts, acc.year, to) : [],
    businesses: biz ? carryBusinesses(biz.data.businesses ?? [], biz.year, to) : [],
    pficFunds: funds ? carryFunds(funds.data.pficFunds ?? [], funds.year, to) : [],
    carryFrom: from,
  };
}
