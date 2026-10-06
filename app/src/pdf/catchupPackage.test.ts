import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { readPdf } from '../extract/pdf';
import { fbarSummary, fbarYearsOf, owedByYear, yearReadiness } from '../state/catchup';
import { initialState, switchYear, type AppState, type SlipRecord } from '../state/store';
import { toReturnInput } from '../state/toInput';
import type { ForeignAccount } from '../tax/accounts';
import { SFOP, accountPromptId, emptyCatchup, sfopPlan } from '../tax/catchup';
import { computeReturn } from '../tax/compute';
import { fillReturn } from './fill';
import { buildCoverSheet, buildForm14653Worksheet, buildFbarWorksheets, buildMailPackage, isStamped, stampRed, type CatchupPackageInput } from './catchupPackage';

const PUBLIC = resolve(__dirname, '../../public');
const load = async (p: string) => { const b = readFileSync(PUBLIC + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const OUT = resolve(__dirname, '../../../research/render_check/catchup');

const slip = (id: string, over: Partial<SlipRecord>): SlipRecord => ({
  id, type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: {}, reads: {}, edited: [], confirmed: true, ...over,
});
const acct = (over: Partial<ForeignAccount>): ForeignAccount => ({
  id: 'a1', owner: 'taxpayer', kind: 'bank', institution: 'RBC Royal Bank', street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J5',
  accountNumber: '12345', maxValueCad: 20000, yearEndValueCad: 15000, opened: false, closed: false, ...over,
});

/** A household with a 2025 workspace that is ready (a T4 plus the Notice of Assessment) and FBAR-only years before 2023. */
function state(): AppState {
  const s = switchYear({
    ...initialState(),
    taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
    address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  }, 2025);
  return {
    ...s, filingStatus: 'single', livedInCanadaAllYear: true, accounts: [acct({})],
    slips: [
      slip('t4', { boxes: { '14': 100000, '22': 20000 } }),
      slip('noa', { type: 'NOA', payer: 'CRA', boxes: { '15000': 100000, '23600': 100000, '42000': 12000, '42800': 7000 } }),
    ],
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    catchup: {
      ...emptyCatchup(),
      daysInUs: { 2023: 10, 2024: 12, 2025: 8 },
      statement: { why: 'I thought a Canadian return was all I needed.', [accountPromptId(acct({}))]: 'Opened when I started work in Toronto.' },
      fbar: { 2020: { accounts: [acct({ id: 'a2', maxValueCad: 9000 })], noAccounts: false }, 2021: { accounts: [], noAccounts: true } },
    },
  };
}

describe('catch-up package', () => {
  it('stamps the notation in red and only on the return and the information returns', async () => {
    expect(['1040', '8938', '8621-x', '3520-a1', '3520a-a1'].every(isStamped)).toBe(true);
    expect(['sch1', 'schB', '1116-general', '8833-taxpayer', '3520stmt-a1', '2555-taxpayer'].some(isStamped)).toBe(false);
    const s = state();
    const input = toReturnInput(s)!;
    const forms = await fillReturn(input, computeReturn(input).best, load);
    const stamped = await stampRed(forms[0].bytes);
    const pdf = await readPdf(stamped.slice());
    expect(pdf.text.replace(/\s+/g, ' ')).toContain(SFOP.notation);
    // The fields stay fillable.
    expect((await PDFDocument.load(stamped)).getForm().getFields().length).toBeGreaterThan(50);
  }, 60000);

  it('builds the mailing package, cover sheet, Form 14653 worksheet and FBAR worksheets', async () => {
    const s = state();
    const plan = sfopPlan('2026-10-16');
    const r = yearReadiness(s, 2025);
    expect(r.ready, r.blockers.join(' | ')).toBe(true);
    const forms = await fillReturn(r.input!, r.result!, load);
    const owed = owedByYear(s, plan, '2026-10-16');
    expect(owed.interest[2].year).toBe(2025);

    const pkg: CatchupPackageInput = {
      plan, catchup: s.catchup, name: 'Sam Lee', ssn: '123-45-6789', address: '1 King St W, Toronto, ON, M5H 1A1, Canada',
      years: [{ year: 2025, tax: 1234, interest: 56.78, formTitles: forms.map((f) => f.title) }, { year: 2024, tax: 0, interest: 0, formTitles: ['Form 1040'] }, { year: 2023, tax: 0, interest: 0, formTitles: ['Form 1040'] }],
      payDate: '2026-10-16', preparedOn: '2026-10-16', fbar: fbarYearsOf(s, plan),
    };
    mkdirSync(OUT, { recursive: true });

    const mail = await buildMailPackage([{ year: 2025, forms }, { year: 2024, forms }]);
    writeFileSync(`${OUT}/mail-package.pdf`, mail);
    const mailPdf = await readPdf(mail.slice());
    expect(mailPdf.text.split(SFOP.notation).length - 1).toBe(2); // one 1040 per year, nothing else needs it here

    const cover = await buildCoverSheet(pkg);
    writeFileSync(`${OUT}/cover.pdf`, cover);
    const coverText = (await readPdf(cover.slice())).text.replace(/\s+/g, ' ');
    for (const t of ['Streamlined Foreign Offshore submission', '3651 South I-H 35', 'Stop 6063 AUSC', 'Austin, TX 78741', '***-**-6789', '$1,290.78', 'Streamlined Filing Compliance Procedures', '904-661-3350']) expect(coverText, t).toContain(t);
    expect(coverText).not.toContain('123-45-6789');

    const ws = await buildForm14653Worksheet(pkg);
    writeFileSync(`${OUT}/form-14653-worksheet.pdf`, ws);
    const wsText = (await readPdf(ws.slice())).text.replace(/\s+/g, ' ');
    // The statement is the person's own words, unchanged; blanks are called out, not filled in by Lou.
    expect(wsText).toContain('I thought a Canadian return was all I needed.');
    expect(wsText).toContain('Opened when I started work in Toronto.');
    expect(wsText).toContain('You left this blank in Lou');
    expect(wsText).toContain('330 full days');
    expect(wsText).toContain('non-willful conduct');
    expect(wsText).toContain('$1,290.78');

    const fbar = await buildFbarWorksheets(pkg, { taxpayer: 'Sam Lee', spouse: 'Spouse' });
    writeFileSync(`${OUT}/fbar-worksheets.pdf`, fbar);
    const fbarText = (await readPdf(fbar.slice())).text.replace(/\s+/g, ' ');
    for (const y of plan.fbarYears) expect(fbarText).toContain(`FBAR for ${y}`);
    expect(fbarText).toContain('RBC Royal Bank');
    expect(fbarText).toContain('No Canadian accounts this year, so no FBAR.');
    expect(fbarText).toContain('reason "Other", explanation "Streamlined Filing Compliance Procedures"');
  }, 120000);

  it('reads FBAR-only years from the catch-up list and return years from their workspace', () => {
    const s = state();
    expect(fbarSummary(s, 2025).inReturn).toBe(true);
    expect(fbarSummary(s, 2025).status).toBe('file');
    expect(fbarSummary(s, 2020).inReturn).toBe(false);
    expect(fbarSummary(s, 2020).status).toBe('under'); // 9,000 CAD is under US$10,000
    expect(fbarSummary(s, 2021).status).toBe('none');
    expect(fbarSummary(s, 2022).status).toBe('todo');
  });
});
