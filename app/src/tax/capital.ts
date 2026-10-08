// Sales of shares and other capital assets -> Form 8949 and Schedule D.
// Sources: Instructions for Form 8949 and Schedule D (2023-2025). Canadian brokers don't issue
// Form 1099-B, so sales go in box C (short-term) or box F (long-term). Each sale is converted at the
// exchange rate on its own dates: cost on the purchase date, proceeds on the sale date (Pub 54,
// "Foreign Currency"); Lou uses the Bank of Canada's posted daily rates (fx.ts).

import { dailyRate } from './fx';
import { dollars } from './taxComputation';
import type { FilingStatus, TaxYear } from './years';
import type { Flag } from './model';

export interface CapitalSale {
  id: string;
  owner: 'taxpayer' | 'spouse';
  description: string;
  acquired: string;
  sold: string;
  proceedsCad: number;
  costCad: number;
  /** The T5008 slip this sale came from, if any. */
  slipId?: string;
  /** Sold inside a TFSA, FHSA or RESP (the account id): still on Form 8949, and on that trust's Form 3520-A. */
  accountId?: string;
  /** Units of a Canadian fund: handled as a PFIC disposition (Form 8621), not on Form 8949 directly. */
  pficFundId?: string;
  /** A sale or swap of crypto, an NFT or another digital asset: Form 8949 box I / L for 2025, box C / F before (see i8949). */
  digital?: boolean;
  /** CAD per USD, when a date is outside Lou's bundled rates. */
  acquiredRate?: number;
  soldRate?: number;
}

export interface Form8949Row {
  description: string;
  acquired: string;
  sold: string;
  proceeds: number;
  basis: number;
  gain: number;
  longTerm: boolean;
  owner: 'taxpayer' | 'spouse';
  digital?: boolean;
  /** Rates used (for the attached computation). */
  acquiredRate?: number;
  soldRate?: number;
}

/** Held more than one year: sold after the same date in the following year (Schedule D instructions). */
export function isLongTerm(acquired: string, sold: string): boolean {
  if (acquired === 'VARIOUS') return true;
  const y = Number(acquired.slice(0, 4)) + 1;
  const anniversary = acquired.slice(5) === '02-29' ? `${y}-02-28` : `${y}${acquired.slice(4)}`;
  return sold > anniversary;
}

export function saleRow(s: CapitalSale, flags: Flag[]): Form8949Row | null {
  const a = s.acquiredRate ? { rate: s.acquiredRate } : dailyRate(s.acquired);
  const b = s.soldRate ? { rate: s.soldRate } : dailyRate(s.sold);
  if (!a || !b) {
    flags.push({ id: `fx-sale-${s.id}`, severity: 'block', title: `Exchange rate needed for ${s.description || 'a sale'}`,
      detail: 'Lou has Bank of Canada daily rates from May 1, 2007. Enter the CAD per USD rate for the purchase or sale date that is outside that range.' });
    return null;
  }
  const proceeds = dollars(s.proceedsCad / b.rate);
  const basis = dollars(s.costCad / a.rate);
  return { description: s.description, acquired: s.acquired, sold: s.sold, proceeds, basis, gain: proceeds - basis, longTerm: isLongTerm(s.acquired, s.sold), owner: s.owner, ...(s.digital ? { digital: true } : {}), acquiredRate: a.rate, soldRate: b.rate };
}

export interface CapitalLossCarryover { shortTerm: number; longTerm: number }

export interface ScheduleDResult {
  rows: Form8949Row[];
  lines: Record<string, number>;
  /** Amount for Form 1040 line 7. */
  line7: number;
  /** Net capital gain for the Qualified Dividends and Capital Gain Tax Worksheet line 3. */
  qdcgLine3: number;
}

/**
 * Schedule D Parts I-III. `capitalGainDistributions` goes on line 13; `otherLongTerm` (QEF net capital
 * gain, Form 8621 line 7c) on line 11. Line 21 limits a net loss to $3,000 ($1,500 married filing separately).
 */
export function scheduleD(status: FilingStatus, rows: Form8949Row[], carry: CapitalLossCarryover, capitalGainDistributions: number, otherLongTerm = 0): ScheduleDResult {
  const L: Record<string, number> = {};
  const st = rows.filter((r) => !r.longTerm);
  const lt = rows.filter((r) => r.longTerm);
  const tot = (rs: Form8949Row[], k: 'proceeds' | 'basis' | 'gain') => rs.reduce((a, r) => a + r[k], 0);
  L['3d'] = tot(st, 'proceeds'); L['3e'] = tot(st, 'basis'); L['3h'] = tot(st, 'gain');
  L['6'] = -Math.max(0, carry.shortTerm);
  L['7'] = L['3h'] + L['6'];
  L['10d'] = tot(lt, 'proceeds'); L['10e'] = tot(lt, 'basis'); L['10h'] = tot(lt, 'gain');
  L['11'] = otherLongTerm;
  L['13'] = capitalGainDistributions;
  L['14'] = -Math.max(0, carry.longTerm);
  L['15'] = L['10h'] + L['11'] + L['13'] + L['14'];
  L['16'] = L['7'] + L['15'];
  let line7 = L['16'];
  if (L['16'] < 0) {
    L['21'] = Math.max(L['16'], status === 'mfs' ? -1500 : -3000);
    line7 = L['21'];
  }
  const qdcgLine3 = L['15'] > 0 && L['16'] > 0 ? Math.min(L['15'], L['16']) : 0;
  return { rows, lines: L, line7, qdcgLine3 };
}

/**
 * Capital Loss Carryover Worksheet (Schedule D instructions, lines 6 and 14) for the following year,
 * from this year's Schedule D and Form 1040 line 15 (negative if taxable income would be below zero).
 */
export function carryoverToNextYear(d: Record<string, number>, line15: number): CapitalLossCarryover {
  // Only when line 21 is a loss and either it is smaller than the line 16 loss or taxable income was below zero.
  if (!(d['21'] < 0) || !(d['21'] > d['16'] || line15 < 0)) return { shortTerm: 0, longTerm: 0 };
  const l1 = line15;
  const l2 = -d['21'];
  const l3 = Math.max(0, l1 + l2);
  const l4 = Math.min(l2, l3);
  let l5 = 0, l8 = 0, l13 = 0;
  if (d['7'] < 0) {
    l5 = -d['7'];
    const l6 = Math.max(0, d['15']);
    l8 = Math.max(0, l5 - (l4 + l6));
  }
  if (d['15'] < 0) {
    const l9 = -d['15'];
    const l10 = Math.max(0, d['7']);
    const l11 = Math.max(0, l4 - l5);
    l13 = Math.max(0, l9 - (l10 + l11));
  }
  return { shortTerm: l8, longTerm: l13 };
}

/** Years Lou can compute (re-exported for the UI). */
export type { TaxYear };
