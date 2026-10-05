// Per-year US tax constants. Every figure is copied from an IRS primary source,
// cited next to it. Never edit a number here without re-checking the source.

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss';
export type TaxYear = 2023 | 2024 | 2025;
export const TAX_YEARS: TaxYear[] = [2025, 2024, 2023];

/** Tax Computation Worksheet row: tax = income * rate - subtract, for income over `over`. */
export interface BracketRow { over: number; rate: number; subtract: number }

export interface YearConstants {
  year: TaxYear;
  /** Upper bound of each bracket, ascending; rates are 10,12,22,24,32,35,37. */
  brackets: Record<'single' | 'mfj' | 'mfs' | 'hoh', number[]>;
  standardDeduction: Record<'single' | 'mfj' | 'mfs' | 'hoh', number>;
  /** Extra standard deduction per box checked (65+ or blind). */
  additionalStdDeduction: { unmarried: number; married: number };
  /** Born before this date counts as 65+ for the year. */
  seniorBornBefore: string;
  qdcgZeroMax: Record<'single' | 'mfj' | 'mfs' | 'hoh', number>;
  qdcgFifteenMax: Record<'single' | 'mfj' | 'mfs' | 'hoh', number>;
  /** Foreign earned income exclusion maximum (Form 2555). */
  feieMax: number;
  /** IRS yearly average CAD per 1 USD. Divide CAD by this to get USD. */
  irsAvgCadPerUsd: number;
  /** Treasury Reporting Rates of Exchange, Dec 31, CAD per 1 USD (FBAR / Form 8938 max values). */
  treasuryYearEndCadPerUsd: number;
  sources: string[];
}

const RATES = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];

export const YEARS: Record<TaxYear, YearConstants> = {
  2025: {
    year: 2025,
    // 2025 i1040gi Tax Computation Worksheet (p.80); Rev. Proc. 2024-40.
    brackets: {
      single: [11925, 48475, 103350, 197300, 250525, 626350],
      mfj: [23850, 96950, 206700, 394600, 501050, 751600],
      mfs: [11925, 48475, 103350, 197300, 250525, 375800],
      hoh: [17000, 64850, 103350, 197300, 250500, 626350],
    },
    // 2025 i1040gi line 12e (post-OBBBA amounts).
    standardDeduction: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625 },
    additionalStdDeduction: { unmarried: 2000, married: 1600 },
    seniorBornBefore: '1961-01-02',
    qdcgZeroMax: { single: 48350, mfj: 96700, mfs: 48350, hoh: 64750 },
    qdcgFifteenMax: { single: 533400, mfj: 600050, mfs: 300000, hoh: 566700 },
    feieMax: 130000,
    irsAvgCadPerUsd: 1.398,
    treasuryYearEndCadPerUsd: 1.369, // Treasury Reporting Rates of Exchange, 12/31/2025 (fiscaldata.treasury.gov)
    sources: ['IRS 2025 Instructions for Form 1040', 'Rev. Proc. 2024-40', 'irs.gov yearly-average-currency-exchange-rates'],
  },
  2024: {
    year: 2024,
    // 2024 i1040gi Tax Computation Worksheet; Rev. Proc. 2023-34.
    brackets: {
      single: [11600, 47150, 100525, 191950, 243725, 609350],
      mfj: [23200, 94300, 201050, 383900, 487450, 731200],
      mfs: [11600, 47150, 100525, 191950, 243725, 365600],
      hoh: [16550, 63100, 100500, 191950, 243700, 609350],
    },
    standardDeduction: { single: 14600, mfj: 29200, mfs: 14600, hoh: 21900 },
    additionalStdDeduction: { unmarried: 1950, married: 1550 },
    seniorBornBefore: '1960-01-02',
    qdcgZeroMax: { single: 47025, mfj: 94050, mfs: 47025, hoh: 63000 },
    qdcgFifteenMax: { single: 518900, mfj: 583750, mfs: 291850, hoh: 551350 },
    feieMax: 126500,
    irsAvgCadPerUsd: 1.37,
    treasuryYearEndCadPerUsd: 1.438, // Treasury Reporting Rates of Exchange, 12/31/2024
    sources: ['IRS 2024 Instructions for Form 1040', 'Rev. Proc. 2023-34', 'irs.gov yearly-average-currency-exchange-rates'],
  },
  2023: {
    year: 2023,
    // 2023 i1040gi Tax Computation Worksheet; Rev. Proc. 2022-38.
    brackets: {
      single: [11000, 44725, 95375, 182100, 231250, 578125],
      mfj: [22000, 89450, 190750, 364200, 462500, 693750],
      mfs: [11000, 44725, 95375, 182100, 231250, 346875],
      hoh: [15700, 59850, 95350, 182100, 231250, 578100],
    },
    standardDeduction: { single: 13850, mfj: 27700, mfs: 13850, hoh: 20800 },
    additionalStdDeduction: { unmarried: 1850, married: 1500 },
    seniorBornBefore: '1959-01-02',
    qdcgZeroMax: { single: 44625, mfj: 89250, mfs: 44625, hoh: 59750 },
    qdcgFifteenMax: { single: 492300, mfj: 553850, mfs: 276900, hoh: 523050 },
    feieMax: 120000,
    irsAvgCadPerUsd: 1.35,
    treasuryYearEndCadPerUsd: 1.326, // Treasury Reporting Rates of Exchange, 12/31/2023
    sources: ['IRS 2023 Instructions for Form 1040', 'Rev. Proc. 2022-38', 'irs.gov yearly-average-currency-exchange-rates'],
  },
};

/** Qualifying surviving spouse uses the married-filing-jointly figures everywhere here. */
export function statusKey(s: FilingStatus): 'single' | 'mfj' | 'mfs' | 'hoh' {
  return s === 'qss' ? 'mfj' : s;
}

/** Bracket rows in Tax Computation Worksheet form (tax = x*rate - subtract). */
export function bracketRows(year: TaxYear, status: FilingStatus): BracketRow[] {
  const tops = YEARS[year].brackets[statusKey(status)];
  const rows: BracketRow[] = [];
  let taxAtFloor = 0;
  let floor = 0;
  for (let i = 0; i < RATES.length; i++) {
    const rate = RATES[i];
    // Tax at x = taxAtFloor + (x - floor)*rate = x*rate - (floor*rate - taxAtFloor)
    rows.push({ over: floor, rate, subtract: floor * rate - taxAtFloor });
    if (i < tops.length) {
      taxAtFloor += (tops[i] - floor) * rate;
      floor = tops[i];
    }
  }
  return rows;
}

/**
 * US Treasury Reporting Rates of Exchange, CAD per USD, on December 31 (Bureau of the Fiscal
 * Service, fiscaldata.treasury.gov). FBAR and Form 8938 values use these, not the IRS yearly
 * average. Includes 2020-2022 for FBAR catch-up years under the Streamlined procedure.
 */
export const TREASURY_DEC31_CAD_PER_USD: Record<number, number> = {
  2020: 1.275, 2021: 1.277, 2022: 1.354, 2023: 1.326, 2024: 1.438, 2025: 1.369,
};
