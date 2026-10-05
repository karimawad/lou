// Canadian accounts for FBAR (FinCEN Form 114) and Form 8938.
// Sources: FinCEN BSA Electronic Filing Requirements for the FBAR (Item 15: Treasury rate for
// the last day of the calendar year, round up to the next whole dollar; joint owners report the
// full value). Instructions for Form 8938 (Treasury rate on the last day of the tax year;
// thresholds for taxpayers living abroad; joint assets: once on a joint return, half each on
// separate returns; foreign pension plan interests go in Part VI; registered accounts held at a
// financial institution are financial accounts reported in Part V even though the Canada IGA
// excludes them from FATCA bank reporting).

import { TREASURY_DEC31_CAD_PER_USD, type FilingStatus } from './years';

export type AccountKind = 'bank' | 'investment' | 'rrsp' | 'rrif' | 'tfsa' | 'resp' | 'fhsa' | 'pension';

export interface ForeignAccount {
  id: string;
  /** Copied from this tax year (Lou's state/carry.ts): this year's balances still need entering or confirming. */
  carried?: number;
  owner: 'taxpayer' | 'spouse' | 'joint';
  kind: AccountKind;
  institution: string;
  /** Street address of the institution (FBAR items 18-21, Form 8938 lines 27-28). */
  street: string;
  city: string;
  province: string;
  postalCode: string;
  accountNumber: string;
  /** Highest balance during the year, CAD. */
  maxValueCad: number;
  /** Balance on December 31, CAD. */
  yearEndValueCad: number;
  opened: boolean;
  closed: boolean;
  /** TFSA, FHSA and RESP: income inside and the Form 3520 details (foreignTrust.ts). */
  registered?: import('./foreignTrust').RegisteredDetails;
}

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Bank account', investment: 'Investment account', rrsp: 'RRSP',
  rrif: 'RRIF', tfsa: 'TFSA', resp: 'RESP', fhsa: 'FHSA', pension: 'Employer pension plan',
};

/** FBAR item 16: Bank, Securities, or Other with a description. */
export function fbarType(kind: AccountKind): { type: 'Bank' | 'Securities' | 'Other'; other?: string } {
  if (kind === 'bank') return { type: 'Bank' };
  if (kind === 'investment') return { type: 'Securities' };
  const names: Partial<Record<AccountKind, string>> = {
    rrsp: 'RRSP (Registered Retirement Savings Plan)', rrif: 'RRIF (Registered Retirement Income Fund)',
    tfsa: 'TFSA (Tax-Free Savings Account)', resp: 'RESP (Registered Education Savings Plan)',
    fhsa: 'FHSA (First Home Savings Account)', pension: 'Employer pension plan',
  };
  return { type: 'Other', other: names[kind] };
}

export interface AccountRow {
  account: ForeignAccount;
  /** FBAR item 15: CAD max / Treasury Dec 31 rate, rounded up to the next whole dollar. */
  fbarMaxUsd: number;
  /** Form 8938 values (whole dollars). */
  maxUsd: number;
  yearEndUsd: number;
}

export interface AccountsAnalysis {
  rate: number;
  rows: AccountRow[];
  /** Per filer (taxpayer and, when married, spouse): aggregate FBAR max, and whether an FBAR is required. */
  fbar: { owner: 'taxpayer' | 'spouse'; aggregateMaxUsd: number; required: boolean }[];
  f8938: {
    threshold: { yearEnd: number; anyTime: number };
    yearEndTotal: number;
    maxTotal: number;
    required: boolean;
    deposit: { count: number; max: number };
    custodial: { count: number; max: number };
    other: { count: number; max: number };
    anyClosed: boolean;
    otherAcquiredOrSold: boolean;
  };
}

/** Form 8938 thresholds for taxpayers whose tax home is abroad (Instructions for Form 8938). */
export function form8938Threshold(status: FilingStatus): { yearEnd: number; anyTime: number } {
  return status === 'mfj' || status === 'qss' ? { yearEnd: 400000, anyTime: 600000 } : { yearEnd: 200000, anyTime: 300000 };
}

export function analyzeAccounts(
  year: number, status: FilingStatus, accounts: ForeignAccount[], opts: { spouseIsUsPerson?: boolean } = {},
): AccountsAnalysis {
  const rate = TREASURY_DEC31_CAD_PER_USD[year];
  const rows: AccountRow[] = accounts.map((a) => ({
    account: a,
    fbarMaxUsd: Math.max(0, Math.ceil(a.maxValueCad / rate - 1e-9)),
    maxUsd: Math.round(Math.max(0, a.maxValueCad) / rate),
    yearEndUsd: Math.round(Math.max(0, a.yearEndValueCad) / rate),
  }));

  // FBAR: each filer counts accounts they own plus joint accounts, at full value. Employer pension
  // plans are not listed (an interest in a pension plan is not itself a financial account).
  // Only US persons file an FBAR: a spouse is included on a joint return, or when they are a US citizen/green card holder.
  const spouseFiles = status === 'mfj' || (status === 'mfs' && opts.spouseIsUsPerson === true);
  const fbarOwners: ('taxpayer' | 'spouse')[] = spouseFiles ? ['taxpayer', 'spouse'] : ['taxpayer'];
  const fbar = fbarOwners.map((owner) => {
    const aggregateMaxUsd = rows
      .filter((r) => r.account.kind !== 'pension' && (r.account.owner === owner || r.account.owner === 'joint'))
      .reduce((s, r) => s + r.fbarMaxUsd, 0);
    return { owner, aggregateMaxUsd, required: aggregateMaxUsd > 10000 };
  }).filter((f) => f.owner === 'taxpayer' || rows.some((r) => r.account.owner !== 'taxpayer'));

  // Form 8938: specified individual's assets; joint return counts both spouses (joint assets once);
  // separate return counts own assets plus half of assets jointly owned with the spouse.
  const included = rows.filter((r) => status === 'mfj' || r.account.owner !== 'spouse');
  const share = (r: AccountRow) => (status === 'mfs' && r.account.owner === 'joint' ? 0.5 : 1);
  const yearEndTotal = Math.round(included.reduce((s, r) => s + r.yearEndUsd * share(r), 0));
  const maxTotal = Math.round(included.reduce((s, r) => s + r.maxUsd * share(r), 0));
  const threshold = form8938Threshold(status);
  const group = (pred: (r: AccountRow) => boolean) => {
    const g = included.filter(pred);
    return { count: g.length, max: g.reduce((s, r) => s + r.maxUsd, 0) };
  };
  return {
    rate, rows, fbar,
    f8938: {
      threshold, yearEndTotal, maxTotal,
      required: yearEndTotal > threshold.yearEnd || maxTotal > threshold.anyTime,
      deposit: group((r) => r.account.kind === 'bank'),
      custodial: group((r) => r.account.kind !== 'bank' && r.account.kind !== 'pension'),
      other: group((r) => r.account.kind === 'pension'),
      anyClosed: included.some((r) => r.account.kind !== 'pension' && r.account.closed),
      otherAcquiredOrSold: included.some((r) => r.account.kind === 'pension' && (r.account.opened || r.account.closed)),
    },
  };
}
