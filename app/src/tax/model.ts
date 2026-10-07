// Inputs the user confirms in the app, and the intermediate shapes the engine
// works with. All money inputs are CAD unless the field name says Usd.

import type { FilingStatus, TaxYear } from './years';
import type { ForeignAccount } from './accounts';
import type { SlipType } from './slips';
import type { Business } from './business';
import type { CapitalLossCarryover, CapitalSale } from './capital';
import type { PficFund } from './pfic';

export interface Person {
  firstName: string;
  lastName: string;
  ssn: string;
  /** ISO date. Used for 65+ standard deduction and senior deduction. */
  dateOfBirth: string;
  blind?: boolean;
  occupation?: string;
}

export interface Dependent {
  firstName: string;
  lastName: string;
  ssn: string;
  relationship: string;
  dateOfBirth: string;
  /** Has an SSN valid for employment, issued before the return due date. */
  hasValidSsn: boolean;
  /** US citizen, national, or resident alien (required for either credit). */
  usPerson: boolean;
  livedWithYouOverHalfYear: boolean;
}

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string; // "Canada"
}

/** One slip as confirmed by the user. Box values in CAD (CRA slips are CAD unless box 27 on a T5 says otherwise). */
export interface SlipInput {
  id: string;
  type: Exclude<SlipType, 'NOA'>;
  /** Whose slip it is (matters for joint returns and Form 2555 per person). */
  owner: 'taxpayer' | 'spouse';
  payer: string;
  boxes: Record<string, number>;
  /** Answers to per-slip questions (e.g. whether dividends are from a company or a fund). */
  answers?: SlipAnswers;
}

export interface SlipAnswers {
  /** T5/T3: shares of a regular company (qualified dividend possible) vs a fund (PFIC). */
  dividendSource?: 'company' | 'fund';
  /** Held the shares long enough for qualified dividend treatment (61 days in the 121-day window). */
  metHoldingPeriod?: boolean;
  /** Pensions/RRSP/RRIF: US basis in CAD (after-tax contributions made while a US person). */
  usBasisCad?: number;
  /** RRSP income taken from a T1 (line 12900): a withdrawal (T4RSP box 22) or annuity payments (box 16). */
  rrspKind?: 'withdrawal' | 'annuity';
}

/** Figures from the Canadian Notice of Assessment / T1 for the same year. */
export interface CanadianAssessment {
  owner: 'taxpayer' | 'spouse';
  /** T1 line 15000 total income. */
  totalIncome: number;
  /** T1 line 23600 net income. */
  netIncome: number;
  /** T1 line 42000 net federal tax. */
  netFederalTax: number;
  /** T1 line 42800 net provincial/territorial tax (0 for Quebec residents; use quebecTax). */
  provincialTax: number;
  /** T1 line 44000 refundable Quebec abatement (Quebec residents only). */
  quebecAbatement?: number;
  /** Quebec TP-1 line 432 Quebec income tax (Quebec residents only). */
  quebecTax?: number;
}

/** Unused foreign tax by year of origin (USD), from last year's Schedule B (Form 1116) line 8. */
export interface CarryoverVintage { year: number; general: number; passive: number }

export interface PriorFtcCarryover {
  general: number;
  passive: number;
  /** When given, these replace the totals above and drive Schedule B (Form 1116). */
  vintages?: CarryoverVintage[];
  /** Unused AMT foreign tax credit by year of origin (from last year's AMT Schedule B (Form 1116) line 8). */
  amtVintages?: CarryoverVintage[];
}

export interface Elections {
  /** Claim Form 2555 foreign earned income exclusion instead of only the foreign tax credit. 'auto' lets Lou compare. */
  feie: 'auto' | 'yes' | 'no';
  /** Treat CPP/QPP/OAS as exempt under the treaty (professional consensus), with Form 8833. */
  canadianSocialSecurityExempt: boolean;
  /** Elect not to adjust foreign qualified dividends when eligible (Form 1116 adjustment exception). */
  useAdjustmentException: boolean;
}

