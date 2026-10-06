// Quebec is not supported yet (Karim, 2026-10-06). Lou has partial plumbing (the TP-1 line 432 tax and the federal abatement feed the foreign
// tax credit), but nothing checks it against IRS or Revenu Quebec numbers, and Quebec's own slips (RL-1, RL-3, RL-5, RL-31) and notice of
// assessment are not read. Until that is verified, a Quebec return is stopped instead of guessed (non-negotiable 2).

import type { AppState } from './store';

export const QUEBEC_TITLE = 'Lou does not do Quebec returns yet';
export const QUEBEC_DETAIL = 'Quebec has its own income tax return, its own slips (Relevé 1 and others) and its own rules that change the foreign tax credit. Lou has not been checked against them, so it will not guess. If you lived in Quebec on December 31 of the tax year, ask a cross-border tax professional for this year. Lou works for the other provinces and territories.';

/** True when the household looks like a Quebec resident: a Quebec address, a T4 with QPP or QPIP amounts, or Quebec tax on the assessment. */
export function looksQuebec(s: Pick<AppState, 'address' | 'slips'>): boolean {
  if (s.address.province === 'QC') return true;
  return s.slips.some((x) => (x.type === 'T4' && ((x.boxes['17'] ?? 0) > 0 || (x.boxes['55'] ?? 0) > 0))
    || (x.type === 'NOA' && ((x.boxes['QC432'] ?? 0) > 0 || (x.boxes['44000'] ?? 0) > 0)));
}
