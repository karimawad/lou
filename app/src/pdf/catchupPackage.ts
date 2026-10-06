// Catch-up filing outputs (IRS Streamlined Foreign Offshore Procedures), all built on the device:
//  - the returns with "Streamlined Foreign Offshore" printed in red at the top of page 1 of each return and each information return
//  - a cover sheet and mailing checklist
//  - a Form 14653 worksheet: the official form is an XFA form that only Adobe Reader can fill, so Lou lays out every entry
//    for the person to type into the official form, with the statement of facts in their own words, unchanged
//  - FBAR worksheets for every FBAR year

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { ACCOUNT_PROMPT_HELP, SFOP, STATEMENT_PROMPTS, accountPromptId, fbarLateAfter, fullDaysOutside, meets330, type CatchupState, type SfopPlan } from '../tax/catchup';
import { fbarType, ACCOUNT_KIND_LABEL } from '../tax/accounts';
import type { FbarSummary } from '../state/catchup';
import { distinctAccounts } from '../state/catchup';
import { mergeForms, type FilledForm } from './fill';
import { Layout, winAnsi } from './reviewPackage';

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const usdCents = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const masked = (ssn: string) => { const d = ssn.replace(/\D/g, ''); return d.length === 9 ? `***-**-${d.slice(5)}` : '(not entered)'; };

/** The IRS asks for the notation "at the top of the first page of each delinquent or amended tax return and at the top of each information return". */
export const isStamped = (formId: string) => formId === '1040' || formId === '8938' || /^(8621|3520|3520a)-/.test(formId);

/** Prints the notation in red in the top margin of page 1 (bytes keep their fillable fields). */
export async function stampRed(bytes: Uint8Array, text: string = SFOP.notation): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 11;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - width) / 2, y: page.getHeight() - 14, size, font, color: rgb(0.85, 0, 0) });
  return doc.save();
}

export interface YearForms { year: number; forms: FilledForm[] }

/** Each year's return and information returns with the red notation, oldest year first, as one PDF. Form 3520 forms go with their year. */
export async function buildMailPackage(years: YearForms[]): Promise<Uint8Array> {
  const all: FilledForm[] = [];
  for (const y of [...years].sort((a, b) => a.year - b.year)) {
    const ordered = [...y.forms.filter((f) => !f.packet), ...y.forms.filter((f) => f.packet)];
    for (const f of ordered) all.push(isStamped(f.id) ? { ...f, bytes: await stampRed(f.bytes) } : f);
  }
  return mergeForms(all);
}

async function startDoc(title: string, footer: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('Lou');
  const L = new Layout(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold), footer);
  return { doc, L };
}

/** A table row: the first cell on the left, the rest right-aligned to the given right edges (points from the left margin). */
function tableRow(L: Layout, cells: string[], edges: number[], bold = false) {
  const size = 9.5;
  const font = bold ? L.bold : L.font;
  L.ensure(size + 3);
  cells.forEach((cell, i) => {
    const t = winAnsi(cell);
    const x = i === 0 ? L.left : L.left + edges[i] - font.widthOfTextAtSize(t, size);
    L.page.drawText(t, { x, y: L.y, size, font });
  });
  L.y -= size + 3;
}
const MONEY_EDGES = [0, 220, 360, 504];
const DAYS_EDGES = [0, 220, 360, 504];

export interface CatchupPackageInput {
  plan: SfopPlan;
  catchup: CatchupState;
  name: string;
  ssn: string;
  phoneNote?: string;
  address: string;
  /** Return years with their tax and interest. */
  years: { year: number; tax: number; interest: number; formTitles: string[] }[];
  payDate: string;
  fbar: FbarSummary[];
  preparedOn: string;
}

const FOOTER = (p: CatchupPackageInput, what: string) =>
  `${p.name} - ${what} - prepared with Lou on ${p.preparedOn}. Lou is software, not a tax preparer. Review everything before you sign.`;

