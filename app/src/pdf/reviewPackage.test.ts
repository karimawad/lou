import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { readPdf } from '../extract/pdf';
import { initialState, switchYear, type AppState, type SlipRecord } from '../state/store';
import { toReturnInput } from '../state/toInput';
import { computeReturn } from '../tax/compute';
import { fillReturn } from './fill';
import { buildReviewPackage, winAnsi } from './reviewPackage';

const PUBLIC = resolve(__dirname, '../../public');
const load = async (p: string) => { const b = readFileSync(PUBLIC + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
// A 1x1 PNG stands in for an uploaded page image.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

const slip = (id: string, over: Partial<SlipRecord>): SlipRecord => ({
  id, type: 'T4', owner: 'taxpayer', payer: 'Maple Co', year: 2025, boxes: {}, reads: {}, edited: [], confirmed: true, ...over,
});

function household(): AppState {
  const s = switchYear({
    ...initialState(),
    taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
    address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  }, 2025);
  return {
    ...s, filingStatus: 'single', livedInCanadaAllYear: true, noAccounts: true,
    docs: [{ id: 'd1', name: 'T1-2025.pdf', kind: 'pdf', method: 'text', addedAt: 0, previewKeys: ['k'], previewScale: [2], errors: [] }],
    slips: [
      slip('t1', { type: 'NOA', payer: 'T1 return', docId: 'd1',
        boxes: { '10100': 100000, '12900': 2000, '15000': 102000, '23600': 102000, '42000': 14000, '42800': 8000 },
        reads: { '42000': { value: 14000, source: 'text', confidence: 0.9 } },
        derivedAnswers: { '12900': { rrspKind: 'withdrawal' } } }),
      slip('t5', { type: 'T5', payer: 'Bank', boxes: { '13': 400 }, reads: { '13': { value: 400, source: 'field', confidence: 1 } } }),
    ],
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  };
}

describe('review package for a tax professional', () => {
  it('shows every number with how it was read, where it goes and its source, then the forms and the documents', async () => {
    const state = household();
    const input = toReturnInput(state)!;
    const result = computeReturn(input).best;
    const forms = await fillReturn(input, result, load);
    const bytes = await buildReviewPackage({
      state, input, result, forms, preparedOn: '2026-10-05',
      flags: [{ id: 'x', severity: 'warn', title: 'Check this example warning', detail: 'Example detail.' }],
      sourcePages: [{ doc: 'T1-2025.pdf', page: 0, png: PNG }],
    });
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/review-package.pdf'), bytes);

    const formPages = (await Promise.all(forms.map(async (f) => (await PDFDocument.load(f.bytes)).getPageCount()))).reduce((a, b) => a + b, 0);
    const pdf = await readPdf(bytes.slice());
    // Summary pages + every form page + the source-documents title page + one page per image.
    expect(pdf.pageCount).toBeGreaterThan(formPages + 2);
    const text = pdf.text.replace(/\s+/g, ' ');
    for (const s of [
      'Review package for a tax professional', 'Sam Lee - tax year 2025 - Single', '***-**-6789',
      'T4 - From your T1, line 10100 - box 14 Employment income', 'Read: From T1 line 10100',
      'Goes to: Form 1040, line 1h', 'Source: Form 1040 instructions, lines 1a and 1h',
      'T5 - Bank - box 13 Interest from Canadian sources', 'Read: Exact',
      'T1 return - line 42000 Net federal tax', 'Read: High', 'Source: IRC 901',
      'RRSP income on T1 line 12900: a withdrawal (T4RSP box 22)', 'Check: Check this example warning',
      'T1-2025.pdf - page 1', 'Lou is software, not a paid preparer',
    ]) expect(text).toContain(s);
    // The T1's income lines appear once, as the slips made from them.
    expect(text).not.toContain('T1 return - line 10100');
    // The full SSN stays on the IRS forms only, never in Lou's own pages.
    expect(text.slice(0, text.indexOf('Warnings Lou raised'))).not.toContain('123-45-6789');
  }, 60000);

  it('keeps text inside the standard PDF font character set', () => {
    expect(winAnsi('Schedule B → line 2b · ≈ $5 – “ok” ’')).toBe('Schedule B -> line 2b - ~ $5 - "ok" \'');
  });
});
