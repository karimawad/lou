// Template OCR: register a photo of a CRA slip to the official layout, then
// read each amount box on its own. Templates come from the official fillable
// slips (research/make_templates.py). Coordinates: template in PDF points,
// photo in image pixels, both top-left origin.

import type { SlipType } from '../tax/slips';
import type { BoxRead, Token } from './types';

export interface SlipTemplate {
  type: SlipType;
  year: number;
  page: [number, number];
  region: [number, number, number, number];
  boxes: Record<string, { rect: [number, number, number, number]; divider: number | null }>;
  anchors: { text: string; x: number; y: number; h: number }[];
}

const files = import.meta.glob('./templates/*-20*.json', { eager: true, import: 'default' }) as Record<string, SlipTemplate>;
export const TEMPLATES: SlipTemplate[] = Object.values(files);

export function templateFor(type: SlipType, year?: number): SlipTemplate | undefined {
  const all = TEMPLATES.filter((t) => t.type === type).sort((a, b) => b.year - a.year);
  return all.find((t) => t.year === year) ?? all[0];
}

/** Affine transform: image = [a b c; d e f] * [x y 1]. */
export interface Affine { a: number; b: number; c: number; d: number; e: number; f: number }

export function apply(m: Affine, x: number, y: number): [number, number] {
  return [m.a * x + m.b * y + m.c, m.d * x + m.e * y + m.f];
}

/** Least-squares affine fit from point pairs (needs 3+ non-collinear pairs). */
export function fitAffine(pairs: { from: [number, number]; to: [number, number] }[]): Affine | null {
  if (pairs.length < 3) return null;
  // Normal equations for [x y 1] -> u and [x y 1] -> v.
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0;
  let sxu = 0, syu = 0, su = 0, sxv = 0, syv = 0, sv = 0;
  for (const { from: [x, y], to: [u, v] } of pairs) {
    sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; n++;
    sxu += x * u; syu += y * u; su += u; sxv += x * v; syv += y * v; sv += v;
  }
  const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const solve = (r: number[]) => solve3(M, r);
  const p = solve([sxu, syu, su]);
  const q = solve([sxv, syv, sv]);
  if (!p || !q) return null;
  return { a: p[0], b: p[1], c: p[2], d: q[0], e: q[1], f: q[2] };
}

function solve3(A: number[][], r: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-9) return null;
  return [0, 1, 2].map((i) => det(A.map((row, k) => row.map((v, j) => (j === i ? r[k] : v)))) / D);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Finds the transform from template to photo using anchor words. RANSAC over
 * candidate matches so a few misread words can't skew the fit.
 */
export function register(tpl: SlipTemplate, tokens: Token[]): { m: Affine; inliers: number } | null {
  const byText = new Map<string, Token[]>();
  for (const t of tokens) {
    const k = norm(t.text);
    if (k.length >= 2) byText.set(k, [...(byText.get(k) ?? []), t]);
  }
  const matches: { from: [number, number]; to: [number, number]; h: number }[] = [];
  for (const a of tpl.anchors) {
    const hits = byText.get(a.text);
    if (!hits) continue;
    for (const t of hits.slice(0, 3)) matches.push({ from: [a.x, a.y], to: [t.x + t.w / 2, t.y + t.h / 2], h: t.h });
  }
  if (matches.length < 4) return null;
  const tol = Math.max(8, median(matches.map((m) => m.h)) * 1.5);

  let best: { m: Affine; inliers: typeof matches } | null = null;
  // Deterministic sampling: try all triples among the first 40 matches.
  const pool = matches.slice(0, 40);
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) for (let k = j + 1; k < pool.length; k++) {
    const m = fitAffine([pool[i], pool[j], pool[k]]);
    if (!m || !plausible(m)) continue;
    const inl = matches.filter((p) => dist(apply(m, ...p.from), p.to) < tol);
    if (!best || inl.length > best.inliers.length) best = { m, inliers: inl };
  }
  if (!best || best.inliers.length < 4) return null;
  const refined = fitAffine(best.inliers) ?? best.m;
  return { m: refined, inliers: best.inliers.length };
}

function plausible(m: Affine): boolean {
  // Scale within 0.3x-20x, nearly uniform, rotation under ~20 degrees.
  const sx = Math.hypot(m.a, m.d), sy = Math.hypot(m.b, m.e);
  return sx > 0.3 && sx < 20 && sy > 0.3 && sy < 20 && Math.abs(sx / sy - 1) < 0.25 && Math.abs(m.d / sx) < 0.35;
}

const dist = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 10;

