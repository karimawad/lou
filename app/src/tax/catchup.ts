// Catch-up filing: the IRS Streamlined Foreign Offshore Procedures (SFOP), for US persons abroad who missed
// returns or FBARs through a non-willful mistake. Pure rules, no DOM.
//
// Sources (all primary):
//  - irs.gov "U.S. taxpayers residing outside the United States" (the SFOP page): the 3 most recent years "for which the
//    U.S. tax return due date (or properly applied for extended due date) has passed", the 6 most recent FBAR years "for which
//    the FBAR due date has passed", Form 14653, 330 full days outside the US in any one or more of those 3 years and no US
//    abode, "Streamlined Foreign Offshore" in red at the top of each return and each information return, tax plus statutory
//    interest, paper only, to the Austin address.
//  - irs.gov SFOP FAQs (Q6 narrative, Q10: "The proper TIN is a valid SSN").
//  - Form 14653 (Rev. 3-2025), read from the form itself (research/instr/f14653.pdf, text in research/instr/f14653_text.txt).
//  - Instructions for Form 1040 (2025), "Extension of Time To File": the automatic 2 months for people abroad (to June 15),
//    4 more months with Form 4868 (to October 15), "interest will be charged from the original due date".
//  - FBAR instructions (FinCEN): due April 15, automatic extension to October 15; filed after October 15 is a late FBAR.
//  - IRC 6601, 6621, 6622: interest on tax paid late, daily compounding (the rate table is Lou's tax/data/irs-interest.json).

import type { ForeignAccount } from './accounts';
import interest from './data/irs-interest.json';
import { interestFactor } from './pfic';
import { TAX_YEARS, TREASURY_DEC31_CAD_PER_USD } from './years';

export const SFOP = {
  notation: 'Streamlined Foreign Offshore',
  /** FinCEN BSA E-Filing "reason for late filing": choose "Other" and type this (IRS delinquent FBAR page). */
  fbarReason: 'Streamlined Filing Compliance Procedures',
  mailTo: ['Internal Revenue Service', '3651 South I-H 35', 'Stop 6063 AUSC', 'Attn: Streamlined Foreign Offshore', 'Austin, TX 78741'],
  fullDaysOutside: 330,
  returnCount: 3,
  fbarCount: 6,
  /** The VDP hotline named in the SFOP FAQs. */
  hotline: '904-661-3350',
} as const;

/** Lou's own cutoff for "large balances" (not an IRS rule): above this the page tells people to see a professional. */
export const LARGE_BALANCE_USD = 1_000_000;

// ---------------------------------------------------------------- dates

const DAY = 86400000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const isoOf = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
export const daysInYear = (y: number) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365);

/** A deadline on a Saturday or Sunday moves to Monday (IRC 7503). Holidays are not modeled: none falls on June 15 or October 15. */
export function nextBusinessDay(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dow === 6 ? isoOf(toDay(iso) + 2) : dow === 0 ? isoOf(toDay(iso) + 1) : iso;
}

/**
 * When a year's return is due for someone living abroad: June 15 of the next year (the automatic 2 months), or
 * October 15 when Form 4868 was filed. Interest runs from April 15 either way (see {@link interestStart}).
 */
export function returnDueDate(year: number, extended: boolean): string {
  return nextBusinessDay(`${year + 1}-${extended ? '10-15' : '06-15'}`);
}

/** Interest on unpaid tax runs from the original due date, April 15 (Form 1040 instructions: "interest will be charged from the original due date"). */
export const interestStart = (year: number) => nextBusinessDay(`${year + 1}-04-15`);

/** An FBAR is late after October 15 of the next year (April 15 plus FinCEN's automatic extension). */
export const fbarLateAfter = (year: number) => nextBusinessDay(`${year + 1}-10-15`);

const passed = (due: string, today: string) => toDay(today) > toDay(due);

