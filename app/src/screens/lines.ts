// Form 1040 line labels and year-specific numbering. The engine uses 2025
// numbering; 2023 and 2024 forms number a few lines differently (2025 added
// 11b, 12e and 13b). Verified against each year's Form 1040.

import type { TaxYear } from '../tax/years';

export const F1040_LABELS: Record<string, string> = {
  '1h': 'Other earned income (foreign wages)', '1z': 'Total wages', '2b': 'Taxable interest', '3a': 'Qualified dividends',
  '3b': 'Ordinary dividends', '5a': 'Pensions and annuities', '5b': 'Taxable pensions', '7a': 'Capital gain or (loss)',
  '8': 'Additional income (Schedule 1)', '9': 'Total income', '10': 'Adjustments to income', '11a': 'Adjusted gross income',
  '11b': 'Adjusted gross income (page 2)', '12e': 'Standard deduction', '13b': 'Additional deductions (Schedule 1-A)',
  '14': 'Total deductions', '15': 'Taxable income', '16': 'Tax', '17': 'Schedule 2, line 3', '18': 'Tax before credits',
  '19': 'Child tax credit', '20': 'Foreign tax credit (Schedule 3)', '21': 'Total credits', '22': 'Tax after credits',
  '23': 'Other taxes (Schedule 2)', '24': 'Total tax', '25d': 'US tax withheld', '28': 'Additional child tax credit',
  '32': 'Refundable credits', '33': 'Total payments', '34': 'Overpaid', '35a': 'Refund', '37': 'Amount you owe',
};

/** Printed line number on the given year's Form 1040, or null if the line doesn't exist that year. */
export function f1040Line(year: TaxYear, key: string): string | null {
  if (year === 2025) return key;
  const map: Record<string, string | null> = { '7a': '7', '27a': '27', '11a': '11', '11b': null, '12e': '12', '13a': '13', '13b': null };
  return key in map ? map[key] : key;
}

export const DISPLAY_ORDER = ['1h', '1z', '2b', '3a', '3b', '5a', '5b', '7a', '8', '9', '10', '11a', '12e', '13b', '14', '15', '16', '17',
  '18', '19', '20', '21', '22', '23', '24', '28', '33', '34', '35a', '37'];
