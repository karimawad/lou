import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PSM } from 'tesseract.js';
import { afterAll, describe, expect, it } from 'vitest';
import { getOcrWorker, ocrImage, terminateOcr } from './ocr';
import { binarize, fitAffine, parseBoxText, apply, lineWidthPx, readBoxes, register, templateFor, type EraseMode, type PixelContext, type Segment } from './template';

const FIX = resolve(__dirname, '__fixtures__');
const LANG = resolve(__dirname, '../../public/tesseract/lang');

describe('parseBoxText', () => {
  it.each([
    ['100000.00', true, 100000, false], ['5000 00', true, 5000, false], ['4034,10', true, 4034.1, false],
    ['5000 0', true, 5000, true], ['10000000', true, 100000, true], ['650.00', false, 650, false], ['1077.4', true, 1077.4, true],
  ])('%s', (raw, divider, value, ambiguous) => {
    expect(parseBoxText(raw as string, divider as boolean)).toEqual({ value, ambiguous });
  });
});

describe('fitAffine', () => {
  it('recovers a rotation + scale + shift', () => {
    const t = (x: number, y: number): [number, number] => [2 * Math.cos(0.1) * x - 2 * Math.sin(0.1) * y + 30, 2 * Math.sin(0.1) * x + 2 * Math.cos(0.1) * y - 5];
    const pts: [number, number][] = [[0, 0], [100, 0], [0, 50], [80, 90]];
    const m = fitAffine(pts.map((p) => ({ from: p, to: t(...p) })))!;
    const [u, v] = apply(m, 40, 70);
    expect(u).toBeCloseTo(t(40, 70)[0], 6);
    expect(v).toBeCloseTo(t(40, 70)[1], 6);
  });
});

describe('template OCR on a phone photo of a T4', () => {
  afterAll(() => terminateOcr());
  it('registers the photo, reads amounts, and never marks a wrong value as confident', async () => {
    const bytes = readFileSync(`${FIX}/t4-2025-photo.jpg`);
    const worker = await getOcrWorker({ langPath: LANG });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
    const page = await ocrImage(bytes, 0, worker);
    const tpl = templateFor('T4', 2025)!;
    const reg = register(tpl, page.tokens);
    expect(reg).not.toBeNull();

    const img = await loadImage(bytes);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' });
    const read = async ([x, y, w, h]: [number, number, number, number], erase: Segment[] = [], mode: EraseMode = 'smart') => {
      const scale = Math.max(1, 64 / h);
      const c = createCanvas(Math.ceil(w * scale) + 20, Math.ceil(h * scale) + 20);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, x, y, w, h, 10, 10, w * scale, h * scale);
      const segments = erase.map(([x1, y1, x2, y2]) => [(x1 - x) * scale + 10, (y1 - y) * scale + 10, (x2 - x) * scale + 10, (y2 - y) * scale + 10] as Segment);
      binarize(g as unknown as PixelContext, c.width, c.height, { segments, thickness: lineWidthPx(reg!.m) * scale, mode });
      const { data } = await worker.recognize(c.toBuffer('image/png'));
      return { text: data.text, confidence: data.confidence };
    };
    const boxes = await readBoxes(tpl, reg!.m, read);
    const got = Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, v.value]));
    const truth: Record<string, number> = { '14': 100000, '22': 22000, '16': 4034.1, '18': 1077.48, '20': 5000, '44': 650 };
    // Found exactly the boxes that hold amounts, no phantom values from empty boxes.
    expect(Object.keys(got).sort()).toEqual(Object.keys(truth).sort());
    // The guarantee: a value Lou marks as confident is exactly right. Uncertain reads are flagged for review.
    for (const [box, read] of Object.entries(boxes)) {
      if (read.confidence > 0.5) expect(read.value, `box ${box}`).toBe(truth[box]);
    }
    expect(Object.entries(got).filter(([k, v]) => truth[k] === v).length).toBeGreaterThanOrEqual(4);
  }, 180000);
});
