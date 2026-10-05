// Canadian mutual funds and ETFs held outside an RRSP/RRIF are PFICs (IRC 1291-1298).
// Implements Form 8621 (Rev. December 2025) for an individual:
//   - Section 1291 funds (no election): excess distributions and gains on disposition are spread
//     over the holding period; the current-year part is ordinary income, earlier years are taxed at
//     that year's highest rate with interest (IRC 1291(c); i8621 lines 15-16f).
//   - Section 1296 mark-to-market funds (Part IV), including the first-year coordination rule
//     (IRC 1296(j), Reg. 1.1296-1(i)): the first MTM year's gain on stock held earlier is taxed under 1291.
//   - Qualified electing funds (Part III) from the fund's PFIC Annual Information Statement.
// Filing exceptions: Reg. 1.1298-1(c)(2) ($25,000 / $50,000 joint, section 1291 funds only) and
// 1.1298-1(c)(4) (funds held through a treaty pension arrangement such as an RRSP or RRIF).

import interest from './data/irs-interest.json';
import { dailyRate } from './fx';
import { dollars } from './taxComputation';
import type { TaxYear } from './years';

/** Highest rate under IRC 1 by year (i8621, line 16c table). */
export function highestRate(year: number): number | null {
  if (year >= 2018 && year <= 2025) return 0.37;
  if (year >= 2013 && year <= 2017) return 0.396;
  if (year >= 2003 && year <= 2012) return 0.35;
  if (year === 2002) return 0.386;
  if (year === 2001) return 0.391;
  if (year >= 1993 && year <= 2000) return 0.396;
  if (year >= 1991 && year <= 1992) return 0.31;
  if (year >= 1988 && year <= 1990) return 0.28;
  if (year === 1987) return 0.385;
  return null;
}

const RATES = interest.rates as Record<string, number>;
const DAY = 86400000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const isoOf = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
const leap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

/**
 * Interest factor for an amount owed from `from` to `to` (exclusive of `from`), compounded daily
 * at the IRC 6621(a)(2) rate for each quarter (rate / days in the year, per day; IRC 6622).
 * Returns null when a quarter's rate isn't in Lou's table.
 */
export function interestFactor(from: string, to: string): number | null {
  let f = 1;
  for (let d = toDay(from) + 1; d <= toDay(to); d++) {
    const iso = isoOf(d);
    const y = Number(iso.slice(0, 4));
    const q = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
    const r = RATES[`${y}-Q${q}`];
    if (r === undefined) return null;
    f *= 1 + r / 100 / (leap(y) ? 366 : 365);
  }
  return f;
}

/** Spreads `amount` evenly over the days after `acquired` through `end` (the holding period), by calendar year. */
export function allocateByYear(amount: number, acquired: string, end: string): Map<number, number> {
  const first = toDay(acquired) + 1;
  const last = toDay(end);
  const days = Math.max(1, last - first + 1);
  const out = new Map<number, number>();
  for (let d = first; d <= last; d++) {
    const y = Number(isoOf(d).slice(0, 4));
    out.set(y, (out.get(y) ?? 0) + amount / days);
  }
  if (last < first) out.set(Number(end.slice(0, 4)), amount);
  return out;
}

export interface Section1291Row { year: number; allocated: number; rate?: number; increase: number; foreignTax: number; netIncrease: number; interest: number }
export interface Section1291Result { ordinary: number; increase: number; foreignTaxCredit: number; netIncrease: number; interest: number; rows: Section1291Row[]; missingRates: boolean }

/**
 * Line 16 for one excess distribution or gain (USD) received/realized on `end` from stock acquired on
 * `acquired`. `foreignTaxUsd` is creditable foreign tax attributable to the excess (0 for gains: i8621
 * line 16d applies only to a section 1248 dividend part, which an individual minority holder doesn't have).
 */
