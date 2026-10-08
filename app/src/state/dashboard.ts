// Home dashboard: one card of facts per tax year. Pure (no DOM) so it can be tested.
// Status words: not-started, progress, ready, review (a carry-in changed since the user looked), filed (the user said so).

import { computeReturn } from '../tax/compute';
import { TAX_YEARS, type TaxYear } from '../tax/years';
import { looksQuebec } from './quebec';
import { staleYears } from './staleness';
import { stateForYear, type AppState, type FiledInfo, type StepId } from './store';
import { incomeSlips } from './t1';
import { toReturnInput } from './toInput';

export type YearStatus = 'not-started' | 'progress' | 'ready' | 'review' | 'filed';

export interface Milestone { label: string; done: boolean }

export interface YearCard {
  year: TaxYear;
  status: YearStatus;
  /** Short chip text. */
  label: string;
  milestones: Milestone[];
  /** Plain-language things still missing, in the order to do them. */
  todo: string[];
  /** Refund (positive) or owed (negative), only when the return is complete enough to trust. */
  refund: number | null;
  /** The step the main button opens. */
  next: StepId;
  nextLabel: string;
  filed: FiledInfo | null;
  /** Canadian accounts entered (the FBAR worksheet has nothing to show without them). */
  accounts: number;
}

/** Answers the Questions step still needs (same rules as its Continue button). */
export function questionsPending(s: AppState): string[] {
  const slips = incomeSlips(s).filter((x) => x.type !== 'NOA');
  const out: string[] = [];
  const dividends = slips.filter((x) => x.type === 'T5' && (x.boxes['24'] || x.boxes['10'] || x.boxes['18'])).filter((x) => !x.answers?.dividendSource).length;
  const rrsp = slips.filter((x) => x.fromT1Line === '12900' && !x.answers?.rrspKind).length;
  const biz = (s.businesses ?? []).filter((b) => b.carried !== undefined).length;
  if (dividends) out.push(`Say where ${dividends} dividend slip${dividends === 1 ? '' : 's'} came from`);
  if (rrsp) out.push('Say whether your RRSP income was a withdrawal or annuity payments');
  if (biz) out.push(`Add ${s.year} figures for ${biz} business${biz === 1 ? '' : 'es'} copied from another year`);
  return out;
}

export function yearCard(state: AppState, year: TaxYear, stale: ReadonlySet<TaxYear>): YearCard {
  const s = stateForYear(state, year);
  const empty = !s || (!s.slips.length && !s.filingStatus);
  if (!s || empty) {
    return { year, status: 'not-started', label: 'Not started', milestones: [], todo: [], refund: null, next: 'you', nextLabel: `Start ${year}`, filed: null, accounts: 0 };
  }

  const aboutYou = !!s.filingStatus && !!s.taxpayer.firstName && !!s.taxpayer.lastName;
  const added = s.slips.length > 0;
  const unchecked = s.slips.filter((x) => !x.confirmed).length;
  const checked = added && unchecked === 0;
  const noa = s.slips.some((x) => x.type === 'NOA');
  const carried = s.accounts.filter((a) => a.carried !== undefined).length;
  const accountsDone = (s.accounts.length > 0 || s.noAccounts) && carried === 0;
  const quebec = looksQuebec(s);
  const questions = questionsPending(s);

  const milestones: Milestone[] = [
    { label: 'About you', done: aboutYou },
    { label: 'Slips added', done: added },
    { label: 'Slips checked', done: checked },
    { label: 'Notice of Assessment', done: noa },
    { label: 'A few questions', done: added && questions.length === 0 },
    { label: 'Canadian accounts', done: accountsDone },
  ];

  const todo: string[] = [];
  let next: StepId = 'results';
  let nextLabel = 'Open your return';
  const need = (step: StepId, text: string, button: string) => { todo.push(text); if (next === 'results') { next = step; nextLabel = button; } };
  if (!aboutYou) need('you', 'Finish About you (filing status and name)', 'Continue');
  if (!added) need('slips', 'Add your T1 or your slips', 'Add slips');
  else if (!checked) need('review', `Check ${unchecked} slip${unchecked === 1 ? '' : 's'}`, 'Check the numbers');
  if (added && !noa) need('slips', 'Add your Notice of Assessment (needed for the foreign tax credit)', 'Add your Notice');
  for (const q of questions) need('questions', q, 'Answer the questions');
  if (!s.accounts.length && !s.noAccounts) need('accounts', 'Enter your Canadian accounts, or say you have none', 'Add accounts');
  else if (carried > 0) need('accounts', `Add ${year} balances for ${carried} account${carried === 1 ? '' : 's'} copied from another year`, 'Add balances');
  if (quebec) todo.push('Quebec returns are not supported yet');

  const complete = milestones.every((m) => m.done) && !quebec;
  let refund: number | null = null;
  if (complete) {
    try {
      const input = toReturnInput(s);
      if (input) refund = computeReturn(input).best.refund;
    } catch { /* the Results screen explains any problem */ }
  }

  let status: YearStatus = complete ? 'ready' : 'progress';
  let label = complete ? 'Ready' : `${milestones.filter((m) => m.done).length} of ${milestones.length} done`;
  if (complete && stale.has(year)) { status = 'review'; label = 'Review again'; nextLabel = 'Review again'; }
  if (s.filed) { status = 'filed'; label = 'Filed'; }

  return { year, status, label, milestones, todo, refund, next, nextLabel, filed: s.filed ?? null, accounts: s.accounts.length };
}

export function yearCards(state: AppState): YearCard[] {
  const stale = new Set(staleYears(state).map((x) => x.year));
  return TAX_YEARS.map((y) => yearCard(state, y, stale));
}

/** Short refund line for a card, or null. */
export function resultLine(refund: number | null): string | null {
  if (refund === null) return null;
  const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
  return refund > 0 ? `Refund ${usd(refund)}` : refund < 0 ? `Owes ${usd(refund)}` : 'Nothing owed';
}
