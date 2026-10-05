// Alternative minimum tax (Form 6251), implemented line-for-line from the IRS
// Instructions for Form 6251 (2023, 2024, 2025): Part I, the Exemption Worksheet,
// Part II, Part III (maximum capital gains rates), the Foreign Earned Income Tax
// Worksheet for line 7, and the AMT foreign tax credit (a separate "AMT" Form 1116
// per category, Steps 1-6 under "Line 8"). Whole US dollars throughout.

import type { CarryoverVintage, Flag, IncomeItem } from './model';
import { scheduleB1116, type Form1116, type Category, type ScheduleB1116 } from './compute';
import { dollars, type Line16Result } from './taxComputation';
import { statusKey, YEARS, type FilingStatus, type TaxYear } from './years';

/** Form 6251 constants, read from each year's form and its Exemption Worksheet. */
export const AMT = {
  2025: { exemption: { single: 88100, mfj: 137000, mfs: 68500 }, phaseOut: { single: 626350, mfj: 1252700, mfs: 626350 }, breakpoint: 239100, subtract: 4782 },
  2024: { exemption: { single: 85700, mfj: 133300, mfs: 66650 }, phaseOut: { single: 609350, mfj: 1218700, mfs: 609350 }, breakpoint: 232600, subtract: 4652 },
  2023: { exemption: { single: 81300, mfj: 126500, mfs: 63250 }, phaseOut: { single: 578150, mfj: 1156300, mfs: 578150 }, breakpoint: 220700, subtract: 4414 },
} as const;

/** Form 6251 groups head of household with single, and qualifying surviving spouse with joint. */
const amtKey = (s: FilingStatus): 'single' | 'mfj' | 'mfs' => (s === 'mfj' || s === 'qss' ? 'mfj' : s === 'mfs' ? 'mfs' : 'single');

/** 26% / 28% tax used on lines 7, 18 and 39 (and the line 7 worksheet). MFS uses half the breakpoint and subtraction. */
export function amtRateTax(year: TaxYear, status: FilingStatus, amount: number): number {
  const c = AMT[year];
  const half = status === 'mfs' ? 2 : 1;
  const x = Math.max(0, amount);
  return dollars(x <= c.breakpoint / half ? x * 0.26 : x * 0.28 - c.subtract / half);
}

/** Form 6251 Part III, lines 12-40. Lou has no Schedule D (capital gain distributions only), so line 14 is 0. */
export function amtPart3(year: TaxYear, status: FilingStatus, l12: number, l13: number, qdcgLine5: number): Record<string, number> {
  const k = statusKey(status);
  const Y = YEARS[year];
  const L: Record<string, number> = {};
  L['12'] = l12;
  L['13'] = l13;
  L['14'] = 0;
  L['15'] = L['13']; // no Schedule D Tax Worksheet
  L['16'] = Math.min(L['12'], L['15']);
  L['17'] = L['12'] - L['16'];
  L['18'] = amtRateTax(year, status, L['17']);
  L['19'] = Y.qdcgZeroMax[k];
  L['20'] = Math.max(0, qdcgLine5);
  L['21'] = Math.max(0, L['19'] - L['20']);
  L['22'] = Math.min(L['12'], L['13']);
  L['23'] = Math.min(L['21'], L['22']);
  L['24'] = L['22'] - L['23'];
  L['25'] = Y.qdcgFifteenMax[k];
  L['26'] = L['21'];
  L['27'] = Math.max(0, qdcgLine5);
  L['28'] = L['26'] + L['27'];
  L['29'] = Math.max(0, L['25'] - L['28']);
  L['30'] = Math.min(L['24'], L['29']);
  L['31'] = dollars(L['30'] * 0.15);
  L['32'] = L['23'] + L['30'];
  if (L['32'] !== L['12']) {
    L['33'] = L['22'] - L['32'];
    L['34'] = dollars(L['33'] * 0.2);
  }
  // Lines 35-37 are skipped: line 14 is zero.
  L['38'] = L['18'] + L['31'] + (L['34'] ?? 0);
  L['39'] = amtRateTax(year, status, L['12']);
  L['40'] = Math.min(L['38'], L['39']);
  return L;
}

export interface AmtInput {
  year: TaxYear;
  status: FilingStatus;
  f1040: Record<string, number>;
  schedule1a: Record<string, number>;
  schedule2: Record<string, number>;
  schedule3: Record<string, number>;
  line16: Line16Result;
  feieExcluded: number;
  /** Form 2555 line 43 (gross exclusion) and line 44 (disallowed expenses), all people. */
  feieGross?: number;
  feieDisallowed?: number;
  taxed: IncomeItem[];
  /** Net capital gain used by the Qualified Dividends and Capital Gain Tax Worksheet (line 3). */
  netCapitalGain?: number;
  /** Regular-tax Forms 1116 (taxes available by category). */
  f1116: Form1116[];
  /** The user qualifies for and chose the Form 1116 adjustment exception (same election as for the regular tax). */
  adjustmentException: boolean;
  /** Unused AMT foreign tax credit from earlier years, by year of origin (kept apart from the regular carryover). */
  amtCarryover?: CarryoverVintage[];
}

