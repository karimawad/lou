// "How to read this return": a plain note that goes with the filled forms when someone else checks them.
// Built from the computed return so every figure in it matches the forms. It answers the questions a
// reader tends to have when going through the PDF: why there are two sets of Forms 1116, where a small
// total tax comes from, and what the foreign account and trust answers on Schedule B mean.

import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { ReturnResult } from '../tax/compute';
import type { ReturnInput } from '../tax/model';
import { Layout } from './reviewPackage';

export interface GuideNote { title: string; body: string }

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const cat = (c: string) => (c === 'general' ? 'general' : 'passive');

/** Notes for the reader, in the order the questions usually come up. Only notes that apply to this return are returned. */
export function readingGuideNotes(input: ReturnInput, r: ReturnResult): GuideNote[] {
  const notes: GuideNote[] = [];
  const l = r.f1040;
  const credit = r.schedule3['1'] ?? 0;

  // ---- Regular credit versus AMT credit ----
  if (r.f1116.length) {
    const parts = r.f1116.map((f) => `${cat(f.category)} ${usd(f.lines['24'])}`).join(', ');
    let body = `Form 1040 line 20 (from Schedule 3 line 1) is ${usd(credit)}. It is the sum of line 24 on the regular Forms 1116: ${parts}. `
      + `The credit is capped at the regular tax on line 16 (${usd(l['16'] ?? 0)})${credit >= (l['16'] ?? 0) && credit > 0 ? ', so here it wipes out the regular tax' : ''}.`;
    const amt = r.f6251.f1116.filter((f) => f.lines['24'] !== undefined);
    if (r.f6251.mustFile && amt.length) {
      body += ` The Forms 1116 stamped "AMT" in the top margin are a different calculation. They figure the alternative minimum tax foreign tax credit for Form 6251 line 8 (${usd(r.f6251.lines['8'] ?? 0)}: `
        + `${amt.map((f) => `${cat(f.category)} ${usd(f.lines['24'])}`).join(', ')}), using AMT income. Their amounts are not meant to match Schedule 3. `
        + 'They follow Form 6251 in the packet and are attached because the AMT credit differs from the regular credit (Instructions for Form 6251, Step 6).';
    }
    notes.push({ title: 'Two sets of Forms 1116: regular credit and AMT credit', body });
  }

  // ---- Alternative minimum tax ----
  if (r.f6251.mustFile) {
    notes.push({ title: 'Alternative minimum tax',
      body: `Form 6251 is attached because line 7 (${usd(r.f6251.lines['7'] ?? 0)}) is more than line 10 (${usd(r.f6251.lines['10'] ?? 0)}); the instructions require it in that case even when no AMT is due. `
        + `The alternative minimum tax is ${usd(r.f6251.amt)} (Form 6251 line 11, Schedule 2 line ${input.year === 2023 ? '1' : '2'}).` });
  }

  // ---- Where the total tax comes from ----
  const niit = r.schedule2['12'] ?? 0;
  const interest = r.schedule2['17p'] ?? 0;
  const parts: string[] = [];
  parts.push(`Line 22 (regular tax after credits) is ${usd(l['22'] ?? 0)}`);
  if (r.f6251.amt > 0) parts.push(`alternative minimum tax ${usd(r.f6251.amt)}`);
  if (niit > 0) parts.push(`net investment income tax ${usd(niit)} (Form 8960, Schedule 2 line 12)`);
  if (interest > 0) parts.push(`interest on the section 1291 tax ${usd(interest)} (Schedule 2 line 17p)`);
  notes.push({ title: 'How the total tax is made up',
    body: `${parts.join('; ')}. Line 24 (total tax) is ${usd(l['24'] ?? 0)}. `
      + (niit > 0 && niit <= 25 ? 'A net investment income tax of a few dollars is normal when income is above the Form 8960 threshold and investment income is small: it is 3.8% of the smaller of that income or the amount over the threshold. ' : '')
      + 'Canadian tax withheld is not a US payment, so line 25 is zero; the Canadian tax appears only as the foreign tax credit.' });

  // ---- Foreign accounts ----
  const accounts = input.accounts ?? [];
  const yes = accounts.length > 0 || input.foreignAccountsOver10k !== false;
  notes.push({ title: 'Foreign accounts on Schedule B and Form 8938',
    body: `Schedule B Part III line 7a is ${yes ? 'Yes' : 'No'} and the FBAR question under it is ${input.foreignAccountsOver10k === false ? 'No' : 'Yes'}; the country is Canada. `
      + `The boxes are check marks on the form, so a reader who only extracts text from the PDF will not see them. ${accounts.length ? `Form 8938 lists ${accounts.length} Canadian account${accounts.length === 1 ? '' : 's'} where the filing threshold is met. ` : ''}`
      + 'Form 8938 does not replace the FBAR. The FBAR (FinCEN Form 114) is filed online through FinCEN BSA E-Filing, not with the return; Lou provides a worksheet with each value.' });

  // ---- Foreign trust question ----
  notes.push({ title: 'Schedule B line 8 (foreign trust)',
    body: r.trusts.length
      ? `Line 8 is Yes because a TFSA or FHSA is reported on Form 3520 with a substitute Form 3520-A (${r.trusts.map((t) => t.trustName).join(', ')}). Those forms are mailed separately, not with the 1040.`
      : 'Line 8 is No: no TFSA or FHSA is reported on Form 3520 for this return.' });

  // ---- Wages and treaty items ----
  if (r.items.some((i) => i.usLine === '1h')) {
    notes.push({ title: 'Canadian wages',
      body: `Canadian employment income is on Form 1040 line 1h (Other earned income), not line 1a, which is for Form W-2 box 1 only (${usd(l['1h'] ?? 0)} on line 1h). CPP, QPP and EI are not creditable foreign taxes under the Canada-US Totalization Agreement.` });
  }
  if (r.needsForm8833) {
    notes.push({ title: 'Form 8833',
      body: 'Included voluntarily to disclose the treaty treatment of Canada Pension Plan and Old Age Security. Treas. Reg. 301.6114-1(c)(1)(iv) waives the requirement for social security and pension positions.' });
  }

  // ---- Credit uses Canadian tax actually owed ----
  if (r.f1116.length) {
    notes.push({ title: 'Where the foreign tax figure comes from',
      body: `Form 1116 uses Canadian tax owed for the year from the T1 or Notice of Assessment (${Math.round(r.canadianTaxCad).toLocaleString('en-US')} CAD in total), not the withholding in T4 box 22.` });
  }
  return notes;
}