export function section1291(currentYear: TaxYear, amountUsd: number, acquired: string, end: string, foreignTaxUsd = 0): Section1291Result {
  const byYear = allocateByYear(amountUsd, acquired, end);
  const dueCurrent = `${currentYear + 1}-04-15`;
  let ordinary = 0;
  let missingRates = false;
  const rows: Section1291Row[] = [];
  for (const [y, allocated] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (y >= currentYear) { ordinary += allocated; continue; }
    const rate = highestRate(y);
    if (rate === null) { missingRates = true; continue; }
    const increase = allocated * rate;
    const ft = foreignTaxUsd * (allocated / amountUsd);
    const net = Math.max(0, increase - ft);
    const factor = interestFactor(`${y + 1}-04-15`, dueCurrent);
    if (factor === null) missingRates = true;
    rows.push({ year: y, allocated, rate, increase, foreignTax: Math.min(ft, increase), netIncrease: net, interest: factor === null ? 0 : net * (factor - 1) });
  }
  const sum = (k: keyof Section1291Row) => rows.reduce((a, r) => a + (r[k] as number), 0);
  return { ordinary, increase: sum('increase'), foreignTaxCredit: sum('foreignTax'), netIncrease: sum('netIncrease'), interest: sum('interest'), rows, missingRates };
}

export type PficAccount = 'taxable' | 'tfsa' | 'resp' | 'fhsa' | 'rrsp';
export type PficRegime = '1291' | 'mtm' | 'qef';

export interface PficFund {
  id: string;
  /** Copied from this tax year: this year's value and distributions still need entering or confirming. */
  carried?: number;
  owner: 'taxpayer' | 'spouse' | 'joint';
  name: string;
  /** Fund company address (Form 8621 header). */
  address?: string;
  account: PficAccount;
  regime: PficRegime;
  /** Date of the first purchase still held (holding period start for distributions). */
  acquired: string;
  sharesYearEnd: number;
  valueYearEndCad: number;
  /** This year's distributions with their dates (CAD). */
  distributions: { date: string; amountCad: number }[];
  /** Total distributions in each of the 3 years before this one, most recent first (CAD; nothing if not held). */
  priorDistributionsCad: number[];
  mtm?: { firstYear: number; basisUsdStart: number; sharesStart: number; unreversedUsd: number };
  qef?: { ordinaryEarningsCad: number; netCapitalGainCad: number; basisUsdStart: number; sharesStart: number; previouslyTaxedUsd: number };
  /** Slips (T3/T5) whose distributions are this fund's. */
  slipIds?: string[];
}

/** A sale of fund units (from the sales list, linked by fund id). */
export interface PficSale { date: string; acquired: string; shares: number; proceedsCad: number; costCad: number }

export interface PficItem { kind: 'dividend' | 'ordinary' | 'capitalLoss' | 'qefCapitalGain'; usd: number; cad: number; description: string; date?: string; acquired?: string; proceedsUsd?: number; basisUsd?: number }

export interface PficResult {
  fund: PficFund;
  /** Form 8621 is required (not covered by an exception). */
  mustFile: boolean;
  lines: Record<string, number>;
  /** Line 16 detail per excess distribution or disposition (attached statements). */
  details: { label: string; amountUsd: number; acquired: string; end: string; result: Section1291Result }[];
  items: PficItem[];
  /** Form 1040 line 16 additional tax ("1291TAX") and Schedule 2 line 17p interest. */
  deferredTax: number;
  interest: number;
  notes: string[];
}

const usdAt = (cad: number, iso: string, fallback: number) => cad / (dailyRate(iso)?.rate ?? fallback);

/**
 * `caTaxPerCad`: Canadian income tax per CAD of Canadian taxable income (the same apportionment the
 * foreign tax credit uses), so the Canadian tax on an excess distribution can reduce line 16c (line 16d).
 */
