// On-device OCR with tesseract.js. Engine and language data are served from
// Lou's own origin (public/tesseract), never a CDN.

import { createWorker, OEM, type Worker } from 'tesseract.js';
import type { Token } from './types';

let workerPromise: Promise<Worker> | null = null;

export interface OcrPaths { workerPath: string; corePath: string; langPath: string }

export const BROWSER_OCR_PATHS: OcrPaths = {
  workerPath: '/tesseract/worker.min.js',
  corePath: '/tesseract/core',
  langPath: '/tesseract/lang',
};

export function getOcrWorker(paths: Partial<OcrPaths> = BROWSER_OCR_PATHS, onProgress?: (p: number) => void): Promise<Worker> {
  workerPromise ??= createWorker('eng', OEM.LSTM_ONLY, {
    ...Object.fromEntries(Object.entries(paths).filter(([, v]) => v)),
    workerBlobURL: false,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  return workerPromise;
}

export async function terminateOcr() {
  if (workerPromise) (await workerPromise).terminate();
  workerPromise = null;
}

interface OcrWord { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }
interface OcrBlock { paragraphs: { lines: { words: OcrWord[] }[] }[] }

/** Runs OCR on an image (canvas, blob, URL, or buffer) and returns word tokens in image pixels. */
export async function ocrImage(
  image: Parameters<Worker['recognize']>[0], page = 0, worker?: Worker,
): Promise<{ tokens: Token[]; text: string; width: number; height: number }> {
  const w = worker ?? await getOcrWorker();
  const { data } = await w.recognize(image, {}, { blocks: true, text: true });
  const tokens: Token[] = [];
  for (const block of (data.blocks ?? []) as unknown as OcrBlock[]) {
    for (const para of block.paragraphs) for (const line of para.lines) for (const word of line.words) {
      const t = word.text.trim();
      if (!t) continue;
      const { x0, y0, x1, y1 } = word.bbox;
      tokens.push({ text: t, x: x0, y: y0, w: x1 - x0, h: y1 - y0, page });
    }
  }
  const maxX = Math.max(0, ...tokens.map((t) => t.x + t.w));
  const maxY = Math.max(0, ...tokens.map((t) => t.y + t.h));
  return { tokens: mergeSpacedNumbers(tokens), text: data.text ?? '', width: maxX, height: maxY };
}

/** OCR splits "100 000,00" into words; rejoin digit groups that sit side by side on one line. */
export function mergeSpacedNumbers(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    const sameLine = prev && prev.page === t.page && Math.abs(prev.y - t.y) < prev.h * 0.6;
    const gap = prev ? t.x - (prev.x + prev.w) : Infinity;
    // Thousands groups: "100" "000,00"
    if (sameLine && /^\d{1,3}$/.test(prev.text) && /^\d{3}([.,]\d{2})?$/.test(t.text) && gap < prev.h * 0.8) {
      out[out.length - 1] = { ...prev, text: `${prev.text} ${t.text}`, w: t.x + t.w - prev.x };
    // CRA boxes print a divider between dollars and cents: "100000." "00", "100000" "|00", "4034" "10"
    } else if (sameLine && /^[\d,. ]*\d[.,]?$/.test(prev.text) && /^[|Il]?\d{2}$/.test(t.text) && gap < prev.h * 1.6
      && !/[.,]\d{2}$/.test(prev.text)) {
      const dollars = prev.text.replace(/[.,]$/, '');
      out[out.length - 1] = { ...prev, text: `${dollars}.${t.text.slice(-2)}`, w: t.x + t.w - prev.x };
    } else out.push({ ...t });
  }
  return out;
}
