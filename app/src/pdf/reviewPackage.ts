// Review package for a tax professional: one PDF with a summary, every number on the return with where
// it came from (document, read confidence, US destination, primary source), the taxpayer's choices,
// every warning, then the filled IRS forms and images of the source documents. Built on the device.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { incomeSlips } from '../state/t1';
import type { AppState } from '../state/store';
import type { ReturnResult } from '../tax/compute';
import type { Flag, ReturnInput } from '../tax/model';
import { SLIPS } from '../tax/slips';
import { YEARS } from '../tax/years';
import { T1_INCOME_LINES } from '../extract/t1';
import { COUNTS_ON_RETURN, destination, t1LineLabel } from '../screens/destination';
import { DISPLAY_ORDER, F1040_LABELS, f1040Line } from '../screens/lines';
import { confidenceOf } from '../screens/provenance';
import { SLIP_LABEL } from '../screens/slipLabels';
import type { FilledForm } from './fill';

export interface SourcePage { doc: string; page: number; png: Uint8Array }

export interface PackageInput {
  state: AppState;
  input: ReturnInput;
  result: ReturnResult;
  /** Every warning shown on the results screen. */
  flags: Flag[];
  /** Filled forms (the return and, if any, the Form 3520 package). */
  forms: FilledForm[];
  /** Page images of the uploaded documents, as kept for the review screen. */
  sourcePages: SourcePage[];
  /** Date shown on the cover (ISO). */
  preparedOn: string;
}