export interface SfopPlan {
  today: string;
  /** The 3 return years, oldest first. */
  returnYears: number[];
  /** The 6 FBAR years, oldest first. */
  fbarYears: number[];
  /** The year whose FBAR is not late yet (due October 15) but is worth filing in the same sitting; null when none. */
  fbarAlsoNow: number | null;
  /** The year whose extension answer decides whether it counts (only between June 16 and October 15); null when nothing depends on it. */
  askExtensionFor: number | null;
  /** Return years Lou has no tax rules for. The plan can't be built until Lou adds them. */
  unsupportedReturnYears: number[];
  /** FBAR years with no Treasury year-end rate in Lou. */
  unsupportedFbarYears: number[];
}

/**
 * Which 3 returns and 6 FBARs the procedure covers on `today`. Nothing is fixed to a year: the answer moves as time passes.
 * `extension[year]` says whether Form 4868 was filed for that year (it only matters between June 16 and October 15).
 */
export function sfopPlan(today: string, extension: Partial<Record<number, boolean>> = {}): SfopPlan {
  const thisYear = Number(today.slice(0, 4));
  const returnYears: number[] = [];
  let askExtensionFor: number | null = null;
  for (let y = thisYear - 1; y >= thisYear - 12 && returnYears.length < SFOP.returnCount; y--) {
    const late = passed(returnDueDate(y, false), today);
    const lateIfExtended = passed(returnDueDate(y, true), today);
    if (late && !lateIfExtended) askExtensionFor = y;
    if (extension[y] === true ? lateIfExtended : late) returnYears.push(y);
  }
  returnYears.reverse();

  const fbarYears: number[] = [];
  for (let y = thisYear - 1; y >= thisYear - 12 && fbarYears.length < SFOP.fbarCount; y--) {
    if (passed(fbarLateAfter(y), today)) fbarYears.push(y);
  }
  fbarYears.reverse();
  const open = thisYear - 1;
  const fbarAlsoNow = !fbarYears.includes(open) && passed(`${open + 1}-04-15`, today) ? open : null;

  return {
    today, returnYears, fbarYears, fbarAlsoNow, askExtensionFor,
    unsupportedReturnYears: returnYears.filter((y) => !(TAX_YEARS as number[]).includes(y)),
    unsupportedFbarYears: [...fbarYears, ...(fbarAlsoNow ? [fbarAlsoNow] : [])].filter((y) => TREASURY_DEC31_CAD_PER_USD[y] === undefined),
  };
}

// ---------------------------------------------------------------- interest

