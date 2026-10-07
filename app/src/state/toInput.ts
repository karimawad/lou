// Converts what the user confirmed in the app into the tax engine's input.

import type { CanadianAssessment, ReturnInput, SlipInput } from '../tax/model';
import { analyzeAccounts } from '../tax/accounts';
import { computeReturn } from '../tax/compute';
import { incomeSlips } from './t1';
import type { CarryoverVintage } from '../tax/model';
import type { CapitalLossCarryover } from '../tax/capital';
import type { TaxYear } from '../tax/years';
import { stateForYear, type AppState } from './store';

/**
 * Foreign tax carryover from the previous tax year's return in Lou (its Schedule B (Form 1116)
 * line 8, by year of origin). Only used when that year's slips are all checked. Chains back
 * through earlier years the same way.
 */
export interface AutoCarryover { vintages: CarryoverVintage[]; amtVintages: CarryoverVintage[]; capitalLoss: CapitalLossCarryover; fromYear: TaxYear; room: { general: number; passive: number } }

export function autoCarryover(state: AppState): AutoCarryover | null {
  if (!state.year) return null;
  const priorYear = (state.year - 1) as TaxYear;
  const prior = stateForYear(state, priorYear);
  if (!prior || !prior.slips.length || !prior.slips.every((s) => s.confirmed)) return null;
  const input = toReturnInput(prior);
  if (!input) return null;
  const r = computeReturn(input).best;
  // Regular and AMT carryovers are tracked separately (AMT: the AMT Forms 1116 behind Form 6251).
  const collect = (forms: { category: 'general' | 'passive'; scheduleB?: { next: { year: number; amount: number }[] } }[]) => {
    const rows = new Map<number, CarryoverVintage>();
    for (const f of forms) for (const n of f.scheduleB?.next ?? []) {
      const row = rows.get(n.year) ?? { year: n.year, general: 0, passive: 0 };
      row[f.category] += n.amount;
      rows.set(n.year, row);
    }
    return [...rows.values()].sort((a, b) => a.year - b.year);
  };
  // Unused Form 1116 limit in the prior year (line 23 less the credit taken): room for this year's unused foreign tax to be carried back.
  const room = { general: 0, passive: 0 };
  for (const f of r.f1116) room[f.category] = Math.max(0, f.lines['23'] - f.lines['24']);
  return { vintages: collect(r.f1116), amtVintages: collect(r.f6251.f1116), capitalLoss: r.capitalLossNext, fromYear: priorYear, room };
}

/** Typed-in carryovers win (regular and AMT separately); otherwise they flow from last year's return in Lou. */
function carryoverFor(state: AppState, auto: AutoCarryover | null) {
  const c = state.carryover;
  const typed = !!(c.vintages?.length || c.general || c.passive);
  const typedAmt = !!c.amtVintages?.length;
  return {
    ...(typed ? c : { general: 0, passive: 0, vintages: auto?.vintages ?? [] }),
    amtVintages: typedAmt ? c.amtVintages : auto?.amtVintages ?? [],
  };
}

/** NOA "boxes" are T1 line numbers. */
export function assessmentsFrom(state: AppState): CanadianAssessment[] {
  return state.slips.filter((s) => s.type === 'NOA').map((s) => ({
    owner: s.owner,
    totalIncome: s.boxes['15000'] ?? 0,
    netIncome: s.boxes['23600'] ?? 0,
    netFederalTax: s.boxes['42000'] ?? 0,
    provincialTax: s.boxes['42800'] ?? 0,
    quebecAbatement: s.boxes['44000'] || undefined,
    quebecTax: s.boxes['QC432'] || undefined,
  }));
}

export function toReturnInput(state: AppState): ReturnInput | null {
  if (!state.year || !state.filingStatus) return null;
  const married = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  const auto = autoCarryover(state);
  // Uploaded slips plus slips made from T1 income lines that no slip feeds (state/t1.ts).
  const slips: SlipInput[] = incomeSlips(state)
    .filter((s) => s.type !== 'NOA' && (!s.year || s.year === state.year))
    .map((s) => ({ id: s.id, type: s.type as SlipInput['type'], owner: s.owner, payer: s.payer, boxes: s.boxes, answers: s.answers }));
  return {
    year: state.year,
    filingStatus: state.filingStatus,
    taxpayer: state.taxpayer,
    spouse: married ? state.spouse : undefined,
    dependents: state.dependents,
    address: state.address,
    slips,
    assessments: assessmentsFrom(state),
    // Carryovers typed in by the user win; otherwise they flow from the previous year's return in Lou.
    carryover: carryoverFor(state, auto),
    priorYearRoom: auto?.room,
    elections: state.elections,
    feie2555: state.feie2555,
    digitalAssets: state.digitalAssets ?? undefined,
    accounts: state.accounts,
    businesses: state.businesses?.length ? state.businesses : undefined,
    sales: state.sales?.length ? state.sales : undefined,
    pficFunds: state.pficFunds?.length ? state.pficFunds : undefined,
    // Typed-in capital loss carryover wins; otherwise it flows from last year's return in Lou.
    capitalLossCarryover: state.capitalLossCarryover ?? auto?.capitalLoss,
    spouseIsUsPerson: state.spouseIsUsPerson ?? undefined,
    foreignAccountsOver10k: state.accounts.length
      ? analyzeAccounts(state.year, state.filingStatus, state.accounts, { spouseIsUsPerson: state.spouseIsUsPerson ?? undefined }).fbar[0].required
      : state.noAccounts ? false : state.accountsOver10k ?? undefined,
    feieFacts: { ...state.feieFacts, bonaFideResident: state.livedInCanadaAllYear === true },
  };
}

/** IRS mailing addresses for filers with a foreign address (2025 Form 1040 instructions, "Where Do You File?"). */
export const MAIL_TO = {
  noPayment: ['Department of the Treasury', 'Internal Revenue Service', 'Austin, TX 73301-0215', 'USA'],
  withPayment: ['Internal Revenue Service', 'P.O. Box 1303', 'Charlotte, NC 28201-1303', 'USA'],
};

/** A return sent with Form W-7 goes to the ITIN office instead (Instructions for Form W-7, Rev. 12-2024, "Where To Apply"). */
export const ITIN_MAIL_TO = ['Internal Revenue Service', 'ITIN Operation', 'P.O. Box 149342', 'Austin, TX 78714-9342', 'USA'];
