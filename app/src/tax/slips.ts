// Catalog of Canadian tax slips and how each box is treated on a US return
// for a US person resident in Canada. Box labels come from the official CRA
// slips (research/cra/*-YYYY.pdf, back pages). US treatment cites IRS/treaty
// sources. When a box needs judgment, treatment is 'review' with a reason.

export type SlipType =
  | 'T4' | 'T4A' | 'T5' | 'T3' | 'T5008' | 'T4RSP' | 'T4RIF' | 'T4E'
  | 'T4AP' | 'T4AOAS' | 'T5007' | 'NOA';

/** What a box does on the US return. */
export type Treatment =
  | 'wages'            // Form 1040 line 1h, general category, foreign earned income
  | 'interest'         // Schedule B Part I -> 1040 line 2b, passive
  | 'dividend'         // Schedule B Part II -> 1040 line 3b (3a if qualified), passive
  | 'capitalGainDist'  // Schedule D line 13 (or 1040 line 7a), passive
  | 'pension'          // 1040 lines 5a/5b, general
  | 'unemployment'     // Schedule 1 line 7, general
  | 'otherIncome'      // Schedule 1 line 8z, general unless noted
  | 'canadianSocialSecurity' // CPP/QPP/OAS: treaty position (see notes)
  | 'canadianTaxInfo'  // Canadian tax amounts: used only as a cross-check; FTC uses the NOA
  | 'info'             // No US effect; shown so the user sees we read it
  | 'review';          // Needs a human decision; never silently included or dropped

export interface BoxDef {
  box: string;
  label: string;
  treatment: Treatment;
  /** Canadian taxable amount factor relative to this box (e.g. dividend gross-up), for FTC apportionment. */
  note?: string;
  /** Tax years this box exists on the slip (default: all supported years). */
  years?: number[];
}

export interface SlipDef {
  type: SlipType;
  name: string;
  issuer: string;
  boxes: BoxDef[];
  /** Plain-language summary of what the slip is. */
  about: string;
}

