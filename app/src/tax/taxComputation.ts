// Form 1040 line 16 tax computation, implemented line-for-line from the IRS
// Instructions for Form 1040 (Tax Table, Tax Computation Worksheet, Qualified
// Dividends and Capital Gain Tax Worksheet, Foreign Earned Income Tax Worksheet).
// All amounts are whole US dollars.

import { bracketRows, statusKey, YEARS, type FilingStatus, type TaxYear } from './years';

/** Round to whole dollars, half away from zero (IRS rounding convention). */
export function dollars(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

function exactTax(year: TaxYear, status: FilingStatus, income: number): number {
  if (income <= 0) return 0;
  const rows = bracketRows(year, status);
  let row = rows[0];
  for (const r of rows) if (income > r.over) row = r;
  return income * row.rate - row.subtract;
}

/** Tax Table row [atLeast, lessThan) for incomes under $100,000. */
export function taxTableRow(income: number): [number, number] {
  if (income < 5) return [0, 5];
  if (income < 15) return [5, 15];
  if (income < 25) return [15, 25];
  if (income < 3000) {
    const lo = Math.floor(income / 25) * 25;
    return [lo, lo + 25];
  }
  const lo = Math.floor(income / 50) * 50;
  return [lo, lo + 50];
}

/**
 * Regular tax on an amount: Tax Table under $100,000 (tax on the row midpoint,
 * rounded), Tax Computation Worksheet at $100,000 or more.
 */
export function regularTax(year: TaxYear, status: FilingStatus, income: number): number {
  const x = Math.max(0, Math.floor(income));
  if (x === 0) return 0;
  if (x < 100000) {
    const [lo, hi] = taxTableRow(x);
    return dollars(exactTax(year, status, (lo + hi) / 2));
  }
  return dollars(exactTax(year, status, x));
}

export interface QdcgInput {
  /** Line 1: taxable income (or Foreign Earned Income Tax Worksheet line 3). */
  taxableIncome: number;
  /** Line 2: qualified dividends (Form 1040 line 3a). */
  qualifiedDividends: number;
  /** Line 3: smaller of Sch D line 15 or 16 (0 if loss), or line 7a if no Sch D. */
  netCapitalGain: number;
}

export interface QdcgResult { lines: Record<number, number>; tax: number }

/** Qualified Dividends and Capital Gain Tax Worksheet, lines 1-25. */
export function qdcgWorksheet(year: TaxYear, status: FilingStatus, input: QdcgInput): QdcgResult {
  const k = statusKey(status);
  const y = YEARS[year];
  const L: Record<number, number> = {};
  L[1] = Math.max(0, input.taxableIncome);
  L[2] = Math.max(0, input.qualifiedDividends);
  L[3] = Math.max(0, input.netCapitalGain);
  L[4] = L[2] + L[3];
  L[5] = Math.max(0, L[1] - L[4]);
  L[6] = y.qdcgZeroMax[k];
  L[7] = Math.min(L[1], L[6]);
  L[8] = Math.min(L[5], L[7]);
  L[9] = L[7] - L[8];
  L[10] = Math.min(L[1], L[4]);
  L[11] = L[9];
  L[12] = L[10] - L[11];
  L[13] = y.qdcgFifteenMax[k];
  L[14] = Math.min(L[1], L[13]);
  L[15] = L[5] + L[9];
  L[16] = Math.max(0, L[14] - L[15]);
  L[17] = Math.min(L[12], L[16]);
  L[18] = dollars(L[17] * 0.15);
  L[19] = L[9] + L[17];
  L[20] = L[10] - L[19];
  L[21] = dollars(L[20] * 0.2);
  L[22] = regularTax(year, status, L[5]);
  L[23] = L[18] + L[21] + L[22];
  L[24] = regularTax(year, status, L[1]);
  L[25] = Math.min(L[23], L[24]);
  return { lines: L, tax: L[25] };
}

export interface Line16Input {
  taxableIncome: number; // Form 1040 line 15
  qualifiedDividends: number; // line 3a
  /** Smaller of Sch D 15/16 (0 if either is a loss), or line 7a when Sch D isn't filed. */
  netCapitalGain: number;
  /** Form 2555 lines 45 + 50 (exclusions), 0 if no Form 2555. */
  feieExcluded: number;
  /** Deductions/exclusions disallowed because they relate to excluded income (FEITW 2b). */
  feieDisallowed?: number;
}

export interface Line16Result {
  tax: number;
  method: 'table' | 'tcw' | 'qdcg' | 'feitw';
  worksheet: Record<string, number>;
}

function hasPreferential(i: { qualifiedDividends: number; netCapitalGain: number }) {
  return i.qualifiedDividends > 0 || i.netCapitalGain > 0;
}

/** Form 1040 line 16 tax, choosing the method the instructions require. */
export function line16Tax(year: TaxYear, status: FilingStatus, input: Line16Input): Line16Result {
  const ti = Math.max(0, input.taxableIncome);
  if (ti === 0) return { tax: 0, method: 'table', worksheet: {} };

  if (input.feieExcluded > 0) {
    // Foreign Earned Income Tax Worksheet.
    const l2c = Math.max(0, input.feieExcluded - (input.feieDisallowed ?? 0));
    const l3 = ti + l2c;
    let l4: number;
    let qdcg5: number | undefined;
    if (hasPreferential(input)) {
      // Footnote procedure: run QDCG on line 3 through line 4, test for capital gain excess.
      const first = qdcgWorksheet(year, status, {
        taxableIncome: l3,
        qualifiedDividends: input.qualifiedDividends,
        netCapitalGain: input.netCapitalGain,
      });
      const excess = Math.max(0, first.lines[4] - ti);
      if (excess === 0) {
        l4 = first.tax;
        qdcg5 = first.lines[5];
      } else {
        // Modification 1: reduce line 3 by the excess; 2: reduce line 2 by any remainder.
        const netCg = Math.max(0, input.netCapitalGain - excess);
        const leftover = Math.max(0, excess - input.netCapitalGain);
        const qd = Math.max(0, input.qualifiedDividends - leftover);
        const second = qdcgWorksheet(year, status, { taxableIncome: l3, qualifiedDividends: qd, netCapitalGain: netCg });
        l4 = second.tax;
        qdcg5 = second.lines[5];
      }
    } else {
      l4 = regularTax(year, status, l3);
    }
    const l5 = regularTax(year, status, l2c);
    const l6 = Math.max(0, l4 - l5);
    // qdcg5: line 5 of the QDCG worksheet run inside this worksheet (Form 6251 lines 20 and 27 need it).
    const worksheet: Record<string, number> = { 1: ti, '2c': l2c, 3: l3, 4: l4, 5: l5, 6: l6 };
    if (qdcg5 !== undefined) worksheet.qdcg5 = qdcg5;
    return { tax: l6, method: 'feitw', worksheet };
  }

  if (hasPreferential(input)) {
    const r = qdcgWorksheet(year, status, {
      taxableIncome: ti,
      qualifiedDividends: input.qualifiedDividends,
      netCapitalGain: input.netCapitalGain,
    });
    return { tax: r.tax, method: 'qdcg', worksheet: r.lines };
  }
  return { tax: regularTax(year, status, ti), method: ti < 100000 ? 'table' : 'tcw', worksheet: {} };
}
