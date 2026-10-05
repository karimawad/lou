// Browser entry point for reading a user's document. Everything runs locally:
// pdf.js and tesseract.js workers are served from Lou's own origin.

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PSM } from 'tesseract.js';
import { slipsFromCsv } from './csv';
import { detectSlipType, detectYear } from './detect';
import { extractPdf, keepCatalogBoxes } from './index';
import { matchBoxes } from './layout';
import { getOcrWorker, ocrImage } from './ocr';
import { configurePdfWorker, loadPdf } from './pdf';
import { binarize, lineWidthPx, readBoxes, register, templateFor, type EraseMode, type Segment } from './template';
import type { ExtractedSlip } from './types';

configurePdfWorker(workerUrl);

export type ReadMethod = 'fields' | 'text' | 'ocr' | 'csv' | 'none';

export interface ReadDocument {
  slips: (ExtractedSlip & { owner?: 'taxpayer' | 'spouse' })[];
  method: ReadMethod;
  /** One preview image per page (PNG blobs) for the side-by-side review. */
  previews: Blob[];
  /** Scale from the extracted rect units to preview pixels, per page. */
  previewScale: number[];
  errors: string[];
}

export interface Progress { stage: 'reading' | 'ocr' | 'done'; fraction: number; label: string }

const PREVIEW_DPI = 144;

export async function readDocument(file: File, onProgress?: (p: Progress) => void): Promise<ReadDocument> {
  const name = file.name.toLowerCase();
  if (file.type === 'text/csv' || name.endsWith('.csv') || name.endsWith('.tsv')) {
    const r = slipsFromCsv(await file.text());
    return { slips: r.slips, method: 'csv', previews: [], previewScale: [], errors: r.errors };
  }
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return readPdfFile(file, onProgress);
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/.test(name)) return readImageFile(file, onProgress);
  return { slips: [], method: 'none', previews: [], previewScale: [], errors: [`Lou can read PDF, CSV and photo files. "${file.name}" is a different kind of file.`] };
}

async function readPdfFile(file: File, onProgress?: (p: Progress) => void): Promise<ReadDocument> {
  onProgress?.({ stage: 'reading', fraction: 0.1, label: 'Opening the PDF' });
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await loadPdf(data.slice());
  const canvases: HTMLCanvasElement[] = [];
  const previews: Blob[] = [];
  const scale = PREVIEW_DPI / 72;
  // Eight pages covers a T1 return's lines up to 43700 (page 8); slips are one or two pages.
  for (let p = 1; p <= Math.min(doc.numPages, 8); p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    canvases.push(canvas);
    previews.push(await toBlob(canvas));
  }
  onProgress?.({ stage: 'reading', fraction: 0.4, label: 'Reading the slip' });

  const result = await extractPdf(data, async (pageIndex) => {
    onProgress?.({ stage: 'ocr', fraction: 0.5, label: 'This PDF is a scan. Reading it like a photo' });
    const canvas = canvases[pageIndex];
    const r = await ocrCanvas(canvas);
    // Report rects in PDF points so the preview scale stays uniform.
    for (const s of r.slips) for (const b of Object.values(s.boxes)) if (b.rect) b.rect = b.rect.map((v) => v / scale) as typeof b.rect;
    return r.slips;
  });
  onProgress?.({ stage: 'done', fraction: 1, label: 'Done' });
  return { slips: result.slips, method: result.method, previews, previewScale: previews.map(() => scale), errors: [] };
}

async function readImageFile(file: File, onProgress?: (p: Progress) => void): Promise<ReadDocument> {
  onProgress?.({ stage: 'reading', fraction: 0.1, label: 'Opening the photo' });
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  // OCR works best around 1800-2600px wide; scale big phone photos down, small ones up.
  const target = Math.min(2600, Math.max(1800, bitmap.width));
  const s = target / bitmap.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * s); canvas.height = Math.round(bitmap.height * s);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  onProgress?.({ stage: 'ocr', fraction: 0.3, label: 'Reading the photo' });
  const r = await ocrCanvas(canvas, (f) => onProgress?.({ stage: 'ocr', fraction: 0.3 + f * 0.6, label: 'Reading the photo' }));
  onProgress?.({ stage: 'done', fraction: 1, label: 'Done' });
  return { slips: r.slips, method: 'ocr', previews: [await toBlob(canvas)], previewScale: [1], errors: r.slips.length ? [] : ["Lou couldn't tell which slip this is. You can pick the slip type and type the numbers in."] };
}

/** Full-page OCR, then template registration and per-box reads; falls back to layout matching. */
async function ocrCanvas(canvas: HTMLCanvasElement, onFraction?: (f: number) => void): Promise<{ slips: ExtractedSlip[]; text: string }> {
  const worker = await getOcrWorker(undefined, onFraction);
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
  const page = await ocrImage(canvas, 0, worker);
  const { type, evidence } = detectSlipType(page.text);
  if (!type) return { slips: [], text: page.text };
  const year = detectYear(page.text);

  const tpl = type !== 'NOA' ? templateFor(type, year) : undefined;
  const reg = tpl ? register(tpl, page.tokens) : null;
  if (tpl && reg) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' });
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const boxes = await readBoxes(tpl, reg.m, async ([x, y, w, h], erase: Segment[] = [], mode: EraseMode = 'smart') => {
      const scale = Math.max(1, 64 / h);
      const crop = document.createElement('canvas');
      crop.width = Math.ceil(w * scale) + 20; crop.height = Math.ceil(h * scale) + 20;
      const g = crop.getContext('2d', { willReadFrequently: true })!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, crop.width, crop.height);
      g.drawImage(ctx.canvas, x, y, w, h, 10, 10, w * scale, h * scale);
      const segments = erase.map(([x1, y1, x2, y2]) => [(x1 - x) * scale + 10, (y1 - y) * scale + 10, (x2 - x) * scale + 10, (y2 - y) * scale + 10] as Segment);
      binarize(g, crop.width, crop.height, { segments, thickness: lineWidthPx(reg.m) * scale, mode });
      const { data } = await worker.recognize(crop);
      return { text: data.text, confidence: data.confidence };
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
    return { slips: [{ type, year, boxes, evidence }], text: page.text };
  }
  // No template (NOA) or registration failed: position matching on the OCR words, low confidence.
  const boxes = keepCatalogBoxes(type, matchBoxes(page.tokens, type, 'ocr'));
  for (const b of Object.values(boxes)) b.confidence = Math.min(b.confidence, 0.5);
  return { slips: [{ type, year, boxes, evidence }], text: page.text };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render page'))), 'image/png'));
}
