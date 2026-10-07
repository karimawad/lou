// A return Lou already showed (or the user downloaded) can change when ANOTHER year changes: last year's unused foreign tax,
// AMT foreign tax and capital losses carry in automatically (state/toInput.ts autoCarryover). This keeps a small snapshot of
// what carried into each year when the user last looked at it, and tells them to review the year when it no longer matches.
// The paid key covers every year (license/key.ts), so reviewing again never needs a new payment.

import { computeReturn } from '../tax/compute';
import { TAX_YEARS, type TaxYear } from '../tax/years';
import { stateForYear, type AppState } from './store';
import { toReturnInput } from './toInput';

export interface ReviewSnap {
  /** What carried into the year, as one comparable string. */
  sig: string;
  /** Foreign tax credit carried in (USD, all years of origin, general + passive). */
  ftc: number;
  /** AMT foreign tax credit carried in. */
  amt: number;
  /** Capital loss carried in (short + long term). */
  loss: number;
  /** Unused Canadian tax from the NEXT year that now carries back into this one (needs a Form 1040-X). */
  back: number;
  /** Refund (negative = owed) when last reviewed. */
  refund: number;
}

const sum = (rows: { general: number; passive: number }[] | undefined) => (rows ?? []).reduce((t, r) => t + r.general + r.passive, 0);
const round = (n: number) => Math.round(n * 100) / 100;

/** Is this year's return complete enough that a carry-in change means something? */
export function yearIsReady(s: AppState): boolean {
  return s.slips.length > 0 && s.slips.every((x) => x.confirmed) && s.slips.some((x) => x.type === 'NOA');
}

/** What carries into `year` right now (typed-in figures included: they do not change when another year does), or null if not ready. */
export function reviewSnapshot(state: AppState, year: TaxYear): ReviewSnap | null {
  const s = stateForYear(state, year);
  if (!s || !yearIsReady(s)) return null;
  const input = toReturnInput(s);
  if (!input) return null;
  const c = input.carryover ?? { general: 0, passive: 0 };
  const ftc = round(sum(c.vintages) + (c.general ?? 0) + (c.passive ?? 0));
  const amt = round(sum(c.amtVintages));
  const loss = round((input.capitalLossCarryover?.shortTerm ?? 0) + (input.capitalLossCarryover?.longTerm ?? 0));
  // The next year's unused foreign tax goes back into this year first (IRC 904(c)).
  const later = stateForYear(state, (year + 1) as TaxYear);
  const laterInput = later && yearIsReady(later) ? toReturnInput(later) : null;
  const back = laterInput ? round(computeReturn(laterInput).best.f1116.reduce((t, f) => t + f.carryback, 0)) : 0;
  const detail = JSON.stringify([c.vintages ?? [], c.general ?? 0, c.passive ?? 0, c.amtVintages ?? [], input.capitalLossCarryover ?? null, ...(back > 0 ? [back] : [])]);
  return { sig: detail, ftc, amt, loss, back, refund: computeReturn(input).best.refund };
}

export interface StaleYear { year: TaxYear; before: ReviewSnap; now: ReviewSnap }

/** Years the user already reviewed whose carry-in has since changed. */
export function staleYears(state: AppState): StaleYear[] {
  const out: StaleYear[] = [];
  for (const year of TAX_YEARS) {
    const before = state.reviewed?.[year];
    if (!before) continue;
    const now = reviewSnapshot(state, year);
    if (now && now.sig !== before.sig) out.push({ year, before, now });
  }
  return out;
}

/** Plain-language lines for what moved into the year. */
export function staleReasons(s: StaleYear): string[] {
  const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  const lines: string[] = [];
  if (s.before.ftc !== s.now.ftc) lines.push(`Unused Canadian tax carried in from earlier years: ${usd(s.before.ftc)} before, ${usd(s.now.ftc)} now.`);
  if (s.before.amt !== s.now.amt) lines.push(`Foreign tax carried in for the alternative minimum tax: ${usd(s.before.amt)} before, ${usd(s.now.amt)} now.`);
  if (s.before.loss !== s.now.loss) lines.push(`Capital losses carried in: ${usd(s.before.loss)} before, ${usd(s.now.loss)} now.`);
  if (s.before.back !== s.now.back) lines.push(`Unused Canadian tax from ${s.year + 1} now carries back into ${s.year}: ${usd(s.before.back)} before, ${usd(s.now.back)} now. Claim it by amending ${s.year} with Form 1040-X and a revised Form 1116 (see your ${s.year + 1} return for the numbers).`);
  if (!lines.length) lines.push('The figures that carry in from an earlier year changed.');
  if (s.before.refund !== s.now.refund) {
    const f = (r: number) => (r > 0 ? `a refund of ${usd(r)}` : r < 0 ? `${usd(-r)} owing` : 'nothing owing');
    lines.push(`Your ${s.year} result went from ${f(s.before.refund)} to ${f(s.now.refund)}.`);
  }
  return lines;
}
