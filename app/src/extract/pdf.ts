// Reads a PDF on-device: form fields first, then the text layer. Returns
// null text when the PDF is a scan (no text layer), so the caller can OCR it.

import * as pdfjs from 'pdfjs-dist';
import type { FieldValue } from './fields';
import type { Token } from './types';

export interface PdfRead {
  pageCount: number;
  pageSizes: { width: number; height: number }[];
  fields: FieldValue[];
  tokens: Token[];
  text: string;
  hasTextLayer: boolean;
}

let workerConfigured = false;
/** Browser: point pdf.js at its bundled worker (served from our own origin). */
export function configurePdfWorker(workerUrl: string) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  workerConfigured = true;
}

export async function loadPdf(data: Uint8Array) {
  return pdfjs.getDocument({
    data,
    verbosity: 0,
    isEvalSupported: false,
    // Fonts/CMaps stay local; no fetches.
    useSystemFonts: false,
    disableWorker: !workerConfigured,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
}

export async function readPdf(data: Uint8Array): Promise<PdfRead> {
  const doc = await loadPdf(data);
  const fields: FieldValue[] = [];
  const tokens: Token[] = [];
  const pageSizes: { width: number; height: number }[] = [];
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    pageSizes.push({ width: vp.width, height: vp.height });

    for (const a of await page.getAnnotations()) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue;
      const raw = typeof a.fieldValue === 'string' ? a.fieldValue : Array.isArray(a.fieldValue) ? a.fieldValue.join(' ') : '';
      if (!raw.trim()) continue;
      const [x1, y1, x2, y2] = a.rect as number[];
      fields.push({ name: a.fieldName, value: raw, page: p - 1, rect: [x1, vp.height - y2, x2 - x1, y2 - y1] });
    }

    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = '';
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const [, , , , tx, ty] = item.transform as number[];
      const h = item.height || Math.abs((item.transform as number[])[3]) || 8;
      tokens.push(...splitWords(item.str, tx, vp.height - ty - h, item.width, h, p - 1));
      if (lastY !== null && Math.abs(ty - lastY) > 2) { lines.push(line); line = ''; }
      line += (line ? ' ' : '') + item.str.trim();
      lastY = ty;
    }
    lines.push(line);
  }
  const text = lines.join('\n') + '\n' + fields.map((f) => f.value).join('\n');
  return { pageCount: doc.numPages, pageSizes, fields, tokens, text, hasTextLayer: tokens.length > 20 };
}

/** Splits a text run into word tokens, estimating x by character share (monospace-ish approximation). */
export function splitWords(str: string, x: number, y: number, w: number, h: number, page: number): Token[] {
  const out: Token[] = [];
  const total = str.length || 1;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  // Keep money with internal spaces ("100 000,00") together: join digit groups with a no-break space.
  const merged = str.replace(/(\d) (?=\d{3}\b)/g, '$1 ');
  while ((m = re.exec(merged))) {
    const text = m[0].replace(/ /g, ' ');
    out.push({ text, x: x + (m.index / total) * w, y, w: (m[0].length / total) * w, h, page });
  }
  return out;
}
