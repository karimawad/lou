import { SLIPS, type SlipType } from '../tax/slips';
import type { BoxRead } from './types';

/** Keeps only boxes that hold money on this slip type, normalizing T4A's 3-digit numbers. */
export function keepCatalogBoxes(type: SlipType | null, boxes: Record<string, BoxRead>): Record<string, BoxRead> {
  if (!type || type === 'NOA') return boxes;
  const out: Record<string, BoxRead> = {};
  for (const [box, read] of Object.entries(boxes)) {
    const def = SLIPS[type].boxes.find((b) => b.box === box || b.box.replace(/^0+(?=\d)/, '') === box.replace(/^0+(?=\d)/, ''));
    if (def) out[def.box] = read;
  }
  return out;
}