const RATE_KEYS = Object.keys((interest as { rates: Record<string, number> }).rates);
/** The last day Lou has an IRS interest rate for. */
export function lastRateDay(): string {
  const last = RATE_KEYS.map((k) => { const [y, q] = k.split('-Q'); return Number(y) * 10 + Number(q); }).sort((a, b) => a - b).pop() ?? 0;
  return endOfQuarter(Math.floor(last / 10), last % 10);
}
function endOfQuarter(y: number, q: number): string {
  const month = q * 3;
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  return `${y}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export interface InterestRow {
  year: number;
  /** Tax owed on that year's return (whole dollars). */
  tax: number;
  /** Estimated statutory interest from April 15 to the payment date, to the cent. */
  interest: number;
  /** True when the payment date is past the last rate Lou has: the interest is counted only up to that day. */
  partial: boolean;
}

/**
 * Estimated interest on tax paid on `payDate`: each year's tax from April 15 of the next year, at the IRC 6621 rate for each
 * quarter, compounded daily (IRC 6622). The IRS bills any difference, which is why Form 14653 says the payment "should equal
 * the total tax and interest due" and notes you may get "a balance due notice or a refund" if it was figured differently.
 */
export function catchUpInterest(rows: { year: number; tax: number }[], payDate: string): InterestRow[] {
  const cap = lastRateDay();
  const end = toDay(payDate) > toDay(cap) ? cap : payDate;
  return rows.map(({ year, tax }) => {
    const from = interestStart(year);
    const factor = tax > 0 && toDay(end) > toDay(from) ? interestFactor(from, end) : 1;
    return { year, tax, interest: factor === null ? 0 : Math.round(tax * (factor - 1) * 100) / 100, partial: end !== payDate && tax > 0 };
  });
}

// ---------------------------------------------------------------- residency (the 330-day test)

/** Full days outside the US in a calendar year, from the days spent with any part of the day in the US (Pub. 54: a full day is midnight to midnight). */
export const fullDaysOutside = (year: number, daysInUs: number) => Math.max(0, daysInYear(year) - Math.max(0, Math.round(daysInUs)));
export const meets330 = (year: number, daysInUs: number) => fullDaysOutside(year, daysInUs) >= SFOP.fullDaysOutside;

// ---------------------------------------------------------------- screening

export type ScreenKey = 'exam' | 'contact' | 'illegal' | 'tin' | 'chose' | 'knew' | 'warned' | 'priorFiled' | 'abode';

export interface ScreenQuestion {
  key: ScreenKey;
  /** Plain-language question. */
  text: string;
  hint?: string;
  /** The answer that raises the concern. */
  risky: boolean;
  /** stop: Lou's package is not for this person. refer: see a professional first (the person can go on after doing so). */
  level: 'stop' | 'refer';
  title: string;
  why: string;
}

export const SCREEN_QUESTIONS: ScreenQuestion[] = [
  { key: 'exam', risky: true, level: 'stop',
    text: 'Has the IRS told you it is auditing you, or investigating you, for any year?',
    hint: 'A letter saying it is examining a return, or contact from IRS Criminal Investigation.',
    title: 'Under examination or investigation',
    why: 'The streamlined procedures are for people the IRS has not started to examine or investigate. Talk to a tax attorney or an enrolled agent who handles IRS examinations before you do anything else.' },
  { key: 'contact', risky: true, level: 'refer',
    text: 'Has the IRS or FinCEN written to you about unfiled returns, foreign accounts or an FBAR?',
    hint: 'Any letter or notice, even one you answered. Include a notice about a return you never filed.',
    title: 'The IRS has already contacted you',
    why: 'A notice does not always close the streamlined route, but what it says decides which route is safe. Have a professional read it before you send anything.' },
  { key: 'illegal', risky: true, level: 'stop',
    text: 'Does any of your income, or any money in your accounts, come from illegal activity?',
    title: 'Income from illegal sources',
    why: 'The streamlined procedures are not meant for this. Speak to a tax attorney before you contact the IRS.' },
  { key: 'tin', risky: false, level: 'stop',
    text: 'Do you have a US Social Security number?',
    hint: 'The number on your Social Security card. Not your Canadian SIN.',
    title: 'No Social Security number',
    why: 'IRS FAQ 10: "The proper TIN is a valid SSN." A submission without a valid SSN does not get the penalty relief. Get an SSN first (Form SS-5), then come back.' },
  { key: 'chose', risky: true, level: 'stop',
    text: 'At any point, did you decide on purpose not to file, or not to report an account or income, even only in part?',
    title: 'A deliberate choice not to file or report',
    why: 'You would have to certify under penalty of perjury that the failure was not willful. If it was a choice, the streamlined procedures are not available. A tax attorney can explain the other routes.' },
  { key: 'knew', risky: true, level: 'refer',
    text: 'Before you started this, did you know that US citizens living abroad must file US returns, or that foreign accounts may have to be reported (an FBAR)?',
    hint: 'Answer honestly. Knowing about a rule and misunderstanding it (for example, thinking no tax owed meant no return) is different from ignoring it, and a professional can help you tell which one applies to you.',
    title: 'You knew about the rules',
    why: 'Non-willful means negligence, inadvertence, mistake, or a good faith misunderstanding of the law. Whether your knowledge fits that is a judgement call that carries penalties if it is wrong. Talk it through with a professional first.' },
  { key: 'warned', risky: true, level: 'refer',
    text: 'Did a bank, accountant, lawyer or anyone else ever tell you that you had to file or report?',
    title: 'Someone told you that you had to file',
    why: 'Being told and not acting can look like willfulness to the IRS. A professional can help you describe what happened accurately.' },
  { key: 'priorFiled', risky: true, level: 'refer',
    text: 'In the last six years, did you file a US return that said you had no foreign accounts (Schedule B), or that left out your Canadian income?',
    title: 'An earlier return may be wrong',
    why: 'The IRS looks at earlier returns that were filed with foreign account or income answers that turned out to be wrong. A professional should look at what you filed.' },
  { key: 'abode', risky: true, level: 'refer',
    text: 'In any of those years, did you keep a home in the US that you could use (you own it or rent it, or your spouse or children live there)?',
    hint: 'IRS Publication 54 says whether you kept a "US abode" depends on your facts. A parent\'s house you visit does not count. A home kept for you does.',
    title: 'You may have a US abode',
    why: 'The foreign procedure requires no US abode. If you do, you may need the domestic procedure, which has a 5% penalty. A professional should decide.' },
];

export type ScreeningAnswers = Partial<Record<ScreenKey, boolean>>;

export interface CatchupState {
  /** The person opened catch-up mode. */
  started: boolean;
  screen: ScreeningAnswers;
  /** Per return year: a US return was already filed for it. */
  alreadyFiled: Partial<Record<number, boolean>>;
  /** Per return year: Form 4868 was filed (matters only for the year Lou asks about). */
  extension: Partial<Record<number, boolean>>;
  /** Per return year: days with any part of the day in the US. */
  daysInUs: Partial<Record<number, number>>;
  /** The person says they talked to a professional about the "see a professional" flags and want to go on. */
  professionalAck: boolean;
  /** When the package will be mailed (ISO date); interest is counted to this day. Blank means today. */
  mailDate: string;
  /** The Form 14653 statement of facts, in the person's own words, by prompt id (see {@link STATEMENT_PROMPTS}). */
  statement: Record<string, string>;
  /** Canadian accounts for FBAR years that have no return workspace (before 2023). */
  fbar: Partial<Record<number, { accounts: ForeignAccount[]; noAccounts: boolean }>>;
}

export const emptyCatchup = (): CatchupState => ({
  started: false, screen: {}, alreadyFiled: {}, extension: {}, daysInUs: {}, professionalAck: false, mailDate: '', statement: {}, fbar: {},
});

export interface Finding { id: string; level: 'stop' | 'refer'; title: string; detail: string }

export interface Screening {
  findings: Finding[];
  /** Questions not answered yet. */
  pending: string[];
  /** No stop and every question answered. */
  clear: boolean;
  /** Clear, and any "see a professional" flags were acknowledged (or there are none). */
  canProceed: boolean;
}

export function evaluateScreening(c: CatchupState, plan: SfopPlan, opts: { maxAggregateUsd?: number } = {}): Screening {
  const findings: Finding[] = [];
  const pending: string[] = [];
  for (const q of SCREEN_QUESTIONS) {
    const a = c.screen[q.key];
    if (a === undefined) pending.push(q.text);
    else if (a === q.risky) findings.push({ id: q.key, level: q.level, title: q.title, detail: q.why });
  }
  for (const y of plan.returnYears) {
    if (c.alreadyFiled[y] === undefined) pending.push(`Did you already file a ${y} US return?`);
    else if (c.alreadyFiled[y]) findings.push({ id: `filed-${y}`, level: 'stop', title: `You already filed ${y}`,
      detail: `For a year that is already filed, the procedure needs an amended return (Form 1040-X), which Lou does not prepare. Take the review package to a professional.` });
  }
  const answered = plan.returnYears.filter((y) => c.daysInUs[y] !== undefined);
  if (answered.length < plan.returnYears.length) pending.push('Days in the US for each return year');
  else if (plan.returnYears.length && !plan.returnYears.some((y) => meets330(y, c.daysInUs[y] as number))) {
    findings.push({ id: 'days', level: 'stop', title: 'Fewer than 330 full days outside the US',
      detail: `The foreign procedure needs at least ${SFOP.fullDaysOutside} full days outside the US in at least one of ${plan.returnYears.join(', ')}. If you were in the US more than that, the domestic procedure (5% penalty) may fit. Talk to a professional.` });
  }
  if (plan.askExtensionFor !== null && c.extension[plan.askExtensionFor] === undefined) pending.push(`Did you file Form 4868 for ${plan.askExtensionFor}?`);
  if ((opts.maxAggregateUsd ?? 0) > LARGE_BALANCE_USD) findings.push({ id: 'large', level: 'refer', title: 'Large account balances',
    detail: `Your accounts held more than ${LARGE_BALANCE_USD.toLocaleString('en-US')} US dollars at their highest in at least one year. The IRS has no cutoff, and this limit is Lou's own. The larger the balances, the more closely a statement that you did not act willfully is read. A professional is worth the cost here.` });
  const stops = findings.some((f) => f.level === 'stop');
  const clear = !stops && pending.length === 0;
  return { findings, pending, clear, canProceed: clear && (c.professionalAck || !findings.some((f) => f.level === 'refer')) };
}