export function computePfic(year: TaxYear, fund: PficFund, sales: PficSale[], avgRate: number, caTaxPerCad = 0): PficResult {
  const L: Record<string, number> = {};
  const items: PficItem[] = [];
  const details: PficResult['details'] = [];
  const notes: string[] = [];
  const yearEnd = `${year}-12-31`;
  const totalDistCad = fund.distributions.reduce((a, d) => a + d.amountCad, 0);
  L['3'] = fund.sharesYearEnd;
  L['4'] = dollars(usdAt(fund.valueYearEndCad, yearEnd, avgRate));

  if (fund.account === 'rrsp') {
    return { fund, mustFile: false, lines: L, details, items, deferredTax: 0, interest: 0,
      notes: ['Held in an RRSP or RRIF: no Form 8621 (Reg. 1.1298-1(c)(4)) and no current US tax (Rev. Proc. 2014-55).'] };
  }

  let firstMtmYear1291 = false;
  if (fund.regime === '1291' || (fund.regime === 'mtm' && fund.mtm?.firstYear === year && fund.acquired < `${year}-01-01`)) {
    firstMtmYear1291 = fund.regime === 'mtm';
  }

  // ---- Distributions ----
  if (fund.regime === 'qef') {
    // Distributions out of previously taxed earnings are not taxed again (IRC 1293(c)).
    const q = fund.qef!;
    const distUsd = fund.distributions.reduce((a, d) => a + usdAt(d.amountCad, d.date, avgRate), 0);
    const pti = Math.max(0, q.previouslyTaxedUsd) + q.ordinaryEarningsCad / avgRate + q.netCapitalGainCad / avgRate;
    const taxable = Math.max(0, distUsd - pti);
    if (taxable > 0) items.push({ kind: 'dividend', usd: taxable, cad: taxable * avgRate, description: `${fund.name} distribution beyond QEF inclusions (Form 8621)` });
  } else if (totalDistCad > 0) {
    L['15a'] = totalDistCad;
    // No excess distribution in the year the holding period began (i8621, line 15a).
    const held = fund.acquired >= `${year}-01-01`;
    const priorYears = Math.min(3, Math.max(0, year - Number(fund.acquired.slice(0, 4))));
    let excessCad = 0;
    if (!held && priorYears > 0) {
      L['15b'] = fund.priorDistributionsCad.slice(0, priorYears).reduce((a, b) => a + b, 0);
      L['15c'] = L['15b'] / priorYears;
      L['15d'] = L['15c'] * 1.25;
      excessCad = Math.max(0, totalDistCad - L['15d']);
      L['15e1'] = excessCad;
    }
    const nonexcessCad = totalDistCad - excessCad;
    if (nonexcessCad > 0) items.push({ kind: 'dividend', usd: nonexcessCad / avgRate, cad: nonexcessCad, description: `${fund.name} distributions (Form 8621, non-excess)` });
    if (excessCad > 0) {
      // Excess figured in CAD, apportioned among the actual distributions, each part translated on its date.
      let excessUsd = 0;
      for (const d of fund.distributions) {
        const part = excessCad * (d.amountCad / totalDistCad);
        const usd = usdAt(part, d.date, avgRate);
        excessUsd += usd;
        const taxUsd = usdAt(part * caTaxPerCad, d.date, avgRate);
        details.push({ label: `Excess distribution ${d.date}`, amountUsd: usd, acquired: fund.acquired, end: d.date, result: section1291(year, usd, fund.acquired, d.date, taxUsd) });
      }
      L['15e2'] = dollars(excessUsd);
      if (fund.distributions.length === 1 && fund.distributions[0].date === yearEnd) notes.push('Lou assumed one distribution on December 31. Enter each distribution date for an exact excess distribution.');
    }
  }

  // ---- Dispositions ----
  let gainTotal = 0;
  for (const s of sales) {
    const proceedsUsd = usdAt(s.proceedsCad, s.date, avgRate);
    const costUsd = usdAt(s.costCad, s.acquired, avgRate);
    const gain = proceedsUsd - costUsd;
    if (fund.regime === 'qef') {
      // Adjusted basis: cost plus earlier QEF inclusions, less distributions of them (IRC 1293(d)).
      const q = fund.qef!;
      const basis = q.sharesStart > 0 ? (q.basisUsdStart / q.sharesStart) * s.shares : costUsd;
      items.push({ kind: 'capitalLoss', usd: proceedsUsd - basis, cad: s.proceedsCad - s.costCad, description: `${fund.name} (QEF) units`, date: s.date, acquired: s.acquired, proceedsUsd, basisUsd: basis });
      continue;
    }
    if (fund.regime === 'mtm' && !firstMtmYear1291) {
      const m = fund.mtm!;
      const basis = m.sharesStart > 0 ? (m.basisUsdStart / m.sharesStart) * s.shares : costUsd;
      const g = proceedsUsd - basis;
      L['13a'] = (L['13a'] ?? 0) + proceedsUsd; L['13b'] = (L['13b'] ?? 0) + basis; L['13c'] = (L['13c'] ?? 0) + g;
      if (g >= 0) items.push({ kind: 'ordinary', usd: g, cad: g * avgRate, description: `${fund.name} mark-to-market gain on sale (Form 8621)` });
      else {
        const share = m.sharesStart > 0 ? m.unreversedUsd * (s.shares / m.sharesStart) : 0;
        const ordinaryLoss = Math.min(-g, share);
        L['14a'] = (L['14a'] ?? 0) + share; L['14b'] = (L['14b'] ?? 0) + ordinaryLoss; L['14c'] = (L['14c'] ?? 0) + (-g - ordinaryLoss);
        items.push({ kind: 'ordinary', usd: -ordinaryLoss, cad: -ordinaryLoss * avgRate, description: `${fund.name} mark-to-market loss on sale (Form 8621)` });
        if (-g > ordinaryLoss) items.push({ kind: 'capitalLoss', usd: g + ordinaryLoss, cad: (g + ordinaryLoss) * avgRate, description: `${fund.name} units (loss beyond MTM inclusions)`, date: s.date, acquired: s.acquired, proceedsUsd, basisUsd: proceedsUsd - (g + ordinaryLoss) });
      }
      continue;
    }
    // Section 1291: gains are excess distributions; losses follow the normal rules (Form 8949).
    if (gain > 0) {
      gainTotal += gain;
      details.push({ label: `Sale ${s.date}`, amountUsd: gain, acquired: s.acquired, end: s.date, result: section1291(year, gain, s.acquired, s.date) });
    } else if (gain < 0) {
      items.push({ kind: 'capitalLoss', usd: gain, cad: s.proceedsCad - s.costCad, description: `${fund.name} units (section 1291 fund)`, date: s.date, acquired: s.acquired, proceedsUsd, basisUsd: costUsd });
    }
  }
  if (gainTotal) L['15f'] = dollars(gainTotal);

  // ---- Mark-to-market at year end (Part IV, lines 10a-12) ----
  if (fund.regime === 'mtm' && fund.mtm) {
    const m = fund.mtm;
    const soldShares = sales.reduce((a, s) => a + s.shares, 0);
    const basis = m.sharesStart > 0 ? m.basisUsdStart * Math.max(0, (m.sharesStart - soldShares) / m.sharesStart) : m.basisUsdStart;
    const fmv = usdAt(fund.valueYearEndCad, yearEnd, avgRate);
    const change = fmv - basis;
    if (firstMtmYear1291) {
      // First MTM year for stock held before: the gain is taxed under section 1291 (IRC 1296(j)).
      if (change > 0) details.push({ label: `First mark-to-market year ${year}`, amountUsd: change, acquired: fund.acquired, end: yearEnd, result: section1291(year, change, fund.acquired, yearEnd) });
      notes.push('First mark-to-market year for units held before: the gain is taxed under section 1291 this year (Part V); later years use Part IV.');
    } else {
      L['10a'] = dollars(fmv); L['10b'] = dollars(basis); L['10c'] = dollars(change);
      if (change >= 0) items.push({ kind: 'ordinary', usd: change, cad: change * avgRate, description: `${fund.name} mark-to-market gain (Form 8621)` });
      else {
        L['11'] = dollars(m.unreversedUsd);
        L['12'] = dollars(Math.min(-change, m.unreversedUsd));
        if (L['12']) items.push({ kind: 'ordinary', usd: -L['12'], cad: -L['12'] * avgRate, description: `${fund.name} mark-to-market loss (Form 8621)` });
      }
    }
  }

  // ---- QEF inclusions (Part III) ----
  if (fund.regime === 'qef' && fund.qef) {
    notes.push('Lou assumes the QEF election has applied since your first year holding this fund. If you made it later, a purging election (Form 8621 Part II, box D or E) is needed first; have it reviewed.');
    L['6a'] = dollars(fund.qef.ordinaryEarningsCad / avgRate); L['6c'] = L['6a'];
    L['7a'] = dollars(fund.qef.netCapitalGainCad / avgRate); L['7c'] = L['7a'];
    if (L['6c']) items.push({ kind: 'ordinary', usd: L['6c'], cad: fund.qef.ordinaryEarningsCad, description: `${fund.name} QEF ordinary earnings (Form 8621 line 6c)` });
    if (L['7c']) items.push({ kind: 'qefCapitalGain', usd: L['7c'], cad: fund.qef.netCapitalGainCad, description: `${fund.name} QEF net capital gain (Form 8621 line 7c)` });
  }

  // ---- Line 16 totals ----
  const r = details.map((d) => d.result);
  if (r.length) {
    L['16b'] = dollars(r.reduce((a, x) => a + x.ordinary, 0));
    L['16c'] = dollars(r.reduce((a, x) => a + x.increase, 0));
    L['16d'] = dollars(r.reduce((a, x) => a + x.foreignTaxCredit, 0));
    L['16e'] = L['16c'] - L['16d'];
    L['16f'] = dollars(r.reduce((a, x) => a + x.interest, 0));
    if (L['16b']) items.push({ kind: 'ordinary', usd: L['16b'], cad: L['16b'] * avgRate, description: `${fund.name} section 1291 ordinary income (Form 8621 line 16b)` });
    notes.push('If you became a US citizen or green card holder after buying these units, the holding period used here may differ; have line 16 reviewed.');
    if (r.some((x) => x.missingRates)) notes.push('Part of the holding period is outside the IRS rate tables Lou carries (before 1987, or interest quarters not yet published). Check line 16 by hand.');
  }

  L['5a'] = fund.regime === '1291' || firstMtmYear1291 ? dollars((L['15e2'] ?? 0) + (L['15f'] ?? 0) + (firstMtmYear1291 ? details.reduce((a, d) => a + (d.label.startsWith('First') ? d.amountUsd : 0), 0) : 0)) : 0;
  L['5b'] = fund.regime === 'qef' ? (L['6c'] ?? 0) + (L['7c'] ?? 0) : 0;
  L['5c'] = fund.regime === 'mtm' && !firstMtmYear1291 ? (L['10c'] ?? 0) + (L['13c'] ?? 0) : 0;

  return { fund, mustFile: true, lines: L, details, items, deferredTax: L['16e'] ?? 0, interest: L['16f'] ?? 0, notes };
}

/**
 * Applies the $25,000 ($50,000 joint) exception (Reg. 1.1298-1(c)(2)): no Form 8621 for a section 1291
 * fund when all PFIC stock is worth that or less at year end and the fund had no excess distribution
 * or recognized gain. QEF and MTM funds always file.
 */
export function applyFilingException(results: PficResult[], joint: boolean): void {
  const total = results.filter((r) => r.fund.account !== 'rrsp').reduce((a, r) => a + (r.lines['4'] ?? 0), 0);
  if (total > (joint ? 50000 : 25000)) return;
  for (const r of results) {
    if (r.fund.regime === '1291' && !r.lines['15e2'] && !r.lines['15f'] && r.fund.account !== 'rrsp') {
      r.mustFile = false;
      r.notes.push(`All your PFIC holdings are worth $${total.toLocaleString('en-US')} or less at year end with no excess distribution or gain, so this fund needs no Form 8621 (Reg. 1.1298-1(c)(2)).`);
    }
  }
}