/** Image-space rectangle for a template rect (axis-aligned bounding box of the mapped corners). */
export function mapRect(m: Affine, [x, y, w, h]: [number, number, number, number], pad = 0): [number, number, number, number] {
  const pts = [apply(m, x, y), apply(m, x + w, y), apply(m, x, y + h), apply(m, x + w, y + h)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  return [x0, y0, Math.max(...xs) - x0 + pad, Math.max(...ys) - y0 + pad];
}

/** Reads text from a cropped image region (digits only). Provided by the platform (browser canvas or tests). */
/** Line segment in image pixels [x1, y1, x2, y2]. */
export type Segment = [number, number, number, number];

export type ReadRegion = (
  rect: [number, number, number, number],
  /** Known form lines inside the crop (e.g. the cents divider) to paint white before reading. */
  erase?: Segment[],
  /** smart: remove line except where glyph strokes cross it. outside: remove only above/below the digits. */
  mode?: EraseMode,
) => Promise<{ text: string; confidence: number }>;

export type EraseMode = 'smart' | 'outside';

/** Parses one OCR read of an amount box. */
/**
 * Parses one OCR read of an amount box. `ambiguous` marks reads whose cents
 * can't be trusted (a cents group that isn't exactly two digits, or digits run
 * together with no visible separator); those are always shown as "please check".
 */
export function parseBoxText(raw: string, hasDivider: boolean): { value: number; ambiguous: boolean } | null {
  const t = raw.trim().replace(/[|]/g, ' ');
  // Dollars and cents with a visible separator: "100000.00", "5000 00", "4034,10".
  const split = t.match(/^(\d[\d,]*)\s*[.,]?\s+(\d{1,3})$/) ?? t.match(/^(\d[\d,]*)[.,](\d{1,3})$/);
  if (split) {
    const dollars = Number(split[1].replace(/,/g, ''));
    const cents = split[2];
    if (cents.length === 2) return { value: dollars + Number(cents) / 100, ambiguous: false };
    // One or three cent digits: OCR dropped or invented one. Best guess, flagged.
    return { value: dollars + Number(cents.padEnd(2, '0').slice(0, 2)) / 100, ambiguous: true };
  }
  const cleaned = t.replace(/[^\d,]/g, '').replace(/^,+|,+$/g, '');
  const digits = cleaned.replace(/,/g, '');
  if (!digits) return null;
  // Digits run together. With a printed divider the last two are probably cents, but nothing proves it.
  if (hasDivider && digits.length > 2) return { value: Number(digits.slice(0, -2)) + Number(digits.slice(-2)) / 100, ambiguous: true };
  if (/^\d[\d,]*$/.test(cleaned)) return { value: Number(digits), ambiguous: hasDivider };
  return null;
}

/**
 * Reads every box of a registered slip. Boxes with a printed cents divider are
 * read two ways (divider removed everywhere it stands alone, and only outside
 * the digits). Agreement means high confidence; disagreement keeps the more
 * confident read and marks it for the user to check.
 */
export async function readBoxes(tpl: SlipTemplate, m: Affine, read: ReadRegion): Promise<Record<string, BoxRead>> {
  const out: Record<string, BoxRead> = {};
  for (const [box, { rect, divider }] of Object.entries(tpl.boxes)) {
    const [x, y, w, h] = rect;
    const inset = Math.min(1.2, h * 0.08);
    const crop = mapRect(m, [x + inset, y + inset, w - 2 * inset, h - 2 * inset]);
    const erase: Segment[] = divider ? [[...apply(m, divider, y - 2), ...apply(m, divider, y + h + 2)]] : [];
    const modes: EraseMode[] = divider ? ['smart', 'outside'] : ['smart'];
    const reads = [];
    for (const mode of modes) {
      const r = await read(crop, erase, mode);
      const parsed = parseBoxText(r.text, !!divider);
      reads.push({ raw: r.text.trim(), conf: r.confidence, value: parsed?.value ?? null, ambiguous: parsed?.ambiguous ?? true });
    }
    const valid = reads.filter((r) => r.value !== null && r.value !== 0
      // A lone low-confidence digit in a box is almost always a border fragment, not an amount.
      && !(r.raw.replace(/[^\d]/g, '').length <= 1 && r.conf < 60));
    if (!valid.length) continue;
    const best = valid.reduce((p, q) => (q.conf > p.conf ? q : p));
    const agree = valid.length === modes.length && valid.every((r) => r.value === best.value) && valid.every((r) => !r.ambiguous);
    const base = Math.min(0.95, best.conf / 100);
    out[box] = {
      value: best.value!, source: 'ocr', page: 0, rect: mapRect(m, rect), raw: best.raw,
      confidence: modes.length > 1 ? (agree ? Math.max(0.8, base) : Math.min(0.5, base)) : Math.max(0.3, base),
    };
  }
  return out;
}

/** Minimal 2D-context surface shared by the browser canvas and @napi-rs/canvas. */
export interface PixelContext {
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
  putImageData(img: { data: Uint8ClampedArray }, x: number, y: number): void;
}

/** Grayscale + Otsu threshold in place: pure black ink on white, which OCR reads best. */
export function binarize(g: PixelContext, w: number, h: number, lines: { segments: Segment[]; thickness: number; mode?: EraseMode } = { segments: [], thickness: 0 }) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gray[p] = v; hist[v]++;
  }
  const total = w * h;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    const v = gray[p] <= threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  eraseSegments(d, w, h, lines.segments, lines.thickness, lines.mode ?? 'smart');
  eraseFormLines(d, w, h);
  g.putImageData(img, 0, 0);
}

