// Fills the official IRS PDFs from a computed return, entirely in the browser.
// Fields stay editable so the user can correct anything before printing.

import { PDFDocument, PDFCheckBox, PDFTextField, StandardFonts } from 'pdf-lib';
import type { ReturnInput } from '../tax/model';
import { analyzeAccounts, type AccountsAnalysis } from '../tax/accounts';
import type { CarryColumn, ReturnResult, ScheduleB1116 } from '../tax/compute';
import {
  F1040_2025, F2555_TRAVEL, F6251_2025, SCHC_2025, F4562_2025, SCH2_SE_EXEMPT, F1116_2025, F2555_2025, F2555_TRIPS_2025, F8833, F8833_EXPLANATION, SCH1116B, SCH1116B_GRID, F8938, F8938_PART3, SCH1_2025, SCH1A_2025, SCH2_2025, SCH3_2025, SCH8812_2025, SCHB_2025, type FormMap,
} from './maps2025';
import { MAPS_2023, MAPS_2024, type YearMaps } from './mapsPrior';
import { travelRows } from '../tax/feie';
import { F3520, F3520_7B, F3520A, F8621, f8949Map, schDMap } from './mapsIntl';
import { ownershipExplanation } from '../tax/foreignTrust';
import { YEARS, type TaxYear } from '../tax/years';

const MAPS_2025: YearMaps = {
  F6251: F6251_2025, SCHC: SCHC_2025, F4562: F4562_2025,
  F1040: F1040_2025, SCH1: SCH1_2025, SCH2: SCH2_2025, SCH3: SCH3_2025, SCH8812: SCH8812_2025, F1116: F1116_2025, SCHB: SCHB_2025,
  F2555: F2555_2025, F2555_TRIPS: F2555_TRIPS_2025, SCH1116B, SCH1116B_GRID, F8833, F8833_EXPLANATION, F8938, F8938_PART3,
};
/** Field maps for each tax year's official PDFs. */
export const YEAR_MAPS: Record<TaxYear, YearMaps> = { 2025: MAPS_2025, 2024: MAPS_2024, 2023: MAPS_2023 };

export interface FilledForm {
  /** Short id, e.g. "1040", "1116-general". */
  id: string;
  title: string;
  bytes: Uint8Array;
  /** Mailed separately from the 1040 (Form 3520 and its substitute 3520-A go to Ogden, UT). */
  packet?: '3520';
}

type Loader = (path: string) => Promise<ArrayBuffer>;
const defaultLoader: Loader = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.arrayBuffer();
};

/** Whole dollars with thousands separators; blank for undefined. */
export function money(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '';
  return Math.round(n).toLocaleString('en-US');
}

const digits = (s: string | undefined) => (s ?? '').replace(/\D/g, '');
/** ISO date to MM/DD/YYYY, as IRS forms print dates. */
const usDate = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');

class Filler {
  private doc: PDFDocument;
  private map: Pick<FormMap, 'lines' | 'text' | 'checks'>;

  private constructor(doc: PDFDocument, map: Pick<FormMap, 'lines' | 'text' | 'checks'>) {
    this.doc = doc;
    this.map = map;
  }

  static async open(bytes: ArrayBuffer, map: Pick<FormMap, 'lines' | 'text' | 'checks'>) {
    const doc = await PDFDocument.load(bytes);
    doc.getForm(); // drops the XFA layer so every viewer shows the AcroForm values
    return new Filler(doc, map);
  }

  setText(name: string, value: string, fontSize?: number) {
    if (!value) return;
    const field = this.doc.getForm().getField(name);
    if (!(field instanceof PDFTextField)) throw new Error(`${name} is not a text field`);
    const max = field.getMaxLength();
    field.setText(max !== undefined ? value.slice(0, max) : value);
    if (fontSize) field.setFontSize(fontSize);
  }

  line(key: string, value: number | undefined, opts: { zero?: boolean } = {}) {
    const name = this.map.lines[key];
    if (!name) throw new Error(`No field mapped for line ${key}`);
    if (value === undefined || (value === 0 && !opts.zero)) return;
    this.setText(name, money(value));
  }

  /** Writes every computed line that has a mapped field. */
  lines(values: Record<string, number>, zeroLines: string[] = []) {
    for (const [key, value] of Object.entries(values)) {
      if (this.map.lines[key]) this.line(key, value, { zero: zeroLines.includes(key) });
    }
  }

  /** Writes text at a position on a page (for entries the form has no field for). */
  async draw(pageIndex: number, x: number, y: number, text: string, size = 8) {
    const page = this.doc.getPage(pageIndex);
    page.drawText(text, { x, y, size, font: await this.doc.embedFont(StandardFonts.Helvetica) });
  }

  /** Prints a note in the top margin of page 1 (e.g. "AMT" on an AMT Form 1116, as the instructions ask). */
  async stamp(note: string) {
    const page = this.doc.getPage(0);
    const font = await this.doc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(note, { x: 36, y: page.getHeight() - 22, size: 10, font });
  }

  text(key: string, value: string | undefined) {
    const name = this.map.text[key];
    if (!name) throw new Error(`No text field mapped for ${key}`);
    if (value) this.setText(name, value);
  }

  check(key: string) {
    const entry = this.map.checks[key];
    if (!entry) throw new Error(`No checkbox mapped for ${key}`);
    const field = this.doc.getForm().getField(entry[0]);
    if (!(field instanceof PDFCheckBox)) throw new Error(`${entry[0]} is not a checkbox`);
    field.check();
  }

  /** Checks a box by field name (for boxes outside the form map). */
  setCheck(name: string, _onValue?: string) {
    const field = this.doc.getForm().getField(name);
    if (!(field instanceof PDFCheckBox)) throw new Error(`${name} is not a checkbox`);
    field.check();
  }

  async save(): Promise<Uint8Array> {
    const font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.doc.getForm().updateFieldAppearances(font);
    return this.doc.save();
  }
}

function names(input: ReturnInput) {
  const t = input.taxpayer;
  const sp = input.filingStatus === 'mfj' ? input.spouse : undefined;
  const full = sp
    ? t.lastName === sp.lastName ? `${t.firstName} & ${sp.firstName} ${t.lastName}` : `${t.firstName} ${t.lastName} & ${sp.firstName} ${sp.lastName}`
    : `${t.firstName} ${t.lastName}`;
  return { full, ssn: digits(t.ssn) };
}