export interface ReturnInput {
  year: TaxYear;
  filingStatus: FilingStatus;
  taxpayer: Person;
  spouse?: Person;
  dependents: Dependent[];
  address: Address;
  slips: SlipInput[];
  assessments: CanadianAssessment[];
  carryover?: PriorFtcCarryover;
  /** Unused Form 1116 limit left in the prior year, per category (USD), when that year is in Lou: room for a carryback (IRC 904(c)). */
  priorYearRoom?: { general: number; passive: number };
  elections: Elections;
  /** Form 2555 details per person. */
  feie2555?: Partial<Record<'taxpayer' | 'spouse', Feie2555Details>>;
  /** Canadian financial accounts (FBAR, Form 8938). */
  accounts?: ForeignAccount[];
  /** Self-employment businesses (T2125 in Canada, Schedule C in the US). */
  businesses?: Business[];
  /** Sales of shares and other capital property (T5008 and broker reports). */
  sales?: CapitalSale[];
  /** Capital loss carried in from last year's Schedule D (USD). */
  capitalLossCarryover?: CapitalLossCarryover;
  /** Canadian mutual funds and ETFs (PFICs). */
  pficFunds?: PficFund[];
  spouseIsUsPerson?: boolean;
  /** Form 1040 page 1 digital asset question. */
  digitalAssets?: boolean;
  /** Canadian accounts over US$10,000 in aggregate at any time (Schedule B Part III, FBAR). */
  foreignAccountsOver10k?: boolean;
  /** Days physically present in Canada / abroad and bona fide residence facts for Form 2555. */
  feieFacts?: FeieFacts;
  /** ISO date treated as today (tests); time-dependent rules use the real date otherwise. */
  asOf?: string;
}

/** Facts Form 2555 asks for (Parts I and II, bona fide residence test). One per person with foreign wages. */
export interface Feie2555Details {
  employerAddress: string;
  employerType: 'foreign' | 'us' | 'foreignAffiliate' | 'self' | 'other';
  filedBefore: boolean | null;
  /** Last year Form 2555 was filed (when filedBefore). */
  priorYear: string;
  revoked: boolean | null;
  revokedDetail: string;
  /** Date bona fide residence in Canada began (ISO). */
  residenceStart: string;
  quarters: 'purchased' | 'rented' | 'room' | 'employer' | null;
  familyWithYou: boolean | null;
  familyWho: string;
  status: 'citizen' | 'pr' | 'permit' | 'other' | null;
  statusOther: string;
  visaLimited: boolean | null;
  usHome: boolean | null;
  usHomeAddress: string;
  trips: { arrived: string; left: string; businessDays: number }[];
  /** Which test: bona fide residence (default) or physical presence. With 'ppt', residenceStart is the arrival date. */
  test?: 'bfr' | 'ppt';
  /** Foreign housing expenses (Part VI): rent, utilities (not phone), insurance, parking, repairs. CAD. */
  housing?: { expensesCad: number; location: string };
}

export const emptyFeie2555 = (): Feie2555Details => ({
  employerAddress: '', employerType: 'foreign', filedBefore: null, priorYear: '', revoked: false, revokedDetail: '', residenceStart: '',
  quarters: null, familyWithYou: null, familyWho: '', status: null, statusOther: '', visaLimited: null, usHome: false,
  usHomeAddress: '', trips: [],
});

export interface FeieFacts {
  /** Lived in Canada for a full calendar year (bona fide residence test). */
  bonaFideResident: boolean;
  residenceStart: string; // ISO date
  /** Days in the US during the year. */
  daysInUs: number;
}

/** A single US income item derived from one slip box. */
export interface IncomeItem {
  slipId: string;
  /** 'T2125' = a self-employment business typed in by the user (Schedule C). */
  slipType: Exclude<SlipType, 'NOA'> | 'T2125' | 'PFIC' | 'SALES';
  box: string;
  owner: 'taxpayer' | 'spouse';
  description: string;
  cad: number;
  usd: number;
  /** Where it lands on the US return. */
  usLine: '1h' | '2b' | '3b' | '5b' | 's1_3' | 's1_7' | 's1_8z' | 'sd_13' | 'sd_net' | 'excluded';
  /** Form 1116 category. */
  category: 'general' | 'passive';
  /** Counts as foreign earned income (Form 2555, Schedule 8812 earned income). */
  earned: boolean;
  qualifiedDividend: boolean;
  /** Business income: gross income (Schedule C line 7) and expenses (lines 28 + 30), USD. `usd` is the net profit. */
  grossUsd?: number;
  expensesUsd?: number;
  /** Self-employment income. Exempt from US SE tax under the totalization agreement, so it is not earned income for Schedule 8812. */
  selfEmployment?: boolean;
  /** Part of usd taxed at capital gain rates (long-term gains), for the Form 1116 adjustment. */
  prefUsd?: number;
  /** US-source income (e.g. a gain Canada taxed at under 10%, IRC 865(g)(2)): no Form 1116 category. */
  usSource?: boolean;
  /** PFIC amount taxed as deferred tax (Form 8621 line 16c), not as income this year. */
  deferred?: boolean;
  /** Amount Canada taxes (CAD), for apportioning Canadian tax between categories. */
  canadianTaxableCad: number;
  sources: string[];
}

export type Severity = 'block' | 'warn' | 'info';

/** Something the user must see: missing data, a judgment call, or a filing obligation. */
export interface Flag {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  slipId?: string;
  box?: string;
}
