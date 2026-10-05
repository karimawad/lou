import { describe, expect, it } from 'vitest';
import { line16Tax, qdcgWorksheet, regularTax, taxTableRow } from './taxComputation';
import { bracketRows, type TaxYear } from './years';
import t2023 from './__fixtures__/taxTable-2023.json';
import t2024 from './__fixtures__/taxTable-2024.json';
import t2025 from './__fixtures__/taxTable-2025.json';

// Fixtures are parsed straight from the official IRS Instructions for Form 1040 Tax Table.
const TABLES: Record<TaxYear, number[][]> = { 2023: t2023, 2024: t2024, 2025: t2025 };
const COLS = ['single', 'mfj', 'mfs', 'hoh'] as const;

describe('regularTax matches every row of the official IRS Tax Table', () => {
  for (const year of [2023, 2024, 2025] as TaxYear[]) {
    it(`${year}: all ${TABLES[year].length} rows x 4 filing statuses`, () => {
      const misses: string[] = [];
      for (const [lo, hi, ...taxes] of TABLES[year]) {
        expect(taxTableRow(lo)).toEqual([lo, hi]);
        COLS.forEach((status, i) => {
          for (const x of [lo, hi - 1]) {
            if (x === 0) continue;
            const got = regularTax(year, status, x);
            if (got !== taxes[i]) misses.push(`${status} ${x}: got ${got}, IRS ${taxes[i]}`);
          }
        });
      }
      expect(misses.slice(0, 10)).toEqual([]);
    });
  }
});

describe('Tax Computation Worksheet subtraction amounts match the IRS worksheet', () => {
  // Spot values copied from each year's Tax Computation Worksheet.
  const cases: [TaxYear, 'single' | 'mfj' | 'mfs' | 'hoh', number, number][] = [
    [2025, 'single', 0.24, 7153], [2025, 'single', 0.37, 42979.75], [2025, 'mfj', 0.35, 60905.5],
    [2025, 'mfs', 0.37, 37968.75], [2025, 'hoh', 0.32, 24676], [2025, 'hoh', 0.37, 44718],
    [2024, 'single', 0.35, 29625.25], [2024, 'mfj', 0.37, 73874.5], [2024, 'hoh', 0.24, 8651],
    [2023, 'single', 0.24, 6600], [2023, 'mfj', 0.22, 9385], [2023, 'hoh', 0.37, 41273.5], [2023, 'mfs', 0.37, 35043],
  ];
  for (const [year, status, rate, subtract] of cases) {
    it(`${year} ${status} ${rate}`, () => {
      const row = bracketRows(year, status).find((r) => r.rate === rate)!;
      expect(row.subtract).toBeCloseTo(subtract, 2);
    });
  }
  it('2025 single $100,000 = 100000*0.22 - 5086', () => {
    expect(regularTax(2025, 'single', 100000)).toBe(16914);
  });
});

describe('Qualified Dividends and Capital Gain Tax Worksheet', () => {
  it('all-ordinary income equals regular tax', () => {
    const r = qdcgWorksheet(2025, 'single', { taxableIncome: 80000, qualifiedDividends: 0, netCapitalGain: 0 });
    expect(r.tax).toBe(regularTax(2025, 'single', 80000));
  });
  it('dividends inside the 0% band are untaxed (2025 single)', () => {
    // 40,000 ordinary + 5,000 QD; 0% band runs to 48,350.
    const r = qdcgWorksheet(2025, 'single', { taxableIncome: 45000, qualifiedDividends: 5000, netCapitalGain: 0 });
    expect(r.lines[9]).toBe(5000);
    expect(r.tax).toBe(regularTax(2025, 'single', 40000));
  });
  it('dividends straddling the 0%/15% line (2025 mfj)', () => {
    // 90,000 ordinary + 20,000 QD: 6,700 at 0%, 13,300 at 15%.
    const r = qdcgWorksheet(2025, 'mfj', { taxableIncome: 110000, qualifiedDividends: 20000, netCapitalGain: 0 });
    expect(r.lines[9]).toBe(6700);
    expect(r.lines[17]).toBe(13300);
    expect(r.tax).toBe(Math.round(13300 * 0.15) + regularTax(2025, 'mfj', 90000));
  });
});

describe('Foreign Earned Income Tax Worksheet (stacking rule)', () => {
  it('remaining income is taxed at the rates that would apply without the exclusion', () => {
    // 2025 single: 130,000 excluded, 20,000 taxable.
    const r = line16Tax(2025, 'single', { taxableIncome: 20000, qualifiedDividends: 0, netCapitalGain: 0, feieExcluded: 130000 });
    expect(r.method).toBe('feitw');
    expect(r.tax).toBe(regularTax(2025, 'single', 150000) - regularTax(2025, 'single', 130000));
  });
  it('capital gain excess: preferential income cannot exceed taxable income', () => {
    // Taxable income 3,000, all from QD 10,000 offset by deductions -> excess 7,000.
    const r = line16Tax(2025, 'single', { taxableIncome: 3000, qualifiedDividends: 10000, netCapitalGain: 0, feieExcluded: 100000 });
    expect(r.method).toBe('feitw');
    // Second QDCG run uses QD reduced to 3,000 on line 1 = 103,000.
    const second = qdcgWorksheet(2025, 'single', { taxableIncome: 103000, qualifiedDividends: 3000, netCapitalGain: 0 });
    expect(r.tax).toBe(second.tax - regularTax(2025, 'single', 100000));
  });
});