/** Builds every form the return needs for its tax year, in IRS attachment sequence order. */
export async function fillReturn(input: ReturnInput, r: ReturnResult, load: Loader = defaultLoader): Promise<FilledForm[]> {
  const M = YEAR_MAPS[input.year];
  const base = `/forms/${input.year}/`;
  const { full, ssn } = names(input);
  const out: FilledForm[] = [];
  const header = (f: Filler) => { f.text('name', full); f.text('ssn', ssn); };

  // ---- Form 1040 ----
  {
    const f = await Filler.open(await load(base + M.F1040.file), M.F1040);
    const t = input.taxpayer;
    f.text('firstName', t.firstName); f.text('lastName', t.lastName); f.text('ssn', digits(t.ssn));
    if (input.spouse && (input.filingStatus === 'mfj' || input.filingStatus === 'mfs')) {
      if (input.filingStatus === 'mfj') {
        f.text('spouseFirstName', input.spouse.firstName); f.text('spouseLastName', input.spouse.lastName);
      }
      // No number: "NRA" only for a separate return with a nonresident spouse (i1040 Filing Status, MFS); on a joint
      // return the box stays blank while the ITIN is applied for with Form W-7 (W-7 instructions, Rev. 12-2024).
      f.text('spouseSsn', digits(input.spouse.ssn) || (input.filingStatus === 'mfs' && input.spouseIsUsPerson === false ? 'NRA' : ''));
      if (input.filingStatus === 'mfs') f.text('mfsSpouseName', `${input.spouse.firstName} ${input.spouse.lastName}`);
    }
    // Foreign address: city line holds city, province and postal code go in the foreign fields.
    f.text('street', input.address.street);
    f.text('city', input.address.city);
    f.text('foreignCountry', input.address.country);
    f.text('foreignProvince', input.address.province);
    f.text('foreignPostalCode', input.address.postalCode);
    f.check(input.filingStatus);
    f.check(input.digitalAssets ? 'digitalAssetsYes' : 'digitalAssetsNo');
    if (r.f1040['1h'] && M.F1040.text.line1hType) f.text('line1hType', 'Foreign wages - Canada');
    if (r.f1040['7a'] && !r.scheduleD) f.check('capGainNoSchD'); // capital gain distributions only: Schedule D not required
    if (r.pfic.some((p) => p.deferredTax > 0)) { f.check('line16Box3'); f.text('line16Other', '1291TAX'); }
    const born = (dob?: string) => !!dob && dob < YEARS[input.year].seniorBornBefore;
    if (born(t.dateOfBirth)) f.check('youBornBefore');
    if (t.blind) f.check('youBlind');
    if (input.filingStatus === 'mfj' && born(input.spouse?.dateOfBirth)) f.check('spouseBornBefore');
    if (input.filingStatus === 'mfj' && input.spouse?.blind) f.check('spouseBlind');
    f.text('occupation', t.occupation);
    if (input.filingStatus === 'mfj') f.text('spouseOccupation', input.spouse?.occupation);
    f.lines(r.f1040, ['15', '16', '22', '24']);
    out.push({ id: '1040', title: 'Form 1040', bytes: await f.save() });
  }

  // ---- Schedule 1 ----
  if (r.schedule1['10'] || r.schedule1['8d'] || r.schedule1['26']) {
    const f = await Filler.open(await load(base + M.SCH1.file), M.SCH1);
    header(f);
    const s1 = { ...r.schedule1, '8d': Math.abs(r.schedule1['8d'] ?? 0) }; // printed inside ( )
    f.lines(s1);
    if (r.schedule1['8z']) f.text('line8zType', 'Canadian social security (CPP/QPP/OAS) and other income');
    out.push({ id: 'sch1', title: 'Schedule 1', bytes: await f.save() });
  }

  // ---- Schedule 1-A ----
  if (r.schedule1a['38'] && input.year === 2025) {
    const f = await Filler.open(await load(base + SCH1A_2025.file), SCH1A_2025);
    header(f);
    f.line('1', r.f1040['11b']);
    f.line('2b', r.f2555.reduce((a, x) => a + x.exclusion, 0));
    f.line('2e', r.f2555.reduce((a, x) => a + x.exclusion, 0));
    f.line('3', r.schedule1a['3']);
    f.line('31', r.schedule1a['3']);
    f.line('32', input.filingStatus === 'mfj' ? 150000 : 75000);
    f.lines(r.schedule1a);
    out.push({ id: 'sch1a', title: 'Schedule 1-A', bytes: await f.save() });
  }

  // ---- Schedule 2 ----
  if (r.schedule2['21'] || r.schedule2['3'] || r.scheduleC.length) {
    const f = await Filler.open(await load(base + M.SCH2.file), M.SCH2);
    header(f);
    f.lines(r.schedule2);
    if (r.scheduleC.length) {
      // Self-employment tax exempt under the US-Canada totalization agreement (Instructions for Schedule SE).
      const se = SCH2_SE_EXEMPT[input.year];
      if (se.check) f.setCheck(se.check[0], se.check[1]);
      if (se.text) f.setText(se.text, 'Exempt, see attached statement', 5);
      if (se.draw) await f.draw(0, se.draw.x, se.draw.y, 'Exempt, see attached statement');
    }
    out.push({ id: 'sch2', title: 'Schedule 2', bytes: await f.save() });
  }

  // ---- Schedule 3 ----
  if (r.schedule3['8']) {
    const f = await Filler.open(await load(base + M.SCH3.file), M.SCH3);
    header(f);
    f.lines(r.schedule3);
    out.push({ id: 'sch3', title: 'Schedule 3', bytes: await f.save() });
  }

  // ---- Schedule B (always: Part III foreign accounts applies to everyone living in Canada) ----
  {
    const f = await Filler.open(await load(base + M.SCHB.file), M.SCHB.map);
    header(f);
    const rows = (list: { payer: string; amount: number }[], fields: string[][], label: string) => {
      if (list.length > fields.length) throw new Error(`Too many ${label} payers for one Schedule B (${list.length})`);
      list.forEach((row, i) => { f.setText(fields[i][0], row.payer); f.setText(fields[i][1], money(row.amount)); });
    };
    rows(r.scheduleB.interest, M.SCHB.interestRows, 'interest');
    rows(r.scheduleB.dividends, M.SCHB.dividendRows, 'dividend');
    f.line('2', r.f1040['2b']); f.line('4', r.f1040['2b']); f.line('6', r.f1040['3b']);
    f.check((input.accounts?.length ?? 0) > 0 || input.foreignAccountsOver10k !== false ? 'foreignAccountYes' : 'foreignAccountNo');
    f.check(input.foreignAccountsOver10k === false ? 'fbarRequiredNo' : 'fbarRequiredYes');
    f.text('country', 'Canada');
    f.check('foreignTrustNo');
    out.push({ id: 'schB', title: 'Schedule B', bytes: await f.save() });
  }

  // ---- Schedule C (sequence 09), one per business ----
  for (const c of r.scheduleC) {
    const b = c.business;
    const f = await Filler.open(await load(base + M.SCHC.file), M.SCHC);
    const person = b.owner === 'spouse' ? input.spouse! : input.taxpayer;
    f.text('name', `${person.firstName} ${person.lastName}`);
    f.text('ssn', digits(person.ssn));
    f.text('activity', b.activity);
    f.text('code', digits(b.code));
    f.text('businessName', b.name);
    f.check(b.accounting === 'accrual' ? 'accrual' : 'cash');
    f.check(b.materiallyParticipated ? 'materialYes' : 'materialNo');
    f.check('form1099No'); // payments to Canadian payees for work done outside the US need no Form 1099
    f.lines(c.lines, ['7', '28', '29', '31']);
    if (c.lines['31'] < 0) f.check('atRisk');
    if (c.homeOfficeSqFt && c.lines['30'] > 0) { f.text('homeSqFt', String(c.homeOfficeSqFt.home)); f.text('officeSqFt', String(c.homeOfficeSqFt.office)); }
    if (c.lines['27b']) { f.text('otherDesc1', b.otherDescription || 'Other business expenses'); f.text('otherAmt1', money(c.lines['27b'])); f.line('48', c.lines['27b']); }
    // Part IV only when Form 4562 isn't filed (otherwise the vehicle goes on Form 4562, Part V).
    if (b.vehicle && c.miles && !c.needs4562) {
      const d = b.vehicle.placedInService;
      if (d) { f.text('vehicleMonth', d.slice(5, 7)); f.text('vehicleDay', d.slice(8, 10)); f.text('vehicleYear', d.slice(0, 4)); }
      f.text('milesBusiness', c.miles.business.toLocaleString('en-US'));
      f.text('milesCommuting', c.miles.commuting.toLocaleString('en-US'));
      f.text('milesOther', c.miles.other.toLocaleString('en-US'));
      f.check(b.vehicle.personalUseAvailable ? 'personalUseYes' : 'personalUseNo');
      f.check(b.vehicle.anotherVehicle ? 'anotherVehicleYes' : 'anotherVehicleNo');
      f.check(b.vehicle.evidence ? 'evidenceYes' : 'evidenceNo');
      if (b.vehicle.evidence) f.check(b.vehicle.writtenEvidence ? 'writtenYes' : 'writtenNo');
    }
    out.push({ id: `schC-${b.id}`, title: `Schedule C (${b.name || b.activity || 'business'})`, bytes: await f.save() });
  }

  // ---- Schedule D (sequence 12) and Form 8949 (12A) ----
  if (r.scheduleD) {
    const D = r.scheduleD;
    const sd = schDMap(input.year);
    const f = await Filler.open(await load(base + sd.file), sd);
    header(f);
    f.check('qofNo');
    const neg = (k: string) => (D.lines[k] ? Math.abs(D.lines[k]) : undefined); // lines 6 and 14 are printed in ( )
    const vals: Record<string, number> = { ...D.lines, '6': neg('6') ?? 0, '14': neg('14') ?? 0, '21': D.lines['21'] !== undefined ? Math.abs(D.lines['21']) : 0 };
    f.lines(vals, ['7', '15', '16']);
    // Losses in column (h) and on lines 7, 15, 16 are shown in parentheses.
    for (const k of ['3h', '7', '10h', '15', '16']) if (D.lines[k] < 0) f.setText(sd.lines[k], `(${money(-D.lines[k])})`);
    if (D.lines['16'] > 0) {
      f.check(D.lines['15'] > 0 ? 'l17Yes' : 'l17No');
      if (D.lines['15'] > 0) f.check('l20Yes'); // no 28% rate or section 1250 gain in Lou's scope
    } else if (D.lines['16'] < 0) f.check(r.f1040['3a'] > 0 ? 'l22Yes' : 'l22No');
    out.push({ id: 'schD', title: 'Schedule D', bytes: await f.save() });

    // Form 8949: box C (short-term) and box F (long-term); extra copies when rows overflow.
    const m = f8949Map(input.year);
    const st = D.rows.filter((x) => !x.longTerm);
    const lt = D.rows.filter((x) => x.longTerm);
    const per = m.parts[0].rows.length;
    const copies = Math.max(Math.ceil(st.length / per), Math.ceil(lt.length / per), 1);
    for (let c = 0; c < copies; c++) {
      const doc = await PDFDocument.load(await load(base + m.file));
      const form = doc.getForm();
      const set = (name: string, v: string) => setFitted(form.getField(name) as PDFTextField, v);
      for (const [i, rows] of [st.slice(c * per, (c + 1) * per), lt.slice(c * per, (c + 1) * per)].entries()) {
        const part = m.parts[i];
        set(part.name, full); set(part.ssn, ssn);
        if (!rows.length) continue;
        (form.getField(part.box) as PDFCheckBox).check();
        rows.forEach((x, k) => {
          const cells = [x.description, x.acquired === 'VARIOUS' ? 'VARIOUS' : usDate(x.acquired), usDate(x.sold), money(x.proceeds), money(x.basis), '', '', x.gain < 0 ? `(${money(-x.gain)})` : money(x.gain)];
          cells.forEach((v, col) => set(part.rows[k][col], v));
        });
        const tot = (k: 'proceeds' | 'basis' | 'gain') => rows.reduce((a, x) => a + x[k], 0);
        set(part.totals.d, money(tot('proceeds'))); set(part.totals.e, money(tot('basis')));
        const g = tot('gain'); set(part.totals.h, g < 0 ? `(${money(-g)})` : money(g));
      }
      form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
      out.push({ id: c ? `8949-${c + 1}` : '8949', title: `Form 8949${copies > 1 ? ` (${c + 1} of ${copies})` : ''}`, bytes: await doc.save() });
    }
    const withRates = D.rows.filter((x) => x.acquiredRate && x.soldRate);
    if (withRates.length) out.push({ id: '8949stmt', title: 'Form 8949 exchange rate statement', bytes: await statementPdf(`Form 8949: conversion of Canadian dollar amounts (${input.year})`,
      [full, `SSN ${ssn}`], ['Cost is converted at the exchange rate on the purchase date and proceeds at the rate on the sale date (Bank of Canada daily rates, CAD per USD; for a weekend or holiday, the last business day before).', '',
        ...withRates.map((x) => `${x.description}: bought ${usDate(x.acquired)} at ${x.acquiredRate}, sold ${usDate(x.sold)} at ${x.soldRate}; proceeds $${money(x.proceeds)}, basis $${money(x.basis)}.`)]) });
  }

  // ---- Form 1116 (one per category). Also used for the AMT Forms 1116 behind Form 6251. ----
  const fill1116 = async (form: { category: 'general' | 'passive'; lines: Record<string, number> }, taxCad: number,
    partIV: { passive?: number; general?: number; line33: number } | null, amt: boolean) => {
    const f = await Filler.open(await load(base + M.F1116.file), M.F1116);
    if (amt) await f.stamp(`AMT - ${form.category === 'general' ? 'General' : 'Passive'} category income`);
    header(f);
    f.check(form.category);
    f.text('residentOf', 'Canada');
    f.text('countryA', 'Canada');
    f.text('line1aDesc', form.category === 'general' ? 'Wages and pensions - Canada' : 'Interest and dividends - Canada');
    f.check('accrued');
    f.text('dateA', `12/31/${input.year}`);
    const L = form.lines;
    f.line('1a', L['1a']); f.line('total1a', L['1a']);
    for (const k of ['3a', '3c', '3d', '3e', '3g']) f.line(k, L[k]);
    if (L['3f'] !== undefined) f.setText(M.F1116.lines['3f'], L['3f'].toFixed(4));
    f.line('6A', L['6']); f.line('6', L['6']); f.line('7', L['7'], { zero: true });
    f.line('p', Math.round(taxCad)); f.line('t', L['8']); f.line('u', L['8']); f.line('8', L['8']);
    for (const k of ['9', '10', '11', '12', '13', '14', '15', '17', '18', '20', '21', '23', '24']) f.line(k, L[k], { zero: ['14', '24'].includes(k) });
    f.setText(M.F1116.lines['19'], L['19'].toFixed(4));
    if (partIV) {
      f.line('27', partIV.passive); f.line('28', partIV.general);
      f.line('32', (partIV.passive ?? 0) + (partIV.general ?? 0), { zero: true });
      f.line('33', partIV.line33, { zero: true }); f.line('35', partIV.line33, { zero: true });
    }
    return f.save();
  };
  /** Part IV goes on the general-category form, or the only one. */
  const partIVOn = (forms: { category: string }[]) => (forms.some((x) => x.category === 'general') ? 'general' : forms[0]?.category);
  const credits = (forms: { category: string; lines: Record<string, number> }[]) => ({
    passive: forms.find((x) => x.category === 'passive')?.lines['24'], general: forms.find((x) => x.category === 'general')?.lines['24'],
  });
  for (const form of r.f1116) {
    const partIV = form.category === partIVOn(r.f1116) ? { ...credits(r.f1116), line33: r.schedule3['1'] } : null;
    out.push({ id: `1116-${form.category}`, title: `Form 1116 (${form.category} category)`, bytes: await fill1116(form, form.taxCad, partIV, false) });
  }

  // ---- Schedule B (Form 1116): attached right after the Form 1116 for the same category ----
  const fillSchB = async (form: { category: 'general' | 'passive'; scheduleB?: ScheduleB1116 }, amt: boolean) => {
    if (!form.scheduleB) return null;
    const f = await Filler.open(await load(base + SCH1116B.file), SCH1116B);
    if (amt) await f.stamp(`AMT - ${form.category === 'general' ? 'General' : 'Passive'} category income`);
    f.text('name', full);
    f.text('tin', ssn);
    f.text('year', String(input.year).slice(2));
    f.check(form.category);
    const cols = form.scheduleB.cols;
    const neg = (n: number) => (n < 0 ? `(${money(-n)})` : money(n));
    for (const line of ['1', '3', '4', '5', '6', '7', '8'] as const) {
      const key = `l${line}` as keyof CarryColumn;
      const page1 = [10, 9, 8, 7, 6, 5].map((k) => cols[k][key]);
      const sub = page1.reduce((a, b) => a + b, 0);
      const page2 = [sub, ...[4, 3, 2, 1, 0].map((k) => cols[k][key])];
      const total = page2.reduce((a, b) => a + b, 0);
      [...page1, sub].forEach((v, i) => { if (v) f.setText(SCH1116B_GRID.p1[line][i], neg(v)); });
      [...page2, total].forEach((v, i) => { if (v) f.setText(SCH1116B_GRID.p2[line][i], neg(v)); });
    }
    return f.save();
  };
  for (const form of r.f1116) {
    const bytes = await fillSchB(form, false);
    if (!bytes) continue;
    const at = out.findIndex((o) => o.id === `1116-${form.category}`);
    out.splice(at + 1, 0, { id: `1116sb-${form.category}`, title: `Schedule B (Form 1116), ${form.category}`, bytes });
  }

  // ---- Form 6251 (sequence 32) when line 7 is more than line 10, then its AMT Forms 1116 ----
  if (r.f6251.mustFile) {
    const a = r.f6251;
    const f = await Filler.open(await load(base + M.F6251.file), M.F6251);
    header(f);
    const zero = input.year === 2025 ? ['1a', '1b', '4', '5', '6', '7', '9', '10', '11'] : ['1', '4', '5', '6', '7', '9', '10', '11'];
    f.lines(a.lines, zero);
    out.push({ id: '6251', title: 'Form 6251', bytes: await f.save() });
    // Attached only when the AMT credit differs from the regular credit (i6251, Step 6).
    if (a.f1116.length && a.lines['8'] !== r.schedule3['1']) {
      for (const form of a.f1116) {
        const taxCad = r.f1116.find((x) => x.category === form.category)?.taxCad ?? 0;
        const partIV = form.category === partIVOn(a.f1116) ? { ...credits(a.f1116), line33: a.lines['8'] } : null;
        out.push({ id: `1116amt-${form.category}`, title: `AMT Form 1116 (${form.category} category)`, bytes: await fill1116(form, taxCad, partIV, true) });
        const schB = await fillSchB(form, true);
        if (schB) out.push({ id: `1116sbamt-${form.category}`, title: `AMT Schedule B (Form 1116), ${form.category}`, bytes: schB });
      }
    }
  }

  // ---- Form 2555 (one per person with excluded wages) ----
  const travelStatements: { owner: string; rows: ReturnType<typeof travelRows> }[] = [];
  for (const form of r.f2555) {
    const f = await Filler.open(await load(base + M.F2555.file), M.F2555);
    const person = form.owner === 'spouse' ? input.spouse! : input.taxpayer;
    const d = input.feie2555?.[form.owner];
    f.text('name', `${person.firstName} ${person.lastName}`);
    f.text('ssn', digits(person.ssn));
    const addr = input.address;
    f.text('foreignAddress', `${addr.street}, ${addr.city}, ${addr.province} ${addr.postalCode}, Canada`);
    f.text('occupation', person.occupation);
    const employer = r.items.find((i) => i.owner === form.owner && i.earned)?.description.replace(/^Foreign employer compensation - | \(T4\)$/g, '');
    f.text('employerName', employer);
    f.text('employerUsAddress', 'N/A');
    f.text('employerForeignAddress', d?.employerAddress || 'N/A');
    f.check({ foreign: 'employerForeign', us: 'employerUs', foreignAffiliate: 'employerForeignAffiliate', self: 'employerSelf', other: 'employerOther' }[d?.employerType ?? 'foreign']);
    if (d?.filedBefore) f.text('lastYearFiled', d.priorYear); else f.check('neverFiled');
    if (d?.filedBefore) {
      f.check(d.revoked ? 'revokedYes' : 'revokedNo');
      if (d.revoked) f.text('revocation', d.revokedDetail);
    }
    f.text('citizenship', 'United States');
    f.check('secondHouseholdNo');
    f.text('secondHousehold', 'N/A');
    f.text('taxHome', `${addr.city}, ${addr.province}, Canada, since ${usDate(d?.residenceStart)}`);
    // Part II (bona fide residence) or Part III (physical presence), never both.
    if (form.test === 'bfr') {
      f.text('residenceBegan', usDate(d?.residenceStart));
      f.text('residenceEnded', 'Continues');
      if (d?.quarters) f.check({ purchased: 'quartersPurchased', rented: 'quartersRented', room: 'quartersRoom', employer: 'quartersEmployer' }[d.quarters]);
      if (d?.familyWithYou !== null && d?.familyWithYou !== undefined) f.check(d.familyWithYou ? 'familyYes' : 'familyNo');
      f.text('familyWho', d?.familyWithYou ? d.familyWho : 'N/A');
      f.check('nonResidentStatementNo');
      f.check('payForeignTaxYes');
      (d?.trips ?? []).filter((t) => t.arrived.startsWith(String(input.year)) || t.left.startsWith(String(input.year))).slice(0, 8).forEach((t, i) => {
        const row = M.F2555_TRIPS[i];
        f.setText(row[0], usDate(t.arrived)); f.setText(row[1], usDate(t.left)); f.setText(row[2], String(t.businessDays));
        if (t.businessDays === 0) f.setText(row[3], '0');
      });
      f.text('contractTerms', d?.status === 'citizen' || d?.status === 'pr' ? 'Permanent job, no end date' : 'See attached explanation');
      f.text('visa', { citizen: 'Canadian citizen (no visa)', pr: 'Canadian permanent resident', permit: 'Canadian work permit', other: d?.statusOther || 'Other' }[d?.status ?? 'other']);
      if (d?.visaLimited !== null && d?.visaLimited !== undefined) f.check(d.visaLimited ? 'visaLimitYes' : 'visaLimitNo');
      f.check(d?.usHome ? 'usHomeYes' : 'usHomeNo');
      f.text('usHomeAddress', d?.usHome ? d.usHomeAddress : 'N/A');
    } else if (form.ppt?.start && form.ppt.end) {
      f.text('pptFrom', usDate(form.ppt.start));
      f.text('pptTo', usDate(form.ppt.end));
      f.text('pptCountry', 'Canada');
      const rows = travelRows(form.ppt.start, form.ppt.end, d?.residenceStart ?? form.ppt.start, d?.trips ?? []);
      const T = F2555_TRAVEL;
      if (rows.length === 1) f.setText(T[0][0], 'Physically present in a foreign country or countries for the entire 12-month period.');
      else if (rows.length <= T.length) rows.forEach((row, i) => {
        f.setText(T[i][0], row.country); f.setText(T[i][1], usDate(row.arrived)); f.setText(T[i][2], usDate(row.left));
        f.setText(T[i][3], String(row.fullDays)); f.setText(T[i][4], row.country === 'United States' ? String(row.businessDays) : '');
      });
      else {
        f.setText(T[0][0], 'See attached statement');
        travelStatements.push({ owner: form.owner, rows });
      }
    }
    const L = form.lines;
    // Part VI housing (line 28 onward) when claimed.
    f.check(L['28'] ? 'housingYes' : 'housingNo');
    if (L['28']) {
      for (const k of ['28', '29b', '30', '32', '33', '34', '36']) f.line(k, L[k], { zero: ['33', '36'].includes(k) });
      f.setText(M.F2555.lines['31'], String(L['31']));
      const loc = input.feie2555?.[form.owner]?.housing?.location;
      if (loc) f.text('housingLocation', `${loc}, Canada`);
      if (L['35'] !== undefined) { const [w, dec] = L['35'].toFixed(3).split('.'); f.text('line35Whole', w); f.text('line35Decimal', dec); }
    }
    for (const k of ['19', '20a', '24', '26', '27', '37', '40', '41', '42', '43', '45']) f.line(k, L[k], { zero: ['19', '20a'].includes(k) ? false : true });
    f.line('44', L['44']);
    for (const k of ['46', '47', '48', '50']) f.line(k, L[k]);
    f.setText(M.F2555.lines['38'], String(L['38']));
    const [w39, d39] = L['39'].toFixed(3).split('.');
    f.text('line39Whole', w39); f.text('line39Decimal', d39);
    out.push({ id: `2555-${form.owner}`, title: `Form 2555${form.owner === 'spouse' ? ' (spouse)' : ''}`, bytes: await f.save() });
  }

  for (const t of travelStatements) {
    const at = out.findIndex((o) => o.id === `2555-${t.owner}`);
    out.splice(at + 1, 0, { id: `2555stmt-${t.owner}`, title: 'Form 2555 line 18 statement', bytes: await statementPdf(`Form 2555, line 18: travel during the 12-month period (${input.year})`,
      [full, `SSN ${ssn}`], ['Country | Date arrived | Date left | Full days present | Days in US on business', '',
        ...t.rows.map((r) => `${r.country} | ${usDate(r.arrived)} | ${usDate(r.left)} | ${r.fullDays} | ${r.country === 'United States' ? r.businessDays : ''}`)]) });
  }

  // ---- Schedule 8812 ----
  if (Object.keys(r.schedule8812).length) {
    const f = await Filler.open(await load(base + M.SCH8812.file), M.SCH8812);
    header(f);
    f.lines(r.schedule8812, ['14', '27']);
    out.push({ id: 'sch8812', title: 'Schedule 8812', bytes: await f.save() });
  }

  // ---- Form 8938 (sequence 938), when the accounts are over the living-abroad thresholds ----
  if (input.accounts?.length) {
    const a = analyzeAccounts(input.year, input.filingStatus, input.accounts, { spouseIsUsPerson: input.spouseIsUsPerson });
    if (a.f8938.required) out.push({ id: '8938', title: 'Form 8938', bytes: await fill8938(input, r, a, load, base, full, ssn) });
  }

  // ---- Form 4562 (sequence 179) when property was placed in service this year ----
  for (const c of r.scheduleC) {
    if (!c.needs4562) continue;
    const b = c.business;
    const f = await Filler.open(await load(base + M.F4562.file), M.F4562);
    const person = b.owner === 'spouse' ? input.spouse! : input.taxpayer;
    f.text('name', `${person.firstName} ${person.lastName}`);
    f.text('activity', `Schedule C: ${b.name || b.activity}`);
    f.text('ssn', digits(person.ssn));
    const dep = c.depreciation.filter((d) => !d.expensed);
    const current = dep.filter((d) => d.current);
    const one = current.length === 1 ? current[0] : null;
    const same = <T,>(xs: T[]) => (xs.every((x) => x === xs[0]) ? xs[0] : null);
    const years = same(current.map((d) => d.recoveryYears));
    const conv = same(current.map((d) => d.convention));
    const [colB, colC, colD, colE, colG] = M.F4562.row20a;
    f.setText(colB, one ? `${one.asset.placedInService.slice(5, 7)}/${one.asset.placedInService.slice(0, 4)}` : 'Various');
    f.setText(colC, money(current.reduce((a, d) => a + d.basisUsd, 0)));
    f.setText(colD, years ? `${years} yrs.` : 'See stmt');
    f.setText(colE, conv ?? 'See stmt');
    f.setText(colG, money(current.reduce((a, d) => a + d.deduction, 0)));
    f.line('17', dep.filter((d) => !d.current).reduce((a, d) => a + d.deduction, 0));
    f.line('22', c.lines['13'], { zero: true });
    if (b.vehicle && c.miles) {
      f.check(b.vehicle.evidence ? 'evidenceYes' : 'evidenceNo');
      if (b.vehicle.evidence) f.check(b.vehicle.writtenEvidence ? 'writtenYes' : 'writtenNo');
      const total = c.miles.business + c.miles.commuting + c.miles.other;
      const pct = total > 0 ? Math.round((c.miles.business / total) * 10000) / 100 : 0;
      const row = pct > 50 ? M.F4562.row26 : M.F4562.row27;
      f.setText(row[0], 'Automobile');
      f.setText(row[1], usDate(b.vehicle.placedInService));
      f.setText(row[2], `${pct.toFixed(2)}`);
      f.line('30', c.miles.business, { zero: true }); f.line('31', c.miles.commuting, { zero: true }); f.line('32', c.miles.other, { zero: true });
      f.line('33', c.miles.business + c.miles.commuting + c.miles.other, { zero: true });
      f.check(b.vehicle.personalUseAvailable ? 'personalUseYes' : 'personalUseNo');
      f.check('ownerUseYes'); // a sole proprietor owns the business
      f.check(b.vehicle.anotherVehicle ? 'anotherVehicleYes' : 'anotherVehicleNo');
    }
    out.push({ id: `4562-${b.id}`, title: `Form 4562 (${b.name || b.activity || 'business'})`, bytes: await f.save() });
    // Statement listing each asset (the form has one line 20a row).
    const rows = dep.map((d) => `${d.asset.description || 'Asset'}: placed in service ${usDate(d.asset.placedInService)}; cost CA$${money(d.asset.costCad)} x ${d.asset.businessUsePct}% business use / ${d.rate} CAD per USD${d.rateDate ? ` (Bank of Canada, ${usDate(d.rateDate)})` : ''} = basis $${money(d.basisUsd)}; ADS ${d.recoveryYears} years, straight line, ${d.convention === 'HY' ? 'half-year' : 'mid-quarter'} convention; ${input.year} depreciation $${money(d.deduction)}${d.current ? ' (line 20a)' : ' (line 17)'}.`);
    out.push({ id: `4562stmt-${b.id}`, title: 'Form 4562 statement', bytes: await statementPdf(`Form 4562, line 20a and line 17: depreciation detail (${input.year})`,
      [`${full}   SSN ${ssn}`, `Business: ${b.name || b.activity}`],
      ['Property used predominantly outside the United States is depreciated under the alternative depreciation system (IRC 168(g)(1)(A)); section 179 does not apply (IRC 179(d)(1), 50(b)(1)).', '', ...rows]) });
  }
  // ---- Form 8621, one per fund that must file, with the line 16 allocation statement ----
  for (const p of r.pfic) {
    if (!p.mustFile) continue;
    const f = await Filler.open(await load(base + F8621.file), F8621);
    const fund = p.fund;
    const person = fund.owner === 'spouse' ? input.spouse! : input.taxpayer;
    const a = input.address;
    f.text('name', `${person.firstName} ${person.lastName}`); f.text('ssn', digits(person.ssn));
    f.text('street', a.street); f.text('city', a.city); f.text('province', a.province); f.text('country', 'Canada'); f.text('postal', a.postalCode);
    f.text('year', String(input.year).slice(2)); f.check('individual');
    f.text('pficName', fund.name); f.text('pficAddress', fund.address || 'Canada');
    f.text('referenceId', fund.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 50));
    f.text('pficYear', String(input.year).slice(2));
    f.text('l1', 'Units (common)');
    if (fund.owner === 'joint') f.check('joint');
    if (fund.acquired >= `${input.year}-01-01`) f.text('l2', usDate(fund.acquired));
    f.text('l3', String(fund.sharesYearEnd));
    const v = p.lines['4'] ?? 0;
    if (v <= 50000) f.check('v4a'); else if (v <= 100000) f.check('v4b'); else if (v <= 150000) f.check('v4c'); else if (v <= 200000) f.check('v4d'); else f.text('l4e', money(v));
    if (fund.regime === '1291' || p.lines['5a']) { f.check('t5a'); if (p.lines['5a']) f.text('l5a', money(p.lines['5a'])); }
    if (fund.regime === 'qef') { f.check('t5b'); f.text('l5b', money(p.lines['5b'])); }
    if (fund.regime === 'mtm' && !p.lines['5a']) { f.check('t5c'); f.text('l5c', money(p.lines['5c'])); }
    if (fund.regime === 'mtm' && fund.mtm?.firstYear === input.year) f.check('electionC');
    const L = p.lines;
    const keyMap: Record<string, string> = { '15e1': '15e(1)', '15e2': '15e(2)' };
    for (const [k, val] of Object.entries(L)) {
      const key = keyMap[k] ?? k;
      if (F8621.lines[key] && val !== undefined) f.line(key, val, { zero: ['16b', '16c', '16e', '16f'].includes(key) && p.details.length > 0 });
    }
    if (L['15a'] !== undefined) f.text('currency', 'CAD');
    out.push({ id: `8621-${fund.id}`, title: `Form 8621 (${fund.name})`, bytes: await f.save() });
    if (p.details.length) out.push({ id: `8621stmt-${fund.id}`, title: `Form 8621 line 16 statement (${fund.name})`, bytes: await statementPdf(`Form 8621, line 16a: allocation of excess distributions and gains (${input.year})`,
      [`${person.firstName} ${person.lastName}   SSN ${digits(person.ssn)}`, `PFIC: ${fund.name}`],
      p.details.flatMap((d) => [
        `${d.label}: $${money(d.amountUsd)} over the holding period ${usDate(d.acquired)} (day after) to ${usDate(d.end)}, allocated by day.`,
        `  Current year and pre-PFIC years (line 16b, ordinary income): $${money(d.result.ordinary)}.`,
        ...d.result.rows.map((x) => `  ${x.year}: $${money(x.allocated)} x ${(x.rate! * 100).toFixed(1)}% = $${money(x.increase)}; foreign tax applied $${money(x.foreignTax)}; interest to April 15, ${input.year + 1} (IRC 6621 rates, compounded daily) $${money(x.interest)}.`),
        '']).concat(['Interest uses the quarterly underpayment rates for individuals (Rev. Rul. 2025-22 table and later quarters), from April 15 after each year to April 15 after the current year.'])) });
  }

  // De minimis safe harbor election statement (Reg. 1.263(a)-1(f)(5)).
  const deMinimis = r.scheduleC.filter((c) => c.depreciation.some((d) => d.expensed));
  if (deMinimis.length) {
    out.push({ id: 'deminimis', title: 'De minimis safe harbor election', bytes: await statementPdf(`Section 1.263(a)-1(f) de minimis safe harbor election (${input.year})`,
      [full, `SSN ${ssn}`, `${input.address.street}, ${input.address.city}, ${input.address.province} ${input.address.postalCode}, Canada`],
      [`The taxpayer is making the de minimis safe harbor election under Treas. Reg. section 1.263(a)-1(f) for the taxable year ${input.year}.`, '',
        ...deMinimis.flatMap((c) => c.depreciation.filter((d) => d.expensed).map((d) => `${c.business.name || c.business.activity}: ${d.asset.description || 'item'}, ${usDate(d.asset.placedInService)}, $${money(d.deduction)} (Schedule C, line 22).`))]) });
  }
  // Certificate of coverage reminder page for the self-employment tax exemption.
  if (r.scheduleC.length) {
    out.push({ id: 'se-statement', title: 'Self-employment tax exemption statement', bytes: await statementPdf(`Schedule 2, line 4: self-employment tax exemption (${input.year})`,
      [full, `SSN ${ssn}`],
      ['The taxpayer is a resident of Canada and is self-employed. Under Article V of the Agreement on Social Security between the United States and Canada, the taxpayer’s self-employment income is subject only to the Canada Pension Plan (or Quebec Pension Plan) and is exempt from US self-employment tax.',
        '', 'ATTACH HERE: a copy of the certificate of coverage (CRA form CPT56, or the Quebec equivalent from Retraite Québec).']) });
  }

  // ---- Form 8833, last: it has no attachment sequence number (voluntary: Reg. 301.6114-1(c)(1)(iv) waives disclosure for social security positions) ----
  for (const owner of ['taxpayer', 'spouse'] as const) {
    const excluded = r.items.filter((i) => i.usLine === 'excluded' && !i.deferred && i.owner === owner);
    if (!excluded.length) continue;
    const person = owner === 'spouse' ? input.spouse! : input.taxpayer;
    const f = await Filler.open(await load(base + F8833.file), F8833);
    f.text('name', `${person.firstName} ${person.lastName}`);
    f.text('tin', digits(person.ssn));
    const a = input.address;
    f.text('addressResidence', `${a.street}, ${a.city}, ${a.province} ${a.postalCode}, Canada`);
    f.text('addressUs', 'N/A');
    f.check('section6114');
    f.check('usCitizen');
    f.text('treatyCountry', 'Canada');
    f.text('articles', 'XVIII(5); XXIX(3)(a)');
    f.text('codeProvisions', 'IRC section 61(a)');
    f.text('payor', 'Service Canada (Government of Canada); no US address');
    f.text('lob', 'Not applicable (individual)');
    f.check('specificNo');
    const list = excluded.map((i) => `${i.description.replace(/ \(T4A\((P|OAS)\)\)/, '')} CA$${money(i.cad)} (US$${money(i.usd)})`).join('; ');
    const text = `The taxpayer is a citizen of the United States and a resident of Canada. During ${input.year} the taxpayer received `
      + `benefits under the social security legislation of Canada: ${list}. Under Article XVIII(5) of the United States-Canada `
      + `Income Tax Convention these benefits are taxable only in the country of residence, and Article XXIX(3)(a) excepts that `
      + `paragraph from the saving clause. The benefits were reported and taxed in Canada and are excluded from US gross income. `
      + `This disclosure is made voluntarily; reporting is waived by Treas. Reg. section 301.6114-1(c)(1)(iv).`;
    wrapText(text, 46, 100).slice(0, F8833_EXPLANATION.length).forEach((line, i) => f.setText(F8833_EXPLANATION[i], line));
    out.push({ id: `8833-${owner}`, title: `Form 8833${owner === 'spouse' ? ' (spouse)' : ''}`, bytes: await f.save() });
  }

  // ---- Form 3520 with a substitute Form 3520-A, one package per TFSA/FHSA (mailed separately, not with the 1040) ----
  for (const t of r.trusts) {
    const acct = t.account;
    const d = acct.registered!;
    const person = acct.owner === 'spouse' ? input.spouse! : input.taxpayer;
    const who = `${person.firstName} ${person.lastName}`;
    const tin = digits(person.ssn);
    const a = input.address;
    const yy = String(input.year).slice(2);
    const created = usDate(d.openedDate);
    const kindName = acct.kind === 'tfsa' ? 'TFSA' : 'FHSA';
    const doc = await PDFDocument.load(await load(base + F3520.file));
    const form = doc.getForm();
    const set = (name: string, v: string | undefined) => setFitted(form.getField(name) as PDFTextField, v);
    const tick = (name: string) => (form.getField(name) as PDFCheckBox).check();
    const T = F3520.text;
    set(T.year, yy); tick(F3520.checks.individual[0]);
    if (t.contributionsUsd > 0) tick(F3520.checks.partI[0]);
    tick(F3520.checks.partII[0]);
    if (t.withdrawalsUsd > 0) tick(F3520.checks.partIII[0]);
    set(T.name, who); set(T.ssn, tin); set(T.street, a.street); set(T.city, a.city); set(T.province, a.province); set(T.postal, a.postalCode); set(T.country, 'Canada');
    tick(F3520.checks.abroad[0]); // automatic 2-month extension for US persons living abroad (attach statement)
    set(T.trustName, t.trustName); set(T.trustStreet, acct.street); set(T.trustCreated, created);
    set(T.trustCity, acct.city); set(T.trustProvince, acct.province); set(T.trustPostal, acct.postalCode); set(T.trustCountry, 'Canada');
    tick(F3520.checks.agentNo[0]);
    if (t.contributionsUsd > 0) {
      set(T.creatorName, 'Same as line 1a'); set(T.creatorAddress, 'Same as lines 1c, 1e, 1f, 1g, and 1h'); set(T.creatorTin, tin);
      set(T.countryCreated, 'CA'); set(T.countryLaw, 'CA'); set(T.dateCreated, created);
      tick(F3520.checks.l7aYes[0]);
      [who, `${a.street}, ${a.city}, ${a.province} ${a.postalCode}`, 'Canada', tin, '676, 679'].forEach((v, i) => set(F3520_7B[i], v));
      tick(F3520.checks.l8No[0]); tick(F3520.checks.l9aYes[0]); tick(F3520.checks.l11aNo[0]); tick(F3520.checks.l13Yes[0]);
      ['Various', 'Cash', money(t.contributionsUsd), money(t.contributionsUsd), '0', '0', 'None', '0', money(t.contributionsUsd)].forEach((v, i) => set(F3520.line13[i], v));
      set(F3520.lines['13totalF'], '0'); set(F3520.lines['13totalI'], money(t.contributionsUsd));
      set(F3520.line15[0], who); set(F3520.line15[1], `${a.street}, ${a.city}, ${a.province} ${a.postalCode}, Canada`); tick(F3520.line15[2]); set(F3520.line15[3], tin);
      set(F3520.line16[0], acct.institution); set(F3520.line16[1], `${acct.street}, ${acct.city}, ${acct.province} ${acct.postalCode}, Canada`);
      // Line 18: Lou attaches the summary; the user attaches the account's declaration of trust and the year-end statement.
      F3520.line18.forEach((x, i) => tick([0, 1, 4].includes(i) ? x.yes : x.no));
    }
    [who, `${a.street}, ${a.city}, ${a.province} ${a.postalCode}`, 'Canada', tin, '676, 679'].forEach((v, i) => set(F3520.line20[i], v));
    set(T.country21a, 'CA'); set(T.country21b, 'CA'); set(T.date21c, created);
    tick(F3520.checks.l22No[0]); // substitute Form 3520-A attached
    set(F3520.lines['23'], money(t.yearEndUsd));
    if (t.withdrawalsUsd > 0) {
      ['Various', 'Cash withdrawals', money(t.withdrawalsUsd), 'None', '0', money(t.withdrawalsUsd)].forEach((v, i) => set(F3520.line24[i], v));
      set(F3520.lines['24total'], money(t.withdrawalsUsd)); set(F3520.lines['27'], money(t.withdrawalsUsd));
    }
    form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
    out.push({ id: `3520-${acct.id}`, title: `Form 3520 (${kindName} ${acct.institution})`, bytes: await doc.save(), packet: '3520' });

    // Substitute Form 3520-A
    const da = await PDFDocument.load(await load(base + F3520A.file));
    const fa = da.getForm();
    const sa = (name: string, v: string | undefined) => setFitted(fa.getField(name) as PDFTextField, v);
    const ta = (name: string) => (fa.getField(name) as PDFCheckBox).check();
    const P1 = F3520A.page1;
    sa(P1.year, yy); ta(P1.substitute);
    const trustBlock = (m: { trustName: string; street: string; created: string; city: string; province: string; postal: string; country: string;
      trustee: string; trusteeStreet: string; trusteeCity: string; trusteeProvince: string; trusteePostal: string; trusteeCountry: string; agentNo: string }) => {
      sa(m.trustName, t.trustName); sa(m.street, acct.street); sa(m.created, created); sa(m.city, acct.city); sa(m.province, acct.province); sa(m.postal, acct.postalCode); sa(m.country, 'Canada');
      ta(m.agentNo);
      sa(m.trustee, acct.institution); sa(m.trusteeStreet, acct.street); sa(m.trusteeCity, acct.city); sa(m.trusteeProvince, acct.province); sa(m.trusteePostal, acct.postalCode); sa(m.trusteeCountry, 'Canada');
    };
    trustBlock({ ...P1, trustName: P1.trustName });
    P1.docs.forEach((x, i) => ta([0, 1].includes(i) ? x.yes : x.no));
    sa(P1.ownerStatements, '1'); sa(P1.beneficiaryStatements, t.withdrawalsUsd > 0 ? '1' : '0');
    sa(P1.title, `U.S. owner: ${who}, SSN ${tin}`);
    const inc = F3520A.income;
    const total = t.interestUsd + t.dividendsUsd + t.shortTermUsd + t.longTermUsd;
    const put = (name: string, n: number, zero = false) => { if (n || zero) sa(name, n < 0 ? `(${money(-n)})` : money(n)); };
    put(inc['1'], t.interestUsd); put(inc['2'], t.dividendsUsd); put(inc['5a'], t.shortTermUsd); put(inc['5b'], t.longTermUsd);
    put(inc['8'], total, true); put(inc['15'], 0, true); put(inc['16'], total, true); put(inc['17a'], t.withdrawalsUsd, true);
    if (t.withdrawalsUsd > 0) [who, tin, 'Various', money(t.withdrawalsUsd)].forEach((v, i) => sa(F3520A.line17b[i], v));
    const line = d.holdsInvestments ? '6' : '1';
    for (const [k, [b, e]] of Object.entries({ [line]: F3520A.balance[line], '11': F3520A.balance['11'], '17': F3520A.balance['17'], '20': F3520A.balance['20'], '21': F3520A.balance['21'] })) {
      void k; put(b, t.startUsd, true); put(e, t.yearEndUsd, true);
    }
    const O = F3520A.owner;
    sa(O.year, yy); trustBlock(O);
    sa(O.taxYear, `01/01/${input.year} - 12/31/${input.year}`);
    sa(O.ownerName, who); sa(O.ownerTin, tin); sa(O.ownerStreet, a.street); sa(O.ownerCity, a.city); sa(O.ownerProvince, a.province); sa(O.ownerPostal, a.postalCode); sa(O.ownerCountry, 'Canada');
    sa(O.docs1, 'Summary of the account terms (attached); declaration of trust from the trustee;'); sa(O.docs2, `year-end account statement for ${input.year}.`);
    sa(O.value, money(t.yearEndUsd));
    if (t.withdrawalsUsd > 0) { ['Various', 'Cash', money(t.withdrawalsUsd), 'None', '0', money(t.withdrawalsUsd)].forEach((v, i) => sa(O.line10[i], v)); sa(O.line10total, money(t.withdrawalsUsd)); }
    const OI = F3520A.ownerIncome;
    sa(OI.year, yy); put(OI['1a'], t.interestUsd); put(OI['2a'], t.dividendsUsd); put(OI['2b'], t.qualifiedUsd);
    put(OI['5'], t.shortTermUsd + t.longTermUsd); put(OI['8'], total, true); put(OI['15'], 0, true);
    sa(OI.title, `U.S. owner: ${who}, SSN ${tin}`);
    if (t.withdrawalsUsd > 0) {
      const B = F3520A.beneficiary;
      sa(B.year, yy); trustBlock(B); ta(B.inspectYes);
      sa(B.taxYear, `01/01/${input.year} - 12/31/${input.year}`);
      sa(B.name, who); sa(B.tin, tin); sa(B.street2, a.street); sa(B.bCity, a.city); sa(B.bProvince, a.province); sa(B.bPostal, a.postalCode); sa(B.bCountry, 'Canada');
      ['Various', 'Cash', money(t.withdrawalsUsd), 'None', '0', money(t.withdrawalsUsd)].forEach((v, i) => sa(B.line7[i], v)); sa(B.line7total, money(t.withdrawalsUsd));
      ta(B.ownerIndividual); sa(B.title, `U.S. owner: ${who}, SSN ${tin}`);
    }
    fa.updateFieldAppearances(await da.embedFont(StandardFonts.Helvetica));
    let aBytes = await da.save();
    if (t.withdrawalsUsd <= 0) {
      // Page 5 (beneficiary statement) only when there were distributions.
      const trim = await PDFDocument.load(aBytes);
      // Remove page 5's fields first, or their widgets would point at a page that no longer exists.
      const page5 = trim.getPage(4).ref;
      const tf = trim.getForm();
      for (const field of tf.getFields()) if (field.acroField.getWidgets().some((w) => w.P() === page5)) tf.removeField(field);
      trim.removePage(4);
      aBytes = await trim.save();
    }
    out.push({ id: `3520a-${acct.id}`, title: `Substitute Form 3520-A (${kindName} ${acct.institution})`, bytes: aBytes, packet: '3520' });
    out.push({ id: `3520stmt-${acct.id}`, title: `Form 3520 statements (${kindName})`, packet: '3520', bytes: await statementPdf(`Form 3520 and substitute Form 3520-A statements: ${t.trustName} (${input.year})`,
      [`${who}   SSN ${tin}`, `${a.street}, ${a.city}, ${a.province} ${a.postalCode}, Canada`],
      [`Form 3520, line 1j: ${who} is a US citizen living outside the United States and Puerto Rico whose main place of business is outside the United States and Puerto Rico, so the automatic 2-month extension applies (due June 15, ${input.year + 1}).`, '',
        `Form 3520-A, Foreign Grantor Trust Owner Statement, line 7 (facts and law): ${ownershipExplanation(t, who)}`, '',
        `Summary of agreements (Form 3520 line 18a; Form 3520-A line 2a): the account is a ${kindName} opened on ${created} with ${acct.institution}, which acts as trustee under its standard declaration of trust registered with the Canada Revenue Agency. There are no other written or oral agreements.`, '',
        `Values are in US dollars: income, contributions and withdrawals at the IRS yearly average rate for ${input.year}; balances at the US Treasury rate for December 31.`, '',
        'ATTACH: the trustee\u2019s declaration of trust for this account and the year-end account statement. Mail this package (Form 3520 with the substitute Form 3520-A) to: Internal Revenue Service Center, P.O. Box 409101, Ogden, UT 84409, USA. Sign Form 3520 and the substitute Form 3520-A.'] ) });
  }

  return out;
}

