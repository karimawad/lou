// TFSA, FHSA and RESP accounts.
// - Income inside them is US-taxable every year (the US doesn't recognize the Canadian tax shelter;
//   the treaty's pension article covers RRSPs/RRIFs, not these). Lou reports the owner's share as if
//   held directly (grantor trust rules, IRC 671-679), as the Foreign Grantor Trust Owner Statement says.
// - Reporting: RESP (education) and RDSP (disability) fit Rev. Proc. 2020-17 section 5.04 (tax-favored
//   foreign non-retirement savings trusts), so no Forms 3520/3520-A. TFSAs and FHSAs don't fit. The IRS
//   hasn't ruled whether they are foreign trusts; Lou's default (Karim, 2026-10-04) treats trusteed TFSAs
//   and FHSAs as foreign grantor trusts and prepares Form 3520 and a substitute Form 3520-A. The user
//   can switch this off.
// Sources: Instructions for Forms 3520 and 3520-A (Rev. December 2025); Rev. Proc. 2020-17; IRC 6048, 6677.

import { TREASURY_DEC31_CAD_PER_USD, YEARS, type TaxYear } from './years';
import { dollars } from './taxComputation';
import type { ForeignAccount } from './accounts';

export interface RegisteredDetails {
  /** Date the account (the trust) was opened. */
  openedDate: string;
  startValueCad: number;
  contributionsCad: number;
  withdrawalsCad: number;
  /** Income earned inside the account this year (CAD). Fund distributions go in the fund list (PFIC); sales in the sales list. */
  interestCad: number;
  companyDividendsCad: number;
  /** The company dividends meet the qualified-dividend holding period. */
  dividendsQualified: boolean;
  /** Mostly cash or GICs (Form 3520-A balance sheet line 1) vs. investments (line 6). */
  holdsInvestments: boolean;
  /** Prepare Forms 3520 / 3520-A (TFSA and FHSA only; default yes). */
  file3520: boolean;
}

export const TRUST_KINDS = ['tfsa', 'fhsa', 'resp'] as const;
export type TrustKind = (typeof TRUST_KINDS)[number];

export function isRegisteredTrust(a: ForeignAccount): a is ForeignAccount & { kind: TrustKind } {
  return (TRUST_KINDS as readonly string[]).includes(a.kind);
}

/** Forms 3520/3520-A apply: TFSA or FHSA, and the user kept Lou's default. */
export function needs3520(a: ForeignAccount): boolean {
  return (a.kind === 'tfsa' || a.kind === 'fhsa') && (a.registered?.file3520 ?? true);
}

export interface Trust3520 {
  account: ForeignAccount;
  trustName: string;
  /** Form 3520 amounts (USD). */
  contributionsUsd: number;
  withdrawalsUsd: number;
  /** Line 23 / owner statement line 9: value at year end (Treasury Dec 31 rate). */
  yearEndUsd: number;
  startUsd: number;
  /** Form 3520-A Part II / owner statement page 4 income (USD). */
  interestUsd: number;
  dividendsUsd: number;
  qualifiedUsd: number;
  shortTermUsd: number;
  longTermUsd: number;
}

/**
 * Figures for Form 3520 and the substitute Form 3520-A. Income and flows use the IRS yearly average
 * rate (as on the 1040); balances use the Treasury rate for December 31 (as on Form 8938).
 * `gains` are the account's net short- and long-term gains from the sales list (USD).
 */
export function trust3520(year: TaxYear, a: ForeignAccount, gains: { shortTerm: number; longTerm: number }): Trust3520 {
  const avg = YEARS[year].irsAvgCadPerUsd;
  const r = a.registered;
  const kindName = a.kind === 'tfsa' ? 'Tax-Free Savings Account' : a.kind === 'fhsa' ? 'First Home Savings Account' : 'Registered Education Savings Plan';
  const yearEndRate = TREASURY_DEC31_CAD_PER_USD[year];
  const priorRate = TREASURY_DEC31_CAD_PER_USD[(year - 1) as TaxYear] ?? yearEndRate;
  return {
    account: a,
    trustName: `${a.institution} ${kindName}${a.accountNumber ? ` ${a.accountNumber}` : ''}`.trim(),
    contributionsUsd: dollars((r?.contributionsCad ?? 0) / avg),
    withdrawalsUsd: dollars((r?.withdrawalsCad ?? 0) / avg),
    yearEndUsd: dollars(a.yearEndValueCad / yearEndRate),
    startUsd: dollars((r?.startValueCad ?? 0) / priorRate),
    interestUsd: dollars((r?.interestCad ?? 0) / avg),
    dividendsUsd: dollars((r?.companyDividendsCad ?? 0) / avg),
    qualifiedUsd: r?.dividendsQualified ? dollars((r?.companyDividendsCad ?? 0) / avg) : 0,
    shortTermUsd: gains.shortTerm,
    longTermUsd: gains.longTerm,
  };
}

/** Owner statement line 7: why the account is a grantor trust owned by the US person. */
export function ownershipExplanation(t: Trust3520, ownerName: string): string {
  const what = t.account.kind === 'tfsa' ? 'a Canadian Tax-Free Savings Account' : 'a Canadian First Home Savings Account';
  return `${t.trustName} is ${what} held by ${t.account.institution} as trustee under an arrangement registered with the Canada Revenue Agency. `
    + `${ownerName} is the only contributor and the only beneficiary, and may withdraw all of the assets at any time. `
    + 'For US tax purposes the account is treated as a foreign trust owned by the account holder under the grantor trust rules: '
    + 'IRC section 676 (power to revest the trust property in the grantor) and IRC section 679 (US person who transferred property to a foreign trust with a US beneficiary). '
    + 'All income is reported on the owner’s Form 1040. The IRS has not ruled on the classification of these accounts; this return is filed to the best of the owner’s ability.';
}