/** The cover sheet and mailing checklist. */
export async function buildCoverSheet(p: CatchupPackageInput): Promise<Uint8Array> {
  const { doc, L } = await startDoc(`Streamlined Foreign Offshore cover sheet - ${p.name}`, FOOTER(p, 'cover sheet'));
  const totalTax = p.years.reduce((a, y) => a + y.tax, 0);
  const totalInterest = Math.round(p.years.reduce((a, y) => a + y.interest, 0) * 100) / 100;

  L.text(`${SFOP.notation} submission`, { size: 18, bold: true, gap: 4 });
  L.text('Cover sheet. Put this on top of the package.', { size: 10.5, gap: 8 });
  L.heading('Send to');
  for (const line of SFOP.mailTo) L.text(line, { bold: line.startsWith('Attn') });
  L.heading('From');
  L.text(p.name);
  L.text(p.address);
  L.text(`Social Security number: ${masked(p.ssn)} (the full number is on each return)`);

  L.heading('What is enclosed');
  L.text(`Delinquent US income tax returns (Form 1040) for ${p.years.map((y) => y.year).join(', ')}, each with "${SFOP.notation}" in red at the top of page 1, with the information returns that go with them.`, { gap: 3 });
  for (const y of p.years) L.text(`${y.year}: ${y.formTitles.join(', ')}`, { indent: 12 });
  L.text('', { gap: 3 });
  L.text('Form 14653, Certification by U.S. Person Residing Outside of the United States for Streamlined Foreign Offshore Procedures: the signed original, plus a copy attached to each return and each information return.');
  L.text(`Payment of the tax and interest shown below, with my Social Security number on the check.`, { gap: 6 });

  L.heading('Tax and interest');
  tableRow(L, ['Year', 'Tax', 'Interest', 'Total'], MONEY_EDGES, true);
  for (const y of p.years) tableRow(L, [String(y.year), usdCents(y.tax), usdCents(y.interest), usdCents(y.tax + y.interest)], MONEY_EDGES);
  L.rule();
  tableRow(L, ['Total payment enclosed', usdCents(totalTax), usdCents(totalInterest), usdCents(totalTax + totalInterest)], MONEY_EDGES, true);
  L.text(`Interest is Lou's estimate to ${p.payDate} (IRC 6601, 6621 and 6622). The IRS may bill or refund a difference.`, { size: 8.5, gap: 4 });

  const fbarYears = p.fbar.filter((f) => f.status === 'file');
  L.heading('FBARs filed electronically with FinCEN');
  L.text(fbarYears.length ? `FBARs (FinCEN Form 114) for ${fbarYears.map((f) => f.year).join(', ')}, filed on BSA E-Filing as part of the ${SFOP.fbarReason}.` : 'No FBAR was required for the years covered.');

  // ---- Checklist ----
  L.newPage();
  L.text('Before you mail it: checklist', { size: 16, bold: true, gap: 6 });
  const steps: [string, string][] = [
    ['File the FBARs first', `${fbarYears.length ? `Years ${fbarYears.map((f) => f.year).join(', ')}. ` : ''}Use bsaefiling.fincen.treas.gov, "File FBAR as an Individual". On each late FBAR, choose "Other" as the reason for filing late and type "${SFOP.fbarReason}". Form 14653 says you have now filed them, so do this before you sign it. The FBAR worksheets have every value.`],
    ['Fill in the official Form 14653', 'Open the blank form Lou saved for you in Adobe Acrobat Reader (a browser shows a blank page). Type in the entries from the Form 14653 worksheet, paste your statement of facts, sign it, and date it. Check only the boxes you can truthfully check.'],
    ['Check the red notation', `The returns and information returns from Lou already have "${SFOP.notation}" printed in red at the top of page 1. If your printer prints only in black and white, write it by hand in red ink at the top of page 1 of each Form 1040, Form 8938, Form 8621, Form 3520 and Form 3520-A.`],
    ['Sign every return', 'Sign and date page 2 of each Form 1040 (both spouses on a joint return).'],
    ['Copy and attach Form 14653', 'Keep the signed original on top of the package. Attach a copy of it to each return and to each information return.'],
    ['Pay', `Pay all the tax and interest shown above. The IRS asks for the payment with the package and for your Social Security number on the check. A US-dollar cheque on a US bank is the usual way. If you cannot get one, call the IRS streamlined line at ${SFOP.hotline} before you mail.`],
    ['Mail it on paper', 'Electronic submissions are not accepted. Use a tracked service and keep the receipt. Send everything in one envelope, in this order: this cover sheet, Form 14653 (original), then each year oldest first, with its information returns behind it.'],
    ['Keep your records', 'Form 14653 promises to keep records of your income and assets for three years from the date you sign it, and account statements for your foreign accounts for six years. The IRS can ask for them.'],
  ];
  steps.forEach(([t, d], i) => { L.text(`${i + 1}. ${t}`, { bold: true }); L.text(d, { indent: 14, gap: 5 }); });
  L.text('Lou is software, not a tax preparer. You sign the returns and Form 14653 under penalty of perjury. If anything on this sheet does not fit your situation, ask a qualified professional before you send it.', { size: 8.5 });
  return doc.save();
}