export interface AmtForm1116 { category: Category; lines: Record<string, number>; scheduleB?: ScheduleB1116 }

export interface AmtResult {
  /** Form 6251 lines ('1a', '4', ..., '40'). */
  lines: Record<string, number>;
  /** Foreign Earned Income Tax Worksheet (line 7), when Form 2555 is filed. */
  feitw?: Record<string, number>;
  /**
   * AMT Forms 1116, one per category. Always figured when there is foreign tax, because the
   * AMT foreign tax credit carryover comes from them; line 8 uses them only when line 10 < line 7.
   */
  f1116: AmtForm1116[];
  amt: number;
  /** Form 6251 must be attached (Who Must File, statement 1: line 7 is more than line 10). */
  mustFile: boolean;
  flags: Flag[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function computeAmt(a: AmtInput): AmtResult {
  const { year, status, f1040 } = a;
  const C = AMT[year];
  const key = amtKey(status);
  const flags: Flag[] = [];
  const L: Record<string, number> = {};

  // ---- Part I ----
  if (year === 2025) {
    L['1a'] = f1040['14'] - (a.schedule1a['37'] ?? 0);
    L['1b'] = f1040['11b'] - L['1a'];
  } else {
    // 2023/2024 line 1: Form 1040 line 15 if more than zero, else line 11 minus line 14.
    L['1'] = f1040['15'] > 0 ? f1040['15'] : f1040['11a'] - f1040['14'];
  }
  L['2a'] = f1040['12e']; // standard deduction (no Schedule A in Lou)
  L['4'] = (year === 2025 ? L['1b'] : L['1']) + L['2a'];
  if (status === 'mfs') {
    // Line 4 instructions: MFS adds 25% of the excess over (phase-out + 4 x exemption), up to the exemption.
    const over = C.phaseOut.mfs + 4 * C.exemption.mfs;
    if (L['4'] > over) L['4'] += Math.min(C.exemption.mfs, dollars((L['4'] - over) * 0.25));
  }

  // ---- Part II ----
  const reduction = dollars(Math.max(0, L['4'] - C.phaseOut[key]) * 0.25);
  L['5'] = Math.max(0, C.exemption[key] - reduction);
  L['6'] = Math.max(0, L['4'] - L['5']);
  L['10'] = Math.max(0, f1040['16'] + (a.schedule2['1z'] ?? 0) - (a.schedule3['1'] ?? 0));
  const qd = f1040['3a'];
  const cgd = a.netCapitalGain ?? f1040['7a'];
  const pref = qd + cgd;
  const ws = a.line16.worksheet;
  let feitw: Record<string, number> | undefined;
  let p3: Record<string, number> | undefined;

  if (L['6'] === 0) {
    L['7'] = 0; // line 6 zero: enter -0- on lines 7, 9 and 11
  } else if (a.feieExcluded > 0) {
    // Foreign Earned Income Tax Worksheet, line 7.
    const W: Record<string, number> = {};
    W['1'] = L['6'];
    W['2a'] = a.feieExcluded;
    W['2b'] = 0;
    W['2c'] = Math.max(0, W['2a'] - W['2b']);
    W['3'] = W['1'] + W['2c'];
    if (pref > 0) {
      // Part III with the Form 2555 modifications: line 13 drops the AMT capital gain excess
      // (AMT QDCG line 4 minus Form 6251 line 6). Lines 20/27 use the regular-tax QDCG line 5
      // (which already reflects the regular capital gain excess), or FEITW line 3 if none.
      const excess = Math.max(0, pref - L['6']);
      const qdcg5 = ws['qdcg5'] ?? a.line16.worksheet['3'] ?? 0;
      p3 = amtPart3(year, status, W['3'], Math.max(0, pref - excess), qdcg5);
      W['4'] = p3['40'];
    } else {
      W['4'] = amtRateTax(year, status, W['3']);
    }
    W['5'] = amtRateTax(year, status, W['2c']);
    W['6'] = Math.max(0, W['4'] - W['5']);
    L['7'] = W['6'];
    feitw = W;
  } else if (pref > 0) {
    // QDCG line 5 as figured for the regular tax; Form 1040 line 15 when no worksheet was completed.
    const qdcg5 = a.line16.method === 'qdcg' ? ws[5] : Math.max(0, f1040['15']);
    p3 = amtPart3(year, status, L['6'], pref, qdcg5);
    L['7'] = p3['40'];
  } else {
    L['7'] = amtRateTax(year, status, L['6']);
  }
  if (p3) Object.assign(L, p3);

  // ---- Line 8: AMT foreign tax credit ----
  const f1116: AmtForm1116[] = [];
  L['8'] = 0;
  {
    // Steps 2 and 4: adjust foreign qualified dividends / capital gain distributions when
    // line 38 < line 39 and line 17 > 0, unless the adjustment exception applies and line 17
    // is not over the 26% breakpoint.
    const breakpoint = C.breakpoint / (status === 'mfs' ? 2 : 1);
    const mustAdjust = !!p3 && p3['38'] < p3['39'] && p3['17'] > 0;
    const adjust = mustAdjust && !(a.adjustmentException && p3!['17'] <= breakpoint);
    // 0% part left out, 15% part x 0.5357, 20% part x 0.7143; any part taxed at ordinary AMT rates is not adjusted.
    const prefFactor = adjust && pref > 0
      ? (p3!['30'] * 0.5357 + (p3!['33'] ?? 0) * 0.7143 + Math.max(0, pref - p3!['22'])) / pref : 1;
    // AMT Worksheet for Line 18 (i1116 Worksheet for Line 18 with the AMT substitutions).
    const line18 = adjust
      ? Math.max(0, L['4'] - dollars((p3!['33'] ?? 0) * 0.2857 + p3!['30'] * 0.4643 + p3!['23']))
      : L['4'];

    for (const reg of a.f1116) {
      const cat = reg.category;
      const items = a.taxed.filter((i) => i.category === cat && !i.usSource);
      const prefOf = (i: IncomeItem) => (i.qualifiedDividend || i.usLine === 'sd_13' ? i.usd : i.prefUsd ?? 0);
      const prefIn = sum(items.map(prefOf));
      const otherIn = sum(items.map((i) => (i.grossUsd ?? i.usd) - prefOf(i)));
      const excludedHere = cat === 'general' ? a.feieGross ?? a.feieExcluded : 0;
      const F: Record<string, number> = {};
      // Part I: no standard deduction for the AMT, so nothing is apportioned on lines 3a-3g.
      F['1a'] = dollars(otherIn - excludedHere + prefIn * prefFactor);
      // Line 2 (business expenses) is the only deduction; lines 3a-3g stay empty.
      F['2'] = dollars(sum(items.map((i) => i.expensesUsd ?? 0)) - (cat === 'general' ? a.feieDisallowed ?? 0 : 0));
      F['6'] = F['2'];
      F['7'] = F['1a'] - F['6'];
      // Part II/III: same foreign taxes as the regular Form 1116; line 10 is the AMT carryover (i6251 Step 3).
      F['8'] = reg.lines['8'];
      F['9'] = reg.lines['9'];
      const vintages = new Map<number, number>();
      for (const v of a.amtCarryover ?? []) {
        if (v.year >= year - 10 && v.year < year) vintages.set(v.year, (vintages.get(v.year) ?? 0) + dollars(v[cat]));
      }
      F['10'] = sum([...vintages.values()]);
      F['11'] = F['9'] + F['10'];
      F['12'] = reg.lines['12'];
      F['13'] = 0;
      F['14'] = F['11'] - F['12'] + F['13'];
      F['15'] = F['7'];
      F['16'] = 0;
      F['17'] = F['15'] + F['16'];
      F['18'] = line18;
      F['19'] = F['17'] <= 0 || F['18'] <= 0 ? 0 : Math.min(1, Math.round((F['17'] / F['18']) * 10000) / 10000);
      F['20'] = L['7'];
      F['21'] = dollars(F['20'] * F['19']);
      F['22'] = 0;
      F['23'] = F['21'] + F['22'];
      F['24'] = Math.max(0, Math.min(F['14'], F['23']));
      const schB = scheduleB1116(year, F, vintages);
      f1116.push({ category: cat, lines: F, scheduleB: F['10'] > 0 || schB.cols[0].l6 > 0 ? schB : undefined });
    }
    // Line 8 is left blank unless line 10 is less than line 7.
    if (L['10'] < L['7']) L['8'] = Math.min(L['7'], sum(f1116.map((f) => f.lines['24'])));
  }
  L['9'] = L['7'] - L['8'];
  L['11'] = Math.max(0, L['9'] - L['10']);

  const mustFile = L['7'] > L['10'];
  const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
  if (L['11'] > 0) flags.push({ id: 'amt-owed', severity: 'warn',
    title: `The alternative minimum tax adds ${usd(L['11'])}`,
    detail: 'Form 6251 shows a minimum tax higher than your regular tax after the foreign tax credit. Lou adds the difference on Schedule 2, line 2. Review Form 6251 and the AMT Form 1116 before filing.' });
  else if (mustFile) flags.push({ id: 'amt-attached', severity: 'info',
    title: 'Form 6251 is included, and adds no tax',
    detail: 'At your income the IRS asks you to attach Form 6251 (alternative minimum tax). Your Canadian tax also counts against it, so the result is $0.' });

  return { lines: L, feitw, f1116, amt: L['11'], mustFile, flags };
}
