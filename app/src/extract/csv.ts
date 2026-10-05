// CSV import. Lou's template: one row per box.
//   slip,box,amount,payer,year,owner
//   T4,14,"100,000.00",Maple Co,2025,taxpayer
// Headers are matched loosely (case, spaces, French labels).

import type { SlipType } from '../tax/slips';
import { parseAmount } from './amount';
import { keepCatalogBoxes } from './catalog';
import type { ExtractedSlip } from './types';

export const CSV_TEMPLATE = 'slip,box,amount,payer,year,owner\nT4,14,100000.00,Maple Co,2025,taxpayer\nT4,22,22000.00,Maple Co,2025,taxpayer\nT5,13,1000.00,RBC,2025,taxpayer\n';

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const HEADER: Record<string, RegExp> = {
  slip: /^(slip|form|feuillet|type)$/i,
  box: /^(box|case|line|ligne)$/i,
  amount: /^(amount|montant|value|valeur)$/i,
  payer: /^(payer|issuer|employer|payeur|employeur)$/i,
  year: /^(year|ann[ée]e)$/i,
  owner: /^(owner|person|whose)$/i,
};

const SLIP_ALIASES: Record<string, SlipType> = {
  T4: 'T4', T4A: 'T4A', T5: 'T5', T3: 'T3', T5008: 'T5008', T4RSP: 'T4RSP', T4RIF: 'T4RIF', T4E: 'T4E',
  'T4A(P)': 'T4AP', T4AP: 'T4AP', 'T4A(OAS)': 'T4AOAS', T4AOAS: 'T4AOAS', T5007: 'T5007', NOA: 'NOA',
};

export interface CsvResult { slips: (ExtractedSlip & { owner?: 'taxpayer' | 'spouse' })[]; errors: string[] }

export function slipsFromCsv(text: string): CsvResult {
  const rows = parseCsvRows(text);
  const errors: string[] = [];
  if (!rows.length) return { slips: [], errors: ['The file is empty.'] };
  const header = rows[0].map((h) => h.trim());
  const col: Partial<Record<keyof typeof HEADER, number>> = {};
  for (const [key, re] of Object.entries(HEADER)) {
    const i = header.findIndex((h) => re.test(h));
    if (i >= 0) col[key as keyof typeof HEADER] = i;
  }
  if (col.slip === undefined || col.box === undefined || col.amount === undefined) {
    return { slips: [], errors: ['Lou needs at least three columns: slip, box and amount. Download the template to see the layout.'] };
  }

  const groups = new Map<string, CsvResult['slips'][number]>();
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const slipRaw = (r[col.slip!] ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const type = SLIP_ALIASES[slipRaw];
    if (!type) { errors.push(`Row ${line}: "${r[col.slip!]}" isn't a slip Lou knows.`); return; }
    const box = (r[col.box!] ?? '').trim().replace(/^(box|case)\s*/i, '');
    const value = parseAmount(r[col.amount!] ?? '');
    if (value === null) { errors.push(`Row ${line}: "${r[col.amount!]}" isn't an amount.`); return; }
    const payer = col.payer !== undefined ? r[col.payer]?.trim() : undefined;
    const year = col.year !== undefined ? Number(r[col.year]) || undefined : undefined;
    const ownerRaw = col.owner !== undefined ? r[col.owner]?.trim().toLowerCase() : '';
    const owner = ownerRaw === 'spouse' ? 'spouse' : 'taxpayer';
    const key = `${type}|${payer ?? ''}|${year ?? ''}|${owner}`;
    const g = groups.get(key) ?? { type, payer, year, owner, boxes: {}, evidence: ['CSV import'] };
    g.boxes[box] = { value, source: 'csv', confidence: 1, raw: r[col.amount!] };
    groups.set(key, g);
  });

  const slips = [...groups.values()].map((g) => {
    const kept = keepCatalogBoxes(g.type, g.boxes);
    for (const b of Object.keys(g.boxes)) {
      if (g.type && g.type !== 'NOA' && !Object.keys(kept).some((k) => k.replace(/^0+/, '') === b.replace(/^0+/, ''))) {
        errors.push(`${g.type} box ${b} isn't a money box Lou knows on that slip; it was skipped.`);
      }
    }
    return { ...g, boxes: g.type === 'NOA' ? g.boxes : kept };
  });
  return { slips, errors };
}
