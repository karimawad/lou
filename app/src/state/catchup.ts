// What the catch-up screen and its PDFs read from the saved state: each year's readiness, the Canadian accounts behind each FBAR
// year (a return year's own accounts, or the FBAR-only list kept under `catchup.fbar`), and the tax and interest owed.

import { analyzeAccounts, type AccountsAnalysis, type ForeignAccount } from '../tax/accounts';
import { catchUpInterest, type InterestRow, type SfopPlan } from '../tax/catchup';
import { computeReturn, type ReturnResult } from '../tax/compute';
import type { FilingStatus, TaxYear } from '../tax/years';
import { TAX_YEARS } from '../tax/years';
import { QUEBEC_TITLE, looksQuebec } from './quebec';
import { deriveFromT1 } from './t1';
import { stateForYear, type AppState } from './store';
import { toReturnInput } from './toInput';
import type { ReturnInput } from '../tax/model';

export interface YearReadiness {
  year: number;
  /** Lou has a workspace for the year with something in it. */
  started: boolean;
  /** Everything the return needs is in and nothing blocks it. */
  ready: boolean;
  /** What is still missing, in plain words. */
  blockers: string[];
  input?: ReturnInput;
  result?: ReturnResult;
  /** Tax owed on the return, whole dollars (0 for a refund). */
  owe: number;
}

export function isReturnYear(year: number): year is TaxYear { return (TAX_YEARS as number[]).includes(year); }

export function yearReadiness(state: AppState, year: number): YearReadiness {
  const empty = { year, started: false, ready: false, owe: 0 };
  if (!isReturnYear(year)) return { ...empty, blockers: [`Lou has no ${year} tax rules yet.`] };
  const s = stateForYear(state, year);
  if (!s || (!s.slips.length && !s.filingStatus)) return { ...empty, blockers: [`Start ${year}: about you, then your slips.`] };
  const blockers: string[] = [];
  if (!s.filingStatus || !s.taxpayer.firstName || !s.taxpayer.lastName) blockers.push('Finish About you.');
  if (!s.slips.length) blockers.push('Add your slips.');
  else if (!s.slips.every((x) => x.confirmed)) blockers.push('Check every slip in Check the numbers.');
  if (looksQuebec(s)) blockers.push(QUEBEC_TITLE + '.');
  if (!s.slips.some((x) => x.type === 'NOA')) blockers.push('Add your Notice of Assessment.');
  if ([...s.accounts, ...s.businesses, ...s.pficFunds].some((x) => x.carried)) blockers.push(`Fill in ${year}'s figures for the accounts, businesses or funds copied from another year.`);
  const input = toReturnInput(s);
  if (!input) {
    if (!blockers.length) blockers.push('Answer the remaining questions.');
    return { ...empty, started: true, blockers };
  }
  const result = computeReturn(input).best;
  for (const f of [...deriveFromT1(s).flags, ...result.flags]) if (f.severity === 'block') blockers.push(f.title);
  return { year, started: true, ready: blockers.length === 0, blockers: [...new Set(blockers)], input, result, owe: result.refund < 0 ? -result.refund : 0 };
}

export interface FbarYear {
  year: number;
  accounts: ForeignAccount[];
  noAccounts: boolean;
  /** The accounts live in this year's return workspace (edit them there). */
  inReturn: boolean;
}

/** The accounts an FBAR year is built from. Return years use their own list; older years use the catch-up list. */
export function fbarYear(state: AppState, year: number): FbarYear {
  const s = isReturnYear(year) ? stateForYear(state, year) : null;
  if (s) return { year, accounts: s.accounts, noAccounts: s.noAccounts, inReturn: true };
  const c = state.catchup.fbar[year];
  return { year, accounts: c?.accounts ?? [], noAccounts: c?.noAccounts ?? false, inReturn: false };
}

/** Filing status and the spouse's US-person answer, from the workspace nearest in time (FBAR-only years have none of their own). */
export function householdFor(state: AppState, year: number): { status: FilingStatus; spouseIsUsPerson?: boolean } {
  const near = TAX_YEARS.map((y) => stateForYear(state, y)).filter((s): s is AppState => !!s?.filingStatus)
    .sort((a, b) => Math.abs((a.year ?? 0) - year) - Math.abs((b.year ?? 0) - year) || (a.year ?? 0) - (b.year ?? 0))[0];
  return { status: near?.filingStatus ?? 'single', spouseIsUsPerson: near?.spouseIsUsPerson ?? undefined };
}

export type FbarStatus = 'todo' | 'carried' | 'none' | 'under' | 'file';

export interface FbarSummary extends FbarYear {
  analysis: AccountsAnalysis | null;
  status: FbarStatus;
  /** Largest aggregate of highest balances among the filers (US dollars). */
  maxAggregateUsd: number;
}

export function fbarSummary(state: AppState, year: number): FbarSummary {
  const y = fbarYear(state, year);
  const h = householdFor(state, year);
  const analysis = y.accounts.length ? analyzeAccounts(year, h.status, y.accounts, { spouseIsUsPerson: h.spouseIsUsPerson }) : null;
  const maxAggregateUsd = analysis ? Math.max(0, ...analysis.fbar.map((f) => f.aggregateMaxUsd)) : 0;
  const status: FbarStatus = !y.accounts.length ? (y.noAccounts ? 'none' : 'todo')
    : y.accounts.some((a) => a.carried) ? 'carried'
    : analysis?.fbar.some((f) => f.required) ? 'file' : 'under';
  return { ...y, analysis, status, maxAggregateUsd };
}

export const fbarYearsOf = (state: AppState, plan: SfopPlan) =>
  [...plan.fbarYears, ...(plan.fbarAlsoNow ? [plan.fbarAlsoNow] : [])].map((y) => fbarSummary(state, y));

/** Tax and estimated interest per return year, counted to `payDate`. Years that are not ready count as 0 until they are. */
export function owedByYear(state: AppState, plan: SfopPlan, payDate: string): { readiness: YearReadiness[]; interest: InterestRow[]; totalTax: number; totalInterest: number } {
  const readiness = plan.returnYears.map((y) => yearReadiness(state, y));
  const interest = catchUpInterest(readiness.map((r) => ({ year: r.year, tax: r.owe })), payDate);
  return { readiness, interest, totalTax: readiness.reduce((a, r) => a + r.owe, 0), totalInterest: Math.round(interest.reduce((a, r) => a + r.interest, 0) * 100) / 100 };
}

/** Every distinct account across the FBAR years, so the statement asks about each one once. */
export function distinctAccounts(summaries: FbarSummary[]): ForeignAccount[] {
  const seen = new Map<string, ForeignAccount>();
  for (const s of summaries) for (const a of s.accounts) {
    if (a.kind === 'pension') continue;
    const k = `${a.kind}|${a.institution.trim().toLowerCase()}|${a.accountNumber.replace(/\W/g, '')}`;
    if (!seen.has(k)) seen.set(k, a);
  }
  return [...seen.values()];
}