/** Writes the notes into an open layout (used by the review package). */
export function writeReadingGuide(L: Layout, notes: GuideNote[]) {
  L.heading('How to read this return');
  for (const n of notes) {
    L.ensure(40);
    L.text(n.title, { bold: true, gap: 1 });
    L.text(n.body, { size: 9, indent: 10, gap: 5 });
  }
}

/** A short standalone PDF to send with the filled forms. */
export async function buildReadingGuide(input: ReturnInput, r: ReturnResult, preparedOn: string): Promise<Uint8Array> {
  const name = `${input.taxpayer.firstName} ${input.taxpayer.lastName}`.trim() || 'Taxpayer';
  const doc = await PDFDocument.create();
  doc.setTitle(`How to read this return - ${name} - ${input.year}`);
  doc.setCreator('Lou');
  const L = new Layout(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold),
    `${name} - ${input.year} US return - prepared with Lou on ${preparedOn}. Lou is software, not a paid preparer.`);
  L.text('How to read this return', { size: 18, bold: true, gap: 6 });
  L.text(`${name} - tax year ${input.year}. This note goes with the filled IRS forms. It explains the parts that often look odd on a first read. Every figure comes from the same calculation as the forms. The taxpayer signs the return; Lou is software, not a paid preparer.`, { gap: 6 });
  for (const n of readingGuideNotes(input, r)) {
    L.ensure(40);
    L.text(n.title, { bold: true, gap: 1 });
    L.text(n.body, { size: 9, indent: 10, gap: 5 });
  }
  return doc.save();
}
