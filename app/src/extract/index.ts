// Turns one uploaded document into zero or more slips, entirely on-device.
// Order of trust: PDF form fields > PDF text layer > OCR. Every value is
// shown to the user for confirmation before it touches the return.

import { keepCatalogBoxes } from './catalog';
import { detectSlipType, detectYear } from './detect';
import { boxesFromFields } from './fields';
import { matchBoxes } from './layout';
import { readPdf } from './pdf';
import { isT1Return, t1FromFields, t1FromText, t1Year } from './t1';
import type { ExtractedSlip, Token } from './types';

export { keepCatalogBoxes };

/** Reads one page of a scanned PDF as an image and returns the slips found on it. */
export type OcrFn = (page: number) => Promise<ExtractedSlip[]>;

export interface ExtractResult {
  slips: ExtractedSlip[];
  /** How Lou read the document, for the UI ("Read from the PDF's form fields"). */
  method: 'fields' | 'text' | 'ocr' | 'none';
  pageCount: number;
  pageSizes: { width: number; height: number }[];
}

export async function extractPdf(data: Uint8Array, ocr?: OcrFn): Promise<ExtractResult> {
  const pdf = await readPdf(data);
  const base = { pageCount: pdf.pageCount, pageSizes: pdf.pageSizes };
  const { type, evidence } = detectSlipType(pdf.text);
  const year = detectYear(pdf.text);

  if (isT1Return(pdf.text)) {
    const t1 = { type, year: t1Year(pdf.text) ?? year, payer: 'T1 return', evidence };
    const fromFields = t1FromFields(pdf.fields);
    if (Object.keys(fromFields).length) return { slips: [{ ...t1, boxes: fromFields }], method: 'fields', ...base };
    const fromText = pdf.hasTextLayer ? t1FromText(pdf.tokens) : {};
    if (Object.keys(fromText).length) return { slips: [{ ...t1, boxes: fromText }], method: 'text', ...base };
  }

  if (pdf.fields.length) {
    const groups = boxesFromFields(pdf.fields);
    const slips = groups
      .map((g) => ({ type, year: g.year ?? year, payer: g.payer, boxes: keepCatalogBoxes(type, g.boxes), evidence }))
      .filter((s) => Object.keys(s.boxes).length);
    if (slips.length) return { slips, method: 'fields', ...base };
  }

  if (pdf.hasTextLayer && type) {
    const boxes = keepCatalogBoxes(type, matchBoxes(pdf.tokens, type, 'text'));
    if (Object.keys(boxes).length) return { slips: [{ type, year, boxes, evidence }], method: 'text', ...base };
  }

  if (ocr) {
    const slips: ExtractedSlip[] = [];
    for (let p = 0; p < pdf.pageCount; p++) slips.push(...(await ocr(p)));
    return { slips, method: 'ocr', ...base };
  }

  return { slips: type ? [{ type, year, boxes: {}, evidence }] : [], method: 'none', ...base };
}

/** OCR result (from a photo or a scanned PDF) to slips. */
export function fromOcr(tokens: Token[], text: string): Pick<ExtractResult, 'slips' | 'method'> {
  const { type, evidence } = detectSlipType(text);
  if (!type) return { slips: [], method: 'ocr' };
  const boxes = keepCatalogBoxes(type, matchBoxes(tokens, type, 'ocr'));
  return { slips: [{ type, year: detectYear(text), boxes, evidence }], method: 'ocr' };
}
