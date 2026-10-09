import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { computeReturn } from '../tax/compute';
import type { ReturnInput } from '../tax/model';
import { buildReadingGuide, readingGuideNotes } from './readingGuide';

const input: ReturnInput = {
  year: 2025, filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01', occupation: 'Engineer' },
  dependents: [],
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 200000, '22': 50000 } }],
  assessments: [{ owner: 'taxpayer', totalIncome: 200000, netIncome: 200000, netFederalTax: 36000, provincialTax: 24000 }],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
};

describe('reading guide', () => {
  const r = computeReturn(input).best;
  const notes = readingGuideNotes(input, r);
  const text = notes.map((n) => `${n.title} ${n.body}`).join(' ');

  it('explains the regular credit against the Schedule 3 figure', () => {
    expect(text).toContain(`$${r.schedule3['1'].toLocaleString('en-US')}`);
    expect(notes[0].title).toMatch(/regular credit and AMT credit/);
  });
  it('says Schedule B line 7a is Yes and line 8 is No without a trust', () => {
    expect(text).toContain('line 7a is Yes');
    expect(text).toContain('Line 8 is No');
  });
  it('has no em dashes', () => { expect(text).not.toMatch(/—/); });
  it('builds a PDF', async () => {
    const doc = await PDFDocument.load(await buildReadingGuide(input, r, '2026-10-08'));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
