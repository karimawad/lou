// Reads values straight out of fillable-PDF form fields (CRA slips and many
// payroll/bank exports). Field names carry the box number ("...Box14[0]..." or, on the T4A, "...Line16[0]...").

import { parseAmount } from './amount';
import type { BoxRead } from './types';

export interface FieldValue {
  name: string;
  value: string;
  page: number;
  /** Top-left-origin rect in page units. */
  rect: [number, number, number, number];
}

/** Groups by slip copy ("Slip1", "Slip2"); returns one box map per distinct copy. */
export function boxesFromFields(fields: FieldValue[]): { boxes: Record<string, BoxRead>; payer?: string; year?: number }[] {
  const groups = new Map<string, FieldValue[]>();
  for (const f of fields) {
    const key = `${f.page}:${f.name.match(/Slip(\d+)\[/)?.[1] ?? '1'}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  const results: { boxes: Record<string, BoxRead>; payer?: string; year?: number }[] = [];
  const seen = new Set<string>();
  for (const group of groups.values()) {
    const boxes: Record<string, BoxRead> = {};
    let payer: string | undefined;
    let year: number | undefined;
    const read = (f: FieldValue, box: string) => {
      const v = parseAmount(f.value);
      if (v === null || v === 0) return;
      boxes[box] = { value: v, source: 'field', confidence: 1, page: f.page, rect: f.rect, raw: f.value };
    };

    // "Other information" pairs: a box-code field and an amount field, matched by position.
    const codeFields = group.filter((f) => /OtherInformation/i.test(f.name) && /Box\d*\[/i.test(f.name.split('.').pop() ?? ''));
    const amountFields = group.filter((f) => /OtherInformation/i.test(f.name) && /Amount/i.test(f.name));
    for (const code of codeFields) {
      const box = code.value.trim().replace(/^0+(?=\d)/, '');
      if (!box) continue;
      const amount = amountFields
        .filter((a) => Math.abs(a.rect[1] - code.rect[1]) < 6 && a.rect[0] > code.rect[0])
        .sort((p, q) => p.rect[0] - q.rect[0])[0];
      if (amount) read(amount, box);
    }

    for (const f of group) {
      if (/OtherInformation/i.test(f.name)) continue;
      const last = f.name.split('.').slice(-2).join('.');
      if (/PayersName|EmployersName|PayerName|Payer\b/i.test(last) && f.value.trim()) payer ??= f.value.split('\n')[0].trim();
      if (/Year/i.test(last) && /^20\d\d$/.test(f.value.trim())) year = Number(f.value.trim());
      // Most CRA slips name amount fields "Box14"; the T4A uses "Line16" (box 016).
      const m = last.match(/(?:Box|Line)(\d{2,3}[A-Z]?)\[/i);
      if (m) read(f, m[1].toUpperCase()); // non-money boxes are dropped against the catalog later
    }

    if (!Object.keys(boxes).length) continue;
    const sig = JSON.stringify(Object.entries(boxes).map(([k, v]) => [k, v.value]).sort());
    if (seen.has(sig)) continue; // second printed copy of the same slip
    seen.add(sig);
    results.push({ boxes, payer, year });
  }
  return results;
}