/** Standard PDF fonts only encode WinAnsi: replace the few characters Lou's text uses outside it. */
export function winAnsi(text: string): string {
  return text
    .replace(/[→⇒]/g, '->').replace(/≈/g, '~').replace(/[·•]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/×/g, 'x').replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

const STATUS: Record<string, string> = {
  single: 'Single', mfj: 'Married filing jointly', mfs: 'Married filing separately', hoh: 'Head of household', qss: 'Qualifying surviving spouse',
};
const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const cad = (n: number) => `${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`;
const masked = (ssn: string) => { const d = ssn.replace(/\D/g, ''); return d.length === 9 ? `***-**-${d.slice(5)}` : 'none'; };

/** A simple flowing text layout on US Letter pages. */
class Layout {
  page!: PDFPage;
  y = 0;
  readonly left = 54;
  readonly width = 612 - 108;
  readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly footer: string;
  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, footer: string) {
    this.doc = doc; this.font = font; this.bold = bold; this.footer = footer;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([612, 792]);
    this.y = 740;
    this.page.drawText(winAnsi(this.footer), { x: this.left, y: 30, size: 7.5, font: this.font, color: rgb(0.4, 0.4, 0.4) });
  }
  ensure(h: number) { if (this.y - h < 54) this.newPage(); }
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of winAnsi(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > width) { out.push(line); line = word; } else line = next;
      }
      out.push(line);
    }
    return out;
  }
  text(text: string, opts: { size?: number; bold?: boolean; indent?: number; gap?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 9.5;
    const font = opts.bold ? this.bold : this.font;
    const indent = opts.indent ?? 0;
    for (const line of this.wrap(text, font, size, this.width - indent)) {
      this.ensure(size + 3);
      this.page.drawText(line, { x: this.left + indent, y: this.y, size, font, color: opts.color ? rgb(...opts.color) : undefined });
      this.y -= size + 3;
    }
    this.y -= opts.gap ?? 0;
  }
  heading(text: string) { this.ensure(40); this.y -= 8; this.text(text, { size: 13, bold: true, gap: 4 }); }
  /** Label on the left, value right-aligned in a fixed column. */
  row(label: string, value: string, opts: { bold?: boolean } = {}) {
    const size = 9.5;
    this.ensure(size + 3);
    const font = opts.bold ? this.bold : this.font;
    this.page.drawText(winAnsi(label), { x: this.left, y: this.y, size, font });
    const v = winAnsi(value);
    this.page.drawText(v, { x: this.left + this.width - font.widthOfTextAtSize(v, size), y: this.y, size, font });
    this.y -= size + 3;
  }
  rule() { this.ensure(8); this.page.drawLine({ start: { x: this.left, y: this.y + 4 }, end: { x: this.left + this.width, y: this.y + 4 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); this.y -= 6; }
}

export async function buildReviewPackage(p: PackageInput): Promise<Uint8Array> {
  const { state, input, result: r, flags } = p;
  const year = input.year;
  const rate = YEARS[year].irsAvgCadPerUsd;
  const name = `${input.taxpayer.firstName} ${input.taxpayer.lastName}`.trim() || 'Taxpayer';
  const doc = await PDFDocument.create();
  doc.setTitle(`Review package - ${name} - ${year}`);
  doc.setCreator('Lou');
  const L = new Layout(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold),
    `${name} - ${year} US return - review package prepared with Lou on ${p.preparedOn}. Lou is software, not a paid preparer.`);

  // ---- Cover and summary ----
  L.text('Review package for a tax professional', { size: 18, bold: true, gap: 6 });
  L.text(`${name} - tax year ${year} - ${STATUS[input.filingStatus] ?? input.filingStatus} - prepared ${p.preparedOn}`, { size: 10.5, gap: 8 });
  L.text('The taxpayer prepared this return with Lou, free software that reads Canadian tax documents on the taxpayer\'s own device and fills the official IRS forms. Lou is not a paid preparer and no one at Lou has seen this return. This package shows every number on the return, where it came from, how sure Lou was of each read, the rule Lou followed, the choices the taxpayer made, and every warning Lou raised. The filled IRS forms and images of the source documents follow.', { gap: 6 });
  L.heading('Taxpayer');
  L.row('Name', name);
  L.row('SSN', masked(input.taxpayer.ssn));
  L.row('Address', `${input.address.street}, ${input.address.city}, ${input.address.province} ${input.address.postalCode}, Canada`);
  if (input.spouse) {
    L.row('Spouse', `${input.spouse.firstName} ${input.spouse.lastName}`.trim() || '(no name)');
    L.row('Spouse SSN or ITIN', masked(input.spouse.ssn));
    L.row('Spouse is a US citizen or green card holder', state.spouseIsUsPerson === true ? 'Yes' : state.spouseIsUsPerson === false ? 'No' : 'Not answered');
  }
  L.row('Lived in Canada all year', state.livedInCanadaAllYear ? 'Yes' : 'No');
  L.row('Exchange rate for income', `${rate} CAD = 1 USD (IRS yearly average for ${year})`);

  L.heading('Form 1040 at a glance');
  for (const key of DISPLAY_ORDER) {
    const v = r.f1040[key];
    const line = f1040Line(year, key);
    if (!v || !line) continue;
    L.row(`Line ${line}  ${F1040_LABELS[key] ?? ''}`, usd(v), { bold: ['15', '24', '34', '37'].includes(key) });
  }
  L.row(r.refund >= 0 ? 'Refund' : 'Amount owed', usd(Math.abs(r.refund)), { bold: true });
  L.text(`Foreign tax credit vs. foreign earned income exclusion: ${r.usedFeie ? 'the exclusion (Form 2555) is used' : 'the credit (Form 1116) is used'} (taxpayer's choice: ${state.elections.feie === 'auto' ? 'let Lou compare' : state.elections.feie === 'yes' ? 'exclusion' : 'credit only'}).`, { gap: 2 });
  L.text(`Forms: ${p.forms.map((f) => f.title).join(', ')}.`);

  // ---- Every number ----
  L.heading('Every number and where it came from');
  L.text(`One entry per amount the taxpayer confirmed. "Read" says how Lou got it: Exact = copied from a PDF form field or CSV; High = read from a PDF's text by position; Good = read from a photo or scan; Low = Lou was unsure and asked the taxpayer to check. Amounts the taxpayer typed or corrected say so. US dollars use ${rate} CAD = 1 USD.`, { size: 8.5, gap: 6, color: [0.3, 0.3, 0.3] });
  for (const s of incomeSlips(state)) {
    if (s.year && s.year !== year) continue;
    const docName = state.docs.find((d) => d.id === s.docId)?.name;
    for (const [box, value] of Object.entries(s.boxes)) {
      // A T1's income lines appear as the slips made from them (or as checks), not twice.
      if (s.type === 'NOA' && T1_INCOME_LINES.some((l) => l.box === box)) continue;
      const label = s.type === 'NOA' ? t1LineLabel(box) : SLIPS[s.type].boxes.find((b) => b.box === box)?.label ?? `Box ${box}`;
      const d = destination(s.type, box, { socialSecurityExempt: state.elections.canadianSocialSecurityExempt });
      const conf = confidenceOf(s.reads[box], s.edited.includes(box), s.fromT1Line);
      const counts = d.treatment !== 'noa' && COUNTS_ON_RETURN.has(d.treatment);
      const what = s.type === 'NOA' ? (s.payer === 'T1 return' ? 'T1 return' : 'Notice of Assessment') : `${SLIP_LABEL[s.type]}${s.payer ? ` - ${s.payer}` : ''}`;
      const owner = input.spouse ? ` Belongs to: ${s.owner === 'spouse' ? 'spouse' : 'taxpayer'}.` : '';
      const lines = [
        `Read: ${conf.label}. ${conf.detail}${docName ? ` Document: ${docName}.` : ''}${owner}`,
        `Goes to: ${d.where}.${d.why ? ` ${d.why}` : ''}`,
        ...(d.source ? [`Source: ${d.source}`] : []),
      ];
      // Keep each entry on one page.
      L.ensure(20 + lines.reduce((h, t) => h + L.wrap(t, L.font, 8.5, L.width - 10).length * 11.5, 0));
      L.rule();
      L.row(`${what} - ${s.type === 'NOA' ? 'line' : 'box'} ${box.replace('QC', '')} ${label}`, `${cad(value)}${counts ? `   ${usd(value / rate)}` : ''}`, { bold: true });
      lines.forEach((t, i) => L.text(t, { size: 8.5, indent: 10, color: i === 2 ? [0.3, 0.3, 0.3] : undefined }));
    }
  }

  // ---- Choices ----
  L.heading('Choices and answers');
  const choice = (q: string, a: string) => L.text(`${q}: ${a}`, { indent: 0, gap: 1 });
  choice('Filing status', STATUS[input.filingStatus] ?? input.filingStatus);
  choice('CPP, QPP and OAS', state.elections.canadianSocialSecurityExempt ? 'treated as exempt under the treaty, disclosed on Form 8833' : 'included in US income');
  choice('Foreign tax credit or exclusion', state.elections.feie === 'auto' ? `Lou compared both; ${r.usedFeie ? 'the exclusion' : 'the credit'} gave the lower tax` : state.elections.feie === 'yes' ? 'exclusion (Form 2555)' : 'credit only (Form 1116)');
  for (const s of incomeSlips(state)) {
    const a = s.answers;
    if (!a) continue;
    const what = s.fromT1Line ? `T1 line ${s.fromT1Line}` : `${SLIP_LABEL[s.type]}${s.payer ? ` from ${s.payer}` : ''}`;
    if (a.dividendSource) choice(`Dividends on ${what}`, a.dividendSource === 'company' ? `shares of companies${a.metHoldingPeriod === false ? ' (holding period not met)' : ''}` : 'a mutual fund or ETF (PFIC)');
    if (a.rrspKind) choice(`RRSP income on ${what}`, a.rrspKind === 'annuity' ? 'annuity payments (T4RSP box 16)' : 'a withdrawal (T4RSP box 22)');
    if (a.usBasisCad) choice(`US basis in ${what}`, cad(a.usBasisCad));
  }
  const v = input.carryover?.vintages ?? [];
  choice('Foreign tax credit carried in from earlier years', v.length ? v.map((x) => `${x.year}: general ${usd(x.general)}, passive ${usd(x.passive)}`).join('; ') : 'none');
  if (input.carryover?.amtVintages?.length) choice('AMT foreign tax credit carried in', input.carryover.amtVintages.map((x) => `${x.year}: general ${usd(x.general)}, passive ${usd(x.passive)}`).join('; '));
  if (input.capitalLossCarryover) choice('Capital loss carried in', `short-term ${usd(input.capitalLossCarryover.shortTerm)}, long-term ${usd(input.capitalLossCarryover.longTerm)}`);
  choice('Canadian accounts listed', state.noAccounts ? 'taxpayer said there are none' : `${state.accounts.length}${state.accounts.length ? ` (${state.accounts.map((a) => `${a.kind.toUpperCase()} at ${a.institution || 'an institution'}`).join('; ')})` : ''}`);
  for (const a of state.accounts.filter((x) => x.registered)) {
    if (a.kind === 'tfsa' || a.kind === 'fhsa') choice(`${a.kind.toUpperCase()} at ${a.institution}`, a.registered?.file3520 === false ? 'taxpayer chose not to file Form 3520 / 3520-A' : 'Form 3520 and substitute 3520-A filed');
  }
  if (state.businesses?.length) choice('Self-employment', state.businesses.map((b) => b.name || b.activity).join('; '));
  if (state.sales?.length) choice('Sales of investments', `${state.sales.length} sale${state.sales.length === 1 ? '' : 's'} on Form 8949`);
  if (state.pficFunds?.length) choice('Canadian funds (PFICs)', state.pficFunds.map((f) => `${f.name} (${f.regime === '1291' ? 'section 1291' : f.regime.toUpperCase()})`).join('; '));

  // ---- Warnings ----
  L.heading('Warnings Lou raised');
  if (!flags.length) L.text('None.');
  const sev = { block: 'Must fix', warn: 'Check', info: 'Note' } as const;
  for (const f of flags) {
    L.ensure(30);
    L.text(`${sev[f.severity]}: ${f.title}`, { bold: true });
    L.text(f.detail, { size: 8.5, indent: 10, gap: 3 });
  }

  // ---- Appendix A: forms ----
  for (const form of p.forms) {
    const src = await PDFDocument.load(form.bytes);
    src.getForm().flatten();
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => doc.addPage(pg));
  }

  // ---- Appendix B: source documents ----
  if (p.sourcePages.length) {
    L.newPage();
    L.text('Source documents', { size: 13, bold: true, gap: 4 });
    L.text('Page images of the documents the taxpayer uploaded, as Lou read them.', { gap: 4 });
    for (const sp of p.sourcePages) {
      const img = await doc.embedPng(sp.png);
      const page = doc.addPage([612, 792]);
      const scale = Math.min(504 / img.width, 680 / img.height);
      const w = img.width * scale; const h = img.height * scale;
      page.drawText(winAnsi(`${sp.doc} - page ${sp.page + 1}`), { x: 54, y: 752, size: 9, font: L.font });
      page.drawImage(img, { x: (612 - w) / 2, y: 740 - h, width: w, height: h });
    }
  }
  return doc.save();
}