const T4: SlipDef = {
  type: 'T4',
  name: 'T4 - Statement of Remuneration Paid',
  issuer: 'Employer',
  about: 'Your salary, wages and taxable benefits from a Canadian employer.',
  boxes: [
    { box: '14', label: 'Employment income', treatment: 'wages',
      note: 'Already includes taxable benefits (codes 30-40).' },
    { box: '16', label: "Employee's CPP contributions", treatment: 'info',
      note: 'Not deductible and not creditable in the US (US-Canada Totalization Agreement).' },
    { box: '16A', label: "Employee's second CPP contributions", treatment: 'info', years: [2024, 2025] },
    { box: '17', label: "Employee's QPP contributions", treatment: 'info' },
    { box: '17A', label: "Employee's second QPP contributions", treatment: 'info', years: [2024, 2025] },
    { box: '18', label: "Employee's EI premiums", treatment: 'info', note: 'Social insurance, not income tax. Not creditable.' },
    { box: '20', label: 'RPP contributions', treatment: 'info',
      note: 'Not deducted on the US return by default. Treaty Art. XVIII(13) can allow a US deduction for an employer pension plan, filed with Form 8833.' },
    { box: '22', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
    { box: '24', label: 'EI insurable earnings', treatment: 'info' },
    { box: '26', label: 'CPP/QPP pensionable earnings', treatment: 'info' },
    { box: '38', label: 'Security options benefits', treatment: 'review',
      note: 'Already inside box 14. US timing for stock options can differ (ISO/NSO, vesting). Confirm before filing.' },
    { box: '39', label: 'Security options deduction 110(1)(d)', treatment: 'info', note: 'Canadian-only deduction. No US equivalent.' },
    { box: '41', label: 'Security options deduction 110(1)(d.1)', treatment: 'info', note: 'Canadian-only deduction. No US equivalent.' },
    { box: '44', label: 'Union dues', treatment: 'info', note: 'Not deductible on a US federal return.' },
    { box: '45', label: 'Employer-offered dental benefits', treatment: 'info' },
    { box: '46', label: 'Charitable donations', treatment: 'info',
      note: 'Canadian charities can be deductible only if you itemize (treaty Art. XXI(5)). Most expats take the standard deduction.' },
    { box: '52', label: 'Pension adjustment', treatment: 'info' },
    { box: '55', label: 'Provincial parental insurance plan (PPIP)', treatment: 'info' },
    { box: '66', label: 'Eligible retiring allowances', treatment: 'review', note: 'Severance. Taxable in the US; not in box 14.' },
    { box: '67', label: 'Non-eligible retiring allowances', treatment: 'review', note: 'Severance. Taxable in the US; not in box 14.' },
    { box: '85', label: 'Employee-paid premiums for private health services plans', treatment: 'info' },
  ],
};

const T5: SlipDef = {
  type: 'T5',
  name: 'T5 - Statement of Investment Income',
  issuer: 'Bank, broker or corporation',
  about: 'Interest and dividends paid to you by Canadian payers.',
  boxes: [
    { box: '24', label: 'Actual amount of eligible dividends', treatment: 'dividend',
      note: 'US uses the actual amount. Canada taxes 138% of it (box 25).' },
    { box: '25', label: 'Taxable amount of eligible dividends', treatment: 'info', note: 'Canadian gross-up. Never used on the US return.' },
    { box: '26', label: 'Dividend tax credit for eligible dividends', treatment: 'info' },
    { box: '10', label: 'Actual amount of dividends other than eligible dividends', treatment: 'dividend',
      note: 'US uses the actual amount. Canada taxes 115% of it (box 11).' },
    { box: '11', label: 'Taxable amount of dividends other than eligible dividends', treatment: 'info' },
    { box: '12', label: 'Dividend tax credit for dividends other than eligible dividends', treatment: 'info' },
    { box: '13', label: 'Interest from Canadian sources', treatment: 'interest' },
    { box: '14', label: 'Other income from Canadian sources', treatment: 'review' },
    { box: '15', label: 'Foreign income', treatment: 'review',
      note: 'Often US-source dividends held in a Canadian account. US-source income is not eligible for the US foreign tax credit.' },
    { box: '16', label: 'Foreign tax paid', treatment: 'review' },
    { box: '17', label: 'Royalties from Canadian sources', treatment: 'review' },
    { box: '18', label: 'Capital gains dividends', treatment: 'capitalGainDist',
      note: 'Usually paid by a mutual fund corporation, which is a PFIC for US purposes. Lou flags it for Form 8621.' },
    { box: '19', label: 'Accrued income: Annuities', treatment: 'review' },
    { box: '30', label: 'Equity linked notes interest', treatment: 'interest' },
  ],
};

const T3: SlipDef = {
  type: 'T3',
  name: 'T3 - Statement of Trust Income Allocations and Designations',
  issuer: 'Trust (most often a mutual fund trust or ETF)',
  about: 'Income from a trust. Nearly always a Canadian mutual fund or ETF, which the US treats as a PFIC.',
  boxes: [
    { box: '49', label: 'Actual amount of eligible dividends', treatment: 'review', note: 'From a fund: PFIC rules apply (Form 8621).' },
    { box: '23', label: 'Actual amount of dividends other than eligible dividends', treatment: 'review' },
    { box: '21', label: 'Capital gains', treatment: 'review' },
    { box: '26', label: 'Other income', treatment: 'review' },
    { box: '25', label: 'Foreign non-business income', treatment: 'review' },
    { box: '34', label: 'Foreign non-business income tax paid', treatment: 'review' },
    { box: '42', label: 'Amount resulting in cost base adjustment', treatment: 'info', note: 'Return of capital. Lowers your cost basis.' },
    { box: '22', label: 'Lump-sum pension income', treatment: 'pension' },
    { box: '31', label: 'Qualifying pension income', treatment: 'pension' },
  ],
};

const T4A: SlipDef = {
  type: 'T4A',
  name: 'T4A - Statement of Pension, Retirement, Annuity, and Other Income',
  issuer: 'Payer',
  about: 'Pensions, annuities, self-employment commissions, scholarships and other payments.',
  boxes: [
    { box: '016', label: 'Pension or superannuation', treatment: 'pension',
      note: 'Taxable part may be lower if you made after-tax contributions while a US person (US basis).' },
    { box: '018', label: 'Lump-sum payments', treatment: 'pension' },
    { box: '020', label: 'Self-employed commissions', treatment: 'review', note: 'Self-employment income: add it to your business in the Self-employment section (Schedule C) and leave it out here.' },
    { box: '022', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
    { box: '024', label: 'Annuities', treatment: 'pension' },
    { box: '028', label: 'Other income', treatment: 'otherIncome' },
    { box: '048', label: 'Fees for services', treatment: 'review', note: 'Self-employment income: add it to your business in the Self-employment section (Schedule C) and leave it out here.' },
    { box: '105', label: 'Scholarships, bursaries, fellowships, artists project grants, and prizes', treatment: 'review',
      note: 'Tax-free in the US only to the extent used for tuition and required fees at a degree program.' },
    { box: '107', label: 'Payments from a wage loss replacement plan', treatment: 'review' },
    { box: '119', label: 'Premiums paid to a group term life insurance plan', treatment: 'review' },
    { box: '134', label: 'TFSA taxable amount', treatment: 'review', note: 'TFSA income is fully taxable in the US every year.' },
    { box: '135', label: 'Recipient-paid premiums for private health services plans', treatment: 'info' },
  ],
};

const T4RSP: SlipDef = {
  type: 'T4RSP',
  name: 'T4RSP - Statement of RRSP Income',
  issuer: 'RRSP issuer',
  about: 'Money taken out of an RRSP.',
  boxes: [
    { box: '16', label: 'Annuity payments', treatment: 'pension' },
    { box: '18', label: 'Refund of premiums', treatment: 'pension' },
    { box: '20', label: 'Refund of unused contributions', treatment: 'pension' },
    { box: '22', label: 'Withdrawal and commutation payments', treatment: 'pension',
      note: 'IRS Pub 597: RRSP payments are pensions (1040 lines 5a/5b). Taxable part = payment minus your US basis.' },
    { box: '25', label: 'LLP withdrawal', treatment: 'review',
      note: 'Lifelong Learning Plan withdrawals are tax-free in Canada but taxable in the US (minus basis).' },
    { box: '26', label: 'Amounts deemed received on deregistration', treatment: 'pension' },
    { box: '27', label: 'HBP withdrawal', treatment: 'review',
      note: "Home Buyers' Plan withdrawals are tax-free in Canada but taxable in the US (minus basis)." },
    { box: '28', label: 'Other income or deductions', treatment: 'review' },
    { box: '30', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
    { box: '34', label: 'Amounts deemed received on death', treatment: 'pension' },
    { box: '35', label: 'Transfers on breakdown of marriage or common-law partnership', treatment: 'info' },
    { box: '40', label: 'Tax-paid amount', treatment: 'info' },
  ],
};

const T4RIF: SlipDef = {
  type: 'T4RIF',
  name: 'T4RIF - Statement of Income from a RRIF',
  issuer: 'RRIF carrier',
  about: 'Payments from a RRIF.',
  boxes: [
    { box: '16', label: 'Taxable amounts', treatment: 'pension',
      note: 'IRS Pub 597: RRIF payments are pensions (1040 lines 5a/5b). Taxable part = payment minus your US basis.' },
    { box: '18', label: 'Deceased', treatment: 'pension', note: 'Amounts deemed received on death.' },
    { box: '20', label: 'Deregistration', treatment: 'pension' },
    { box: '22', label: 'Other income or deductions', treatment: 'review' },
    { box: '24', label: 'Excess amount', treatment: 'info', note: 'Portion of box 16 over the RRIF minimum. Already in box 16.' },
    { box: '28', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
    { box: '36', label: 'Tax-paid amount', treatment: 'info' },
  ],
};

const T4E: SlipDef = {
  type: 'T4E',
  name: 'T4E - Statement of Employment Insurance and Other Benefits',
  issuer: 'Service Canada',
  about: 'EI benefits, including maternity and parental benefits.',
  boxes: [
    { box: '14', label: 'Total benefits paid', treatment: 'unemployment',
      note: 'Taxable in the US as unemployment compensation (Schedule 1 line 7). Boxes 15 and 17 are a breakdown of this total.' },
    { box: '15', label: 'Regular and other benefits paid', treatment: 'info', note: 'Part of box 14.' },
    { box: '17', label: 'Employment benefits and support measures paid', treatment: 'info', note: 'Part of box 14.' },
    { box: '20', label: 'Taxable tuition assistance', treatment: 'review' },
    { box: '21', label: 'Non-taxable tuition assistance', treatment: 'review' },
    { box: '22', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
    { box: '23', label: 'Quebec income tax deducted', treatment: 'canadianTaxInfo' },
    { box: '7', label: 'Repayment rate', treatment: 'info' },
  ],
};

const T4AP: SlipDef = {
  type: 'T4AP',
  name: 'T4A(P) - Statement of Canada Pension Plan Benefits',
  issuer: 'Service Canada',
  about: 'CPP retirement, disability and survivor benefits.',
  boxes: [
    { box: '20', label: 'Taxable CPP benefits', treatment: 'canadianSocialSecurity' },
    { box: '22', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
  ],
};

const T4AOAS: SlipDef = {
  type: 'T4AOAS',
  name: 'T4A(OAS) - Statement of Old Age Security',
  issuer: 'Service Canada',
  about: 'Old Age Security pension.',
  boxes: [
    { box: '18', label: 'Taxable pension paid', treatment: 'canadianSocialSecurity' },
    { box: '22', label: 'Income tax deducted', treatment: 'canadianTaxInfo' },
  ],
};

const T5008: SlipDef = {
  type: 'T5008',
  name: 'T5008 - Statement of Securities Transactions',
  issuer: 'Broker',
  about: 'Sales of stocks, funds and other securities.',
  boxes: [
    { box: '15', label: 'Type code of securities', treatment: 'info' },
    { box: '16', label: 'Quantity of securities', treatment: 'info' },
    { box: '17', label: 'Identification of securities', treatment: 'info' },
    { box: '20', label: 'Cost or book value', treatment: 'review',
      note: 'US cost basis is converted at the exchange rate on the purchase date, not the yearly average.' },
    { box: '21', label: 'Proceeds of disposition or settlement amount', treatment: 'review',
      note: 'Converted at the exchange rate on the sale date. Goes on Form 8949 / Schedule D.' },
  ],
};

const T5007: SlipDef = {
  type: 'T5007',
  name: 'T5007 - Statement of Benefits',
  issuer: 'Province or workers compensation board',
  about: 'Social assistance and workers compensation.',
  boxes: [
    { box: '10', label: "Workers' compensation benefits", treatment: 'review',
      note: 'Workers compensation is generally excluded from US income (IRC 104(a)(1)).' },
    { box: '11', label: 'Social assistance payments', treatment: 'review' },
  ],
};

export const SLIPS: Record<Exclude<SlipType, 'NOA'>, SlipDef> = {
  T4, T4A, T5, T3, T5008, T4RSP, T4RIF, T4E, T4AP, T4AOAS, T5007,
};

export function boxDef(type: Exclude<SlipType, 'NOA'>, box: string): BoxDef | undefined {
  return SLIPS[type].boxes.find((b) => b.box === box);
}

/**
 * Canadian dividend gross-up (taxable amount / actual amount), used only to
 * apportion Canadian tax between FTC categories under Canadian law.
 * Eligible 38%, other-than-eligible 15% (CRA T5 back: boxes 25 and 11).
 */
export const DIVIDEND_GROSS_UP = { eligible: 1.38, other: 1.15 } as const;