/** Every entry for the official Form 14653, with the statement of facts exactly as the person wrote it. */
export async function buildForm14653Worksheet(p: CatchupPackageInput): Promise<Uint8Array> {
  const { doc, L } = await startDoc(`Form 14653 worksheet - ${p.name}`, FOOTER(p, 'Form 14653 worksheet'));
  const c = p.catchup;
  L.text('Form 14653 worksheet', { size: 18, bold: true, gap: 4 });
  L.text('Certification by U.S. Person Residing Outside of the United States for Streamlined Foreign Offshore Procedures (Rev. 3-2025)', { size: 10.5, gap: 8 });
  L.text('The IRS form is an Adobe form: it only fills in on Adobe Acrobat Reader, so Lou cannot fill it for you. Open the blank form Lou saved with your package in Adobe Acrobat Reader and type each entry below into it. Your statement of facts is in your own words, exactly as you wrote it in Lou. Lou has not added to it or changed it.', { gap: 6 });

  L.heading('Top of the form');
  L.row('Name(s) of taxpayer(s)', p.name);
  L.row('TIN(s) of taxpayer(s)', 'Your Social Security number, as on your returns');
  L.row('Address', p.address);
  L.row('Telephone number', 'Add yours');

  L.heading('Certification: tax and interest for each year');
  L.text('"I am providing delinquent or amended income tax returns, including all required information returns, for each of the most recent 3 years for which the U.S. tax return due date (or properly applied for extended due date) has passed. The tax and interest I owe for each year are as follows"', { size: 8.5, gap: 4 });
  tableRow(L, ['Year', 'Tax (Form 1040)', 'Interest', 'Total'], MONEY_EDGES, true);
  for (const y of p.years) tableRow(L, [String(y.year), usdCents(y.tax), usdCents(y.interest), usdCents(y.tax + y.interest)], MONEY_EDGES);
  const tTax = p.years.reduce((a, y) => a + y.tax, 0);
  const tInt = Math.round(p.years.reduce((a, y) => a + y.interest, 0) * 100) / 100;
  L.rule();
  tableRow(L, ['Total', usdCents(tTax), usdCents(tInt), usdCents(tTax + tInt)], MONEY_EDGES, true);
  L.text(`Interest is Lou's estimate to ${p.payDate}. The form says your payment should equal the total tax and interest for all three years and that you may get a balance due notice or a refund if it was not figured correctly.`, { size: 8.5, gap: 4 });

  L.heading('The boxes you may check');
  L.text('These are your own statements, made under penalty of perjury. Lou does not check any of them for you. Check one only if it is true.', { gap: 4 });
  const boxes = [
    'I failed to report income from one or more foreign financial assets during the above period.',
    'I meet all the other eligibility requirements for the Streamlined Foreign Offshore procedures.',
    'If I failed to timely file correct and complete FBARs for any of the last six years, I have now electronically filed those FBARs.',
    'I agree to retain all records related to my income and assets during the period covered by my delinquent or amended returns until three years from the date of this certification. If I was required to file delinquent FBARs in accordance with these procedures, I also agree to retain all records (including, but not limited to, account statements) related to my foreign financial accounts until six years from the date of this certification. Upon request, I agree to provide all such records to the Internal Revenue Service.',
    'My failure to report all income, pay all tax, and submit all required information returns, including FBARs, was due to non-willful conduct. I understand that non-willful conduct is conduct that is due to negligence, inadvertence, or mistake or conduct that is the result of a good faith misunderstanding of the requirements of the law.',
    'I recognize that if the Internal Revenue Service receives or discovers evidence of willfulness, fraud, or criminal conduct, it may open an examination or investigation that could lead to civil fraud penalties, FBAR penalties, information return penalties, or even referral to Criminal Investigation.',
    'I meet the non-residency requirements for the Streamlined Foreign Offshore procedures as disclosed below.',
  ];
  for (const b of boxes) L.text(`[  ]  ${b}`, { size: 8.5, indent: 4, gap: 3 });

  L.heading('Residency: at least 330 full days outside the US');
  L.text('"If you are a U.S. citizen or lawful permanent resident (i.e., green card holder), complete this section." Answer Yes or No for each year, from the days you told Lou you spent in the US (any part of a day counts as a day in the US).', { size: 9, gap: 4 });
  tableRow(L, ['Year', 'Days in the US', 'Full days outside', 'Answer'], DAYS_EDGES, true);
  for (const y of p.years) {
    const d = c.daysInUs[y.year] ?? 0;
    tableRow(L, [String(y.year), String(d), String(fullDaysOutside(y.year, d)), meets330(y.year, d) ? 'Yes' : 'No'], DAYS_EDGES);
  }
  L.text('You must have been outside the US for at least 330 full days in any one or more of the three years, and you must not have had a US abode (IRS Publication 54). If you and your spouse certify together, both of you must meet it, and if your days differ, say so on the form or in an attachment.', { size: 8.5, gap: 4 });

  L.newPage();
  L.text('Statement of facts', { size: 16, bold: true, gap: 4 });
  L.text('"Provide specific reasons for your failure to report all income, pay all tax, and submit all required information returns, including FBARs. Include the whole story including favorable and unfavorable facts." The form\'s field grows to fit your statement. Paste this text into it.', { size: 9, gap: 6 });
  const written = (id: string) => (c.statement[id] ?? '').trim();
  for (const pr of STATEMENT_PROMPTS) {
    if (pr.optional && !written(pr.id)) continue;
    L.text(pr.label, { bold: true });
    L.text(written(pr.id) || '(You left this blank in Lou. The form asks for it. Add your answer before you sign.)', { indent: 10, gap: 6, color: written(pr.id) ? undefined : [0.55, 0.15, 0.15] });
  }
  const accts = distinctAccounts(p.fbar);
  if (accts.length) {
    L.text('Your Canadian accounts: where the money came from and how you used them', { bold: true, gap: 2 });
    L.text(ACCOUNT_PROMPT_HELP, { size: 8.5, gap: 3 });
    for (const a of accts) {
      const id = accountPromptId(a);
      L.text(`${ACCOUNT_KIND_LABEL[a.kind]} at ${a.institution || '(institution)'}${a.accountNumber ? `, account ${a.accountNumber}` : ''}`, { bold: true, indent: 6 });
      L.text(written(id) || '(Left blank in Lou. The form asks you to explain this for each account.)', { indent: 14, gap: 5, color: written(id) ? undefined : [0.55, 0.15, 0.15] });
    }
  }

  L.heading('Signature');
  L.text('"Under penalties of perjury, I declare that I have examined this certification and all accompanying schedules and statements, and to the best of my knowledge and belief, they are true, correct, and complete."', { size: 9, gap: 4 });
  L.text('Sign and date the original in ink. A joint certification needs both spouses. Make copies for each return and each information return.');
  return doc.save();
}