/** Sets a text field, trimmed to its maximum length (some IRS fields cap characters). */
function setFitted(field: PDFTextField, v: string | undefined) {
  if (!v) return;
  const max = field.getMaxLength();
  field.setText(max !== undefined ? v.slice(0, max) : v);
}

/** Merges filled forms into one printable PDF, in the order given. */
export async function mergeForms(forms: FilledForm[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const form of forms) {
    const src = await PDFDocument.load(form.bytes);
    // Flatten a copy for the combined print file so values survive any viewer.
    src.getForm().flatten();
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/** Greedy word wrap: first line narrower (it shares the row with the line 6 prompt). */
export function wrapText(text: string, first: number, rest: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const width = lines.length === 0 ? first : rest;
    if (line && (line + ' ' + word).length > width) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Form 8938. Page 2 holds one Part V account and one Part VI asset; more accounts go on
 * additional copies of page 2 (attached statements, counted on page 1). A one-page-2 form
 * stays fillable; a longer one is flattened into a single PDF so the copies don't collide.
 */
async function fill8938(
  input: ReturnInput, r: ReturnResult, a: AccountsAnalysis, load: Loader, base: string, full: string, ssn: string,
): Promise<Uint8Array> {
  const rows = a.rows.filter((row) => input.filingStatus === 'mfj' || row.account.owner !== 'spouse');
  const accounts = rows.filter((row) => row.account.kind !== 'pension');
  const pensions = rows.filter((row) => row.account.kind === 'pension');
  const pages = Math.max(1, accounts.length, pensions.length);
  const rate = String(a.rate);
  const docs: Uint8Array[] = [];

  for (let p = 0; p < pages; p++) {
    const f = await Filler.open(await load(base + F8938.file), F8938);
    if (p === 0) {
      f.text('year', String(input.year).slice(2));
      f.text('name', full); f.text('tin', ssn);
      f.check('specifiedIndividual');
      if (pages > 1) { f.check('statements'); f.text('statementsCount', String(pages - 1)); }
      const s = a.f8938;
      f.text('depositCount', String(s.deposit.count)); f.text('depositMax', money(s.deposit.max));
      f.text('custodialCount', String(s.custodial.count)); f.text('custodialMax', money(s.custodial.max));
      f.check(s.anyClosed ? 'closedYes' : 'closedNo');
      if (s.other.count) { f.text('otherCount', String(s.other.count)); f.text('otherMax', money(s.other.max)); }
      f.check(s.otherAcquiredOrSold ? 'otherChangedYes' : 'otherChangedNo');
      // Part III: income from these assets and where it is reported.
      const sumItems = (pred: (i: ReturnResult['items'][number]) => boolean) => Math.round(r.items.filter((i) => i.usLine !== 'excluded' && pred(i)).reduce((t, i) => t + i.usd, 0));
      const part3 = (row: string, amount: number, form: string, schedule: string) => {
        if (!amount) return;
        const [amt, formLine, schedLine] = F8938_PART3[row];
        f.setText(amt, money(amount)); f.setText(formLine, form); f.setText(schedLine, schedule);
      };
      part3('13a', r.f1040['2b'] ?? 0, 'Form 1040, line 2b', 'Schedule B, line 1');
      part3('13b', r.f1040['3b'] ?? 0, 'Form 1040, line 3b', 'Schedule B, line 5');
      part3('13d', sumItems((i) => i.slipType === 'T4RSP' || i.slipType === 'T4RIF'), 'Form 1040, line 5b', '');
      part3('13e', r.f1040['7a'] ?? 0, 'Form 1040, line 7a', '');
      part3('13g', r.f1116.find((x) => x.category === 'passive')?.lines['24'] ?? 0, 'Schedule 3, line 1', 'Form 1116 (passive)');
      if (pensions.length) part3('14d', sumItems((i) => i.usLine === '5b' && (i.slipType === 'T4A' || i.slipType === 'T3')), 'Form 1040, line 5b', '');
      f.text('forms8621', '0');
    }
    const acct = accounts[p];
    if (acct) {
      const x = acct.account;
      f.check(x.kind === 'bank' ? 'deposit' : 'custodial');
      f.text('accountNumber', x.accountNumber || 'Not available');
      if (x.opened) f.check('opened');
      if (x.closed) f.check('closed');
      if (x.owner === 'joint') f.check('joint');
      f.text('accountMax', money(acct.maxUsd));
      f.check('accountRateYes');
      f.text('accountCurrency', 'Canadian dollar (CAD)'); f.text('accountRate', rate);
      f.text('institution', x.institution);
      f.text('institutionStreet', x.street);
      f.text('institutionCity', [x.city, x.province, 'Canada', x.postalCode].filter(Boolean).join(', '));
    }
    const pension = pensions[p];
    if (pension) {
      const x = pension.account;
      f.text('assetDescription', `Employer pension plan (${x.institution})`);
      f.text('assetId', x.accountNumber || 'Not available');
      if (x.owner === 'joint') f.check('assetJoint');
      const v = pension.maxUsd;
      if (v <= 50000) f.check('value0to50k'); else if (v <= 100000) f.check('value50to100k');
      else if (v <= 150000) f.check('value100to150k'); else if (v <= 200000) f.check('value150to200k'); else f.text('assetValueOver200k', money(v));
      f.check('assetRateYes');
      f.text('assetCurrency', 'Canadian dollar (CAD)'); f.text('assetRate', rate);
      f.check('issuer'); f.check('issuerTrust'); f.check('issuerForeign');
      f.text('issuerName', x.institution);
      f.text('issuerStreet', x.street);
      f.text('issuerCity', [x.city, x.province, 'Canada', x.postalCode].filter(Boolean).join(', '));
    }
    docs.push(await f.save());
  }
  if (docs.length === 1) return docs[0];

  const merged = await PDFDocument.create();
  for (let i = 0; i < docs.length; i++) {
    const src = await PDFDocument.load(docs[i]);
    src.getForm().flatten();
    const pick = i === 0 ? [0, 1] : [1];
    (await merged.copyPages(src, pick)).forEach((pg) => merged.addPage(pg));
  }
  return merged.save();
}

/** @deprecated use fillReturn */
export const fillReturn2025 = fillReturn;

/** A plain attached statement (US Letter), wrapped to the page, for entries the forms send to "attach a statement". */
export async function statementPdf(title: string, head: string[], body: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 740;
  const line = (text: string, f = font, size = 10) => {
    if (y < 60) { page = doc.addPage([612, 792]); y = 740; }
    page.drawText(text, { x: 54, y, size, font: f });
    y -= size + 5;
  };
  line(title, bold, 12);
  y -= 4;
  for (const h of head) line(h);
  y -= 8;
  for (const para of body) {
    if (!para) { y -= 6; continue; }
    for (const l of wrapText(para, 100, 100)) line(l);
  }
  return doc.save();
}