/**
 * Erases box borders and the cents divider from a binarized crop. Form lines run
 * edge to edge; digits sit in the middle band. A column counts as a line when it
 * has ink in both the top and bottom bands (a pixel of tilt allowed) and is at
 * least half ink overall. Rows are treated the same way for horizontal edges.
 */
export function eraseFormLines(d: Uint8ClampedArray, w: number, h: number) {
  const ink = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && d[(y * w + x) * 4] === 0;
  const white = (x: number, y: number) => { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; };
  const band = Math.max(2, Math.round(h * 0.12));
  const lineCols: number[] = [];
  for (let x = 0; x < w; x++) {
    let count = 0, top = false, bottom = false;
    for (let y = 0; y < h; y++) {
      const hit = ink(x, y) || ink(x - 1, y) || ink(x + 1, y);
      if (ink(x, y)) count++;
      if (hit && y < band) top = true;
      if (hit && y >= h - band) bottom = true;
    }
    if (top && bottom && count >= h * 0.5) lineCols.push(x);
  }
  for (const x of lineCols) for (let y = 0; y < h; y++) white(x, y);

  const bandX = Math.max(2, Math.round(w * 0.06));
  for (let y = 0; y < h; y++) {
    let count = 0, left = false, right = false;
    for (let x = 0; x < w; x++) {
      const hit = ink(x, y) || ink(x, y - 1) || ink(x, y + 1);
      if (ink(x, y)) count++;
      if (hit && x < bandX) left = true;
      if (hit && x >= w - bandX) right = true;
    }
    if (left && right && count >= w * 0.5) for (let x = 0; x < w; x++) white(x, y);
  }
}

/** Line width (in image pixels) to paint over a 1pt form line, given the template-to-image transform. */
export function lineWidthPx(m: Affine): number {
  return Math.max(2, Math.hypot(m.a, m.d) * 1.3);
}

/**
 * Removes known thin lines (crop coordinates) without cutting glyphs: a line
 * pixel is whitened only where both sides of the line are white. Where a digit
 * stroke crosses the line, the stroke survives.
 */
export function eraseSegments(d: Uint8ClampedArray, w: number, h: number, segments: Segment[], thickness: number, mode: EraseMode = 'smart') {
  const half = Math.max(1, Math.ceil(thickness / 2));
  const isInk = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && d[(y * w + x) * 4] === 0;
  for (const [x1, y1, x2, y2] of segments) {
    const ys = Math.max(0, Math.floor(Math.min(y1, y2))), ye = Math.min(h - 1, Math.ceil(Math.max(y1, y2)));
    for (let y = ys; y <= ye; y++) {
      const t = y2 === y1 ? 0 : (y - y1) / (y2 - y1);
      const cx = Math.round(x1 + (x2 - x1) * t);
      // Find the actual dark run near the expected x (photos are never perfectly registered).
      let lo = cx, hi = cx;
      let found = false;
      for (let dx = -half - 1; dx <= half + 1 && !found; dx++) if (isInk(cx + dx, y)) { lo = hi = cx + dx; found = true; }
      if (!found) continue;
      while (isInk(lo - 1, y) && cx - lo < half + 1) lo--;
      while (isInk(hi + 1, y) && hi - cx < half + 1) hi++;
      const rowHasGlyph = () => { for (let x = 0; x < w; x++) if ((x < lo - 1 || x > hi + 1) && isInk(x, y)) return true; return false; };
      const erase = mode === 'outside' ? !rowHasGlyph() : !isInk(lo - 1, y) && !isInk(hi + 1, y);
      if (erase) {
        for (let x = lo; x <= hi; x++) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; }
      }
    }
  }
}