/** The FBAR worksheets for every FBAR year, one section per year. */
export async function buildFbarWorksheets(p: CatchupPackageInput, names: { taxpayer: string; spouse: string }): Promise<Uint8Array> {
  const { doc, L } = await startDoc(`FBAR worksheets - ${p.name}`, FOOTER(p, 'FBAR worksheets'));
  L.text('FBAR worksheets', { size: 18, bold: true, gap: 4 });
  L.text(`File each FBAR at bsaefiling.fincen.treas.gov ("File FBAR as an Individual"), one report per calendar year. For each FBAR filed after October 15 of the year after the year it covers, choose "Other" as the reason for filing late and type "${SFOP.fbarReason}". Values use the US Treasury rate for December 31 of each year, rounded up to the next whole dollar.`, { gap: 6 });
  for (const f of p.fbar) {
    L.heading(`FBAR for ${f.year}`);
    if (!f.analysis) { L.text(f.noAccounts ? 'No Canadian accounts this year, so no FBAR.' : 'No accounts entered for this year yet.'); continue; }
    const needed = f.analysis.fbar.some((x) => x.required);
    L.text(`Treasury rate for December 31, ${f.year}: ${f.analysis.rate} CAD per USD.`, { size: 9, gap: 3 });
    if (needed) {
      const late = new Date(`${p.preparedOn}T00:00:00Z`) > new Date(`${fbarLateAfter(f.year)}T00:00:00Z`);
      L.text(late ? `Late FBAR: reason "Other", explanation "${SFOP.fbarReason}".` : `Not late yet (due October 15, ${f.year + 1}). File it with the others. No late reason is needed.`, { size: 9, gap: 3 });
    }
    for (const filer of f.analysis.fbar) {
      const who = filer.owner === 'spouse' ? names.spouse : names.taxpayer;
      L.text(`${who}: highest balances add up to ${usd(filer.aggregateMaxUsd)}. ${filer.required ? 'An FBAR is required (over $10,000).' : 'No FBAR is needed (it takes more than $10,000).'}`, { bold: true, gap: 2 });
      if (!filer.required) continue;
      const rows = f.analysis.rows.filter((r) => r.account.kind !== 'pension' && (r.account.owner === filer.owner || r.account.owner === 'joint'));
      rows.forEach((r, i) => {
        const t = fbarType(r.account.kind);
        const a = r.account;
        L.text(`${i + 1}. ${a.owner === 'joint' ? 'Part III (joint)' : 'Part II (separate)'} - Item 15 maximum value ${usd(r.fbarMaxUsd)} - Item 16 type ${t.type}${t.other ? ` (${t.other})` : ''}`, { indent: 8 });
        L.text(`${a.institution}, ${[a.street, a.city, a.province, a.postalCode, 'Canada'].filter(Boolean).join(', ')} - account number ${a.accountNumber || '(enter)'}`, { indent: 20, gap: 3, size: 9 });
      });
    }
  }
  return doc.save();
}

