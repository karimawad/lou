// Plain-language "where this goes on the US return" for each slip box:
// a short destination plus the reason, shown separately.

import { boxDef, type SlipType, type Treatment } from '../tax/slips';

export const NOA_LINES: { box: string; label: string; quebecOnly?: boolean }[] = [
  { box: '15000', label: 'Total income' },
  { box: '23600', label: 'Net income' },
  { box: '42000', label: 'Net federal tax' },
  { box: '42800', label: 'Net provincial or territorial tax' },
  { box: '44000', label: 'Refundable Quebec abatement', quebecOnly: true },
  { box: 'QC432', label: 'Quebec income tax (TP-1, line 432)', quebecOnly: true },
];

/** T1 lines Lou reads that aren't used on the US forms, named for the guide and the review package. */
const OTHER_T1_LINES: Record<string, string> = { '26000': 'Taxable income', '43500': 'Total payable', '43700': 'Total income tax deducted' };

/** The printed name of a T1 / Notice of Assessment line. */
export function t1LineLabel(box: string, incomeLines: { box: string; label: string }[] = []): string {
  return NOA_LINES.find((l) => l.box === box)?.label ?? incomeLines.find((l) => l.box === box)?.label ?? OTHER_T1_LINES[box] ?? `Line ${box}`;
}

const WHERE: Record<Treatment, string> = {
  wages: 'Form 1040, line 1h',
  interest: 'Schedule B → Form 1040, line 2b',
  dividend: 'Schedule B → Form 1040, line 3b',
  capitalGainDist: 'Form 1040, line 7a',
  pension: 'Form 1040, lines 5a and 5b',
  unemployment: 'Schedule 1, line 7',
  otherIncome: 'Schedule 1, line 8z',
  canadianSocialSecurity: 'Exempt by treaty (Form 8833)',
  canadianTaxInfo: 'Not on the US return',
  info: 'Not on the US return',
  review: 'Needs a decision',
};

const WHY: Partial<Record<Treatment, string>> = {
  wages: 'Wages from an employer that doesn’t issue a W-2. Counts in the general category of your foreign tax credit.',
  interest: 'Passive category of your foreign tax credit.',
  dividend: 'Passive category of your foreign tax credit. Also line 3a if the dividends are qualified.',
  canadianSocialSecurity: 'You can switch to including it on the questions step.',
  canadianTaxInfo: 'This is tax withheld, not your final tax. The credit uses your Notice of Assessment.',
  review: 'Lou can’t place it automatically. It’s listed in your mapping guide.',
};

/** Primary sources for each treatment, shown under the destination. Texts are in research/instr and research/treaty. */
const SOURCE: Partial<Record<Treatment, string>> = {
  wages: 'Form 1040 instructions, lines 1a and 1h (line 1a is W-2 box 1 only); Pub. 54 (2025), Foreign Earned Income, question 3',
  interest: 'Schedule B instructions, Part I; Form 1116 instructions, passive category income',
  dividend: 'Schedule B instructions, Part II; IRC 1(h)(11) (qualified dividends from a company in a treaty country)',
  capitalGainDist: 'Form 1040 instructions, line 7; Schedule D instructions',
  pension: 'Pub. 597 (RRSPs and RRIFs); Rev. Proc. 2014-55; Form 1040 instructions, lines 5a and 5b',
  unemployment: 'IRC 85 (unemployment compensation); Form 1040 instructions, Schedule 1 line 7',
  otherIncome: 'Form 1040 instructions, Schedule 1 line 8z',
  canadianSocialSecurity: 'US-Canada tax treaty, Art. XVIII(5); Treas. Reg. 301.6114-1(c)(1)(iv) (Form 8833 disclosure)',
  canadianTaxInfo: 'Form 1116 instructions, Part II (foreign taxes paid or accrued for the year, not amounts withheld)',
};

/** Treatments that put an amount on the US return (so a USD figure is meaningful). */
export const COUNTS_ON_RETURN = new Set<Treatment>(['wages', 'interest', 'dividend', 'capitalGainDist', 'pension', 'unemployment', 'otherIncome']);

export interface Destination { where: string; why?: string; treatment: Treatment | 'noa'; source?: string }

export function destination(type: SlipType, box: string, opts: { socialSecurityExempt?: boolean } = {}): Destination {
  if (type === 'NOA') {
    const general = box === '15000' || box === '23600';
    if (!general && !['42000', '42800', '44000', 'QC432'].includes(box)) {
      return { where: 'For reference', why: 'Read from your return; not used on the US forms.', treatment: 'noa' };
    }
    return {
      where: general ? 'Checks your slips are complete' : 'Form 1116, Part II',
      why: general ? 'Also used to split Canadian tax between the two foreign tax credit categories.' : 'Canadian income tax you can credit against US tax.',
      treatment: 'noa',
      source: general ? 'Treas. Reg. 1.904-6 (foreign tax split between categories by income)' : 'IRC 901; Form 1116 instructions, Part II',
    };
  }
  const def = boxDef(type, box);
  if (!def) return { where: 'Unknown box', treatment: 'review' };
  if (def.treatment === 'canadianSocialSecurity' && opts.socialSecurityExempt === false) {
    return { where: 'Schedule 1, line 8z', why: 'You chose to include it. Canadian tax on it still counts toward the credit.', treatment: 'otherIncome', source: SOURCE.otherIncome };
  }
  const why = [WHY[def.treatment], def.note].filter(Boolean).join(' ');
  return { where: WHERE[def.treatment], why: why || undefined, treatment: def.treatment, source: SOURCE[def.treatment] };
}

/** One-line version for tables. */
export const destinationText = (d: Destination) => (d.why ? `${d.where}. ${d.why}` : d.where);
