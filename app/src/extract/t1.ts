// Reads the T1 Income Tax and Benefit Return (CRA form 5006-R) that tax software exports as a PDF,
// e.g. Wealthsimple Tax. Its line numbers are the same ones Lou reads from a Notice of Assessment,
// so the result is an 'NOA'-type record. Two layouts:
//  - the CRA fillable PDF: one field per line, named "...Line_15000_Amount[0]";
//  - a flattened export: the line number sits in its box, and the amount follows on the same row
//    as separate dollars and cents ("188,758" "86"), sometimes with watermark words in between.

import { parseAmount } from './amount';
import type { FieldValue } from './fields';
import { NOA_LINES } from './layout';
import type { BoxRead, Token } from './types';

/** True when the text is a T1 return (any page), English or French. */
export function isT1Return(text: string): boolean {
  return /5006-R/.test(text) && /Income Tax and Benefit Return|D[ée]claration de revenus et de prestations/i.test(text);
}

/** Tax year of a T1 return: "T1 2025" in the header, or the form code "5006-R E (25)". */
export function t1Year(text: string): number | undefined {
  const m = text.match(/\bT1[\s-]?(20[1-3]\d)\b/) ?? text.match(/5006-R\s*[EF]?\s*\((\d{2})\)/);
  if (!m) return undefined;
  return m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
}

/** Income lines Lou takes from a T1 when there is no slip for them (state/t1.ts decides how each is used). */
export const T1_INCOME_LINES: { box: string; label: string }[] = [
  { box: '10100', label: 'Employment income' },
  { box: '10400', label: 'Other employment income' },
  { box: '11300', label: 'Old age security pension' },
  { box: '11400', label: 'CPP or QPP benefits' },
  { box: '11500', label: 'Other pensions and superannuation' },
  { box: '11600', label: 'Elected split-pension amount' },
  { box: '11700', label: 'Universal child care benefit' },
  { box: '11900', label: 'Employment insurance benefits' },
  { box: '12000', label: 'Taxable amount of dividends' },
  { box: '12010', label: 'Taxable amount of dividends other than eligible' },
  { box: '12100', label: 'Interest and other investment income' },
  { box: '12200', label: 'Net partnership income' },
  { box: '12500', label: 'RDSP income' },
  { box: '12600', label: 'Net rental income' },
  { box: '12700', label: 'Taxable capital gains' },
  { box: '12800', label: 'Support payments received (taxable)' },
  { box: '12900', label: 'RRSP income' },
  { box: '12905', label: 'Taxable FHSA income' },
  { box: '12906', label: 'Taxable FHSA income, other' },
  { box: '13000', label: 'Other income' },
  { box: '13010', label: 'Taxable scholarships and grants' },
  { box: '13500', label: 'Net business income' },
  { box: '13700', label: 'Net professional income' },
  { box: '13900', label: 'Net commission income' },
  { box: '14100', label: 'Net farming income' },
  { box: '14300', label: 'Net fishing income' },
  { box: '14400', label: "Workers' compensation benefits" },
  { box: '14500', label: 'Social assistance payments' },
  { box: '14600', label: 'Net federal supplements' },
];

const LINES = new Set<string>([...NOA_LINES, ...T1_INCOME_LINES.map((l) => l.box)]);

/** CRA fillable T1: "form1[0].Page3[0].Line15000[0].Line_15000_Amount[0]". The spouse's net income on page 1 has another name. */
export function t1FromFields(fields: FieldValue[]): Record<string, BoxRead> {
  const out: Record<string, BoxRead> = {};
  for (const f of fields) {
    const line = f.name.match(/Line_(\d{5})_Amount\[/)?.[1];
    if (!line || !LINES.has(line) || out[line]) continue;
    const value = parseAmount(f.value);
    if (value === null) continue;
    out[line] = { value, source: 'field', confidence: 1, page: f.page, rect: f.rect, raw: f.value };
  }
  return out;
}

const DOLLARS = /^-?\d{1,3}(?:,\d{3})*$|^-?\d+$/;
const CENTS = /^\d{2}$/;
const OPERATOR = /^[=+\-–•]$/;

/**
 * Flattened T1: for each line number Lou needs, the first place on a 5006-R page where the number is
 * followed on its row by a dollars token and a two-digit cents token right next to it. Words in
 * between (operators, a "DUPLICATA" watermark) are skipped; any other number in between disqualifies
 * the row, so "line 23600 × 3%" style references can't be misread.
 */
export function t1FromText(tokens: Token[]): Record<string, BoxRead> {
  const formPages = new Set(tokens.filter((t) => /^5006-R/.test(t.text)).map((t) => t.page));
  const out: Record<string, BoxRead> = {};
  const labels = tokens
    .filter((t) => LINES.has(t.text) && formPages.has(t.page))
    .sort((a, b) => a.page - b.page || a.y - b.y);
  for (const label of labels) {
    if (out[label.text]) continue;
    const mid = label.y + label.h / 2;
    const sameRow = tokens.filter((t) => t.page === label.page && Math.abs(t.y + t.h / 2 - mid) < label.h * 0.6);
    // Page 1 repeats the spouse's lines ("Net income from line 23600 of their return"): never read those as the filer's.
    if (sameRow.some((t) => /^(their|leur)$/i.test(t.text))) continue;
    const row = sameRow.filter((t) => t.x > label.x + label.w / 2).sort((a, b) => a.x - b.x);
    for (let i = 0; i < row.length; i++) {
      const t = row[i];
      if (OPERATOR.test(t.text) || /^[A-Za-zÀ-ÿ]+$/.test(t.text)) continue;
      const cents = row[i + 1];
      if (!DOLLARS.test(t.text) || !cents || !CENTS.test(cents.text) || cents.x - (t.x + t.w) > label.h * 4) break;
      const value = Number(`${t.text.replace(/,/g, '')}.${cents.text}`);
      out[label.text] = {
        value, source: 'text', confidence: 0.9, page: label.page,
        rect: [label.x, Math.min(label.y, t.y), cents.x + cents.w - label.x, Math.max(label.h, t.h)],
        raw: `${t.text} ${cents.text}`,
      };
      break;
    }
  }
  return out;
}
