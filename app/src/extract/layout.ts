// Matches box labels to amounts by position. Works the same for a PDF text
// layer and OCR words (both arrive as top-left-origin tokens).

import { SLIPS, type SlipType } from '../tax/slips';
import { parseAmount } from './amount';
import type { BoxRead, ExtractSource, Token } from './types';

/** T1 lines Lou reads from a Notice of Assessment. */
export const NOA_LINES = ['15000', '23600', '26000', '42000', '42800', '43500', '44000', '43700'] as const;

interface Candidate { label: Token; amount: Token; value: number; score: number }

function amountTokens(tokens: Token[]): { t: Token; value: number }[] {
  const out: { t: Token; value: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const v = parseAmount(t.text);
    // Slips always print amounts with cents ("1000.00"). Requiring cents keeps out years,
    // account numbers, and figures quoted in the instructions on the back of the slip.
    if (v !== null && /\d[.,]\d{2}$/.test(t.text.trim())) {
      out.push({ t, value: v });
    }
  }
  return out;
}

/**
 * Pairs each known box label with the nearest plausible amount to its right
 * (same row) or just below it. Greedy by distance, one amount per box.
 */
export function matchBoxes(tokens: Token[], type: SlipType, source: ExtractSource): Record<string, BoxRead> {
  const known = type === 'NOA'
    ? new Set<string>(NOA_LINES)
    : new Set(SLIPS[type].boxes.map((b) => b.box.replace(/^0+(?=\d)/, '')));
  const norm = (s: string) => s.trim().replace(/^(box|case)\s*/i, '').replace(/^0+(?=\d)/, '').toUpperCase();
  const labels = tokens.filter((t) => known.has(norm(t.text)));
  const amounts = amountTokens(tokens);
  const cands: Candidate[] = [];

  // NOA rows are long, so a slightly tilted photo shifts the amount column by a row. The line
  // numbers form a column: fit x = a + b*y through them; rows then run along dy = -b*dx.
  let tilt = 0;
  if (type === 'NOA' && labels.length >= 3) {
    const n = labels.length;
    const my = labels.reduce((t, l) => t + l.y, 0) / n;
    const mx = labels.reduce((t, l) => t + l.x, 0) / n;
    const vy = labels.reduce((t, l) => t + (l.y - my) ** 2, 0);
    const b = vy > 0 ? labels.reduce((t, l) => t + (l.y - my) * (l.x - mx), 0) / vy : 0;
    if (Math.abs(b) < 0.1) tilt = b; // a column, not scattered labels
  }

  for (const label of labels) {
    const lh = Math.max(label.h, 6);
    for (const a of amounts) {
      if (a.t.page !== label.page || a.t === label) continue;
      const dx = a.t.x - (label.x + label.w);
      const dy = a.t.y - label.y + tilt * (a.t.x - label.x);
      // A Notice of Assessment is a table (line, description, amount): the amount sits at the far right of the row.
      const reach = type === 'NOA' ? lh * 80 : lh * 25;
      const sameRow = Math.abs(dy) <= lh * 0.9 && dx >= -2 && dx <= reach;
      const below = type !== 'NOA' && dy > 0 && dy <= lh * 3.2 && a.t.x >= label.x - lh * 1.5 && a.t.x <= label.x + lh * 18;
      if (!sameRow && !below) continue;
      const score = type === 'NOA' ? Math.abs(dy) * 10 + dx * 0.01 : sameRow ? dx : dy * 4 + Math.abs(a.t.x - label.x) * 0.5;
      cands.push({ label, amount: a.t, value: a.value, score });
    }
  }

  cands.sort((p, q) => p.score - q.score);
  const usedLabel = new Set<Token>();
  const usedAmount = new Set<Token>();
  const out: Record<string, BoxRead> = {};
  for (const c of cands) {
    if (usedLabel.has(c.label) || usedAmount.has(c.amount)) continue;
    const box = boxKey(type, norm(c.label.text));
    usedLabel.add(c.label); usedAmount.add(c.amount);
    if (out[box]) continue; // keep the first (closest) read; later copies of the slip repeat it
    out[box] = {
      value: c.value, source, confidence: source === 'ocr' ? 0.7 : 0.85, page: c.amount.page,
      rect: [Math.min(c.label.x, c.amount.x), Math.min(c.label.y, c.amount.y),
        Math.max(c.label.x + c.label.w, c.amount.x + c.amount.w) - Math.min(c.label.x, c.amount.x),
        Math.max(c.label.h, c.amount.h) + Math.abs(c.amount.y - c.label.y)],
      raw: c.amount.text,
    };
  }
  return out;
}

/** Catalog key for a printed box number (T4A boxes are 3-digit with leading zeros). */
function boxKey(type: SlipType, printed: string): string {
  if (type === 'NOA') return printed;
  const match = SLIPS[type].boxes.find((b) => b.box.replace(/^0+(?=\d)/, '') === printed);
  return match ? match.box : printed;
}