// ---------------------------------------------------------------- the Form 14653 statement

export interface StatementPrompt { id: string; label: string; help: string; optional?: boolean }

/**
 * What Form 14653 asks the statement of facts to cover (the form's own wording, and IRS FAQ 6). Lou only asks. The answers are the
 * taxpayer's own words, signed under penalty of perjury, and Lou never adds to them.
 */
export const STATEMENT_PROMPTS: StatementPrompt[] = [
  { id: 'background', label: 'Your personal background',
    help: 'Form 14653 asks for "your personal background". Who you are and how you came to live abroad, as you would tell it.' },
  { id: 'financial', label: 'Your financial background',
    help: 'Form 14653 asks for "financial background": your work, your income, how you handled money and taxes.' },
  { id: 'why', label: 'Why you did not report all income, pay all tax, and file all required forms, including FBARs',
    help: 'This is the heart of the statement. The form says to "include the whole story including favorable and unfavorable facts". Say what you knew and what you believed at the time.' },
  { id: 'advisor', label: 'A professional advisor you relied on',
    help: 'If you relied on one: their name, address and telephone number, and a summary of the advice. Leave blank if you did not.', optional: true },
  { id: 'spouse', label: "Your spouse's reasons, if different from yours",
    help: 'Only for a joint certification. The form says each spouse\'s reasons must be given separately.', optional: true },
  { id: 'retirement', label: 'RRSP or RRIF: "eligible individual" under Rev. Proc. 2014-55',
    help: 'IRS FAQ 2 says if you hold an RRSP or RRIF and want the treaty election treated as made, state your "eligible individual" status here (Rev. Proc. 2014-55, section 4.02). Read that section before you write anything. Lou can not tell you whether you qualify.', optional: true },
];

/** The per-account prompt: where the money came from and how the account was used. */
export const ACCOUNT_PROMPT_HELP = 'The form asks you to "explain the source of funds": whether you inherited it, opened it while living abroad, or had a business reason, and "your contacts with the account": withdrawals, deposits and investment or management decisions.';

export const accountPromptId = (a: Pick<ForeignAccount, 'kind' | 'institution' | 'accountNumber'>) =>
  `account:${a.kind}|${a.institution.trim().toLowerCase().replace(/\s+/g, ' ')}|${a.accountNumber.replace(/\W/g, '')}`;
