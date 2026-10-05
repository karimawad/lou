import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORMS_2025, SCHB_2025, type FormMap } from './maps2025';
import { MAPS_2023, MAPS_2024 } from './mapsPrior';
import { f1040Line } from '../screens/lines';

// research/fields/2025/*.tsv lists every field with the line number printed
// beside it on the official PDF (dumpfields.mjs). Every mapped line must agree
// with that printed number whenever the dump detected one. This caught a real
// Schedule 2 line 12/13 mix-up during development.
const FIELDS = resolve(__dirname, '../../../research/fields');

function load(file: string, year = 2025) {
  const byName = new Map<string, string>();
  for (const row of readFileSync(`${FIELDS}/${year}/${file.replace('.pdf', '.tsv')}`, 'utf8').split('\n')) {
    const c = row.split('\t');
    if (c.length > 5) byName.set(c[2], c[5]);
  }
  return byName;
}
const short = (name: string) => name.replace('topmostSubform[0].', '');

function check(m: Pick<FormMap, 'file' | 'lines' | 'text' | 'checks'>, year = 2025) {
  const fields = load(m.file, year);
  const misses: string[] = [];
  let compared = 0;
  for (const [line, name] of Object.entries(m.lines)) {
    const printed = fields.get(short(name));
    if (printed === undefined) { misses.push(`${line}: no such field ${name}`); continue; }
    if (printed === '' || !/^\d/.test(line)) continue; // no printed label nearby, or a non-line key
    compared++;
    const expected = m.file === 'f1040.pdf' ? f1040Line(year as 2023 | 2024 | 2025, line)
      : m.file === 'f1040s2.pdf' && year === 2023 && line === '2' ? '1'
      : m.file === 'f1040sc.pdf' && year < 2025 && (line === '27a' || line === '27b') ? (line === '27a' ? '27b' : '27a') : line;
    if (printed !== expected) misses.push(`${line}: field is printed as line ${printed}, expected ${expected}`);
  }
  for (const name of [...Object.values(m.text), ...Object.values(m.checks).map((c) => c[0])]) {
    if (!fields.has(short(name))) misses.push(`missing field ${name}`);
  }
  return { misses, compared };
}

describe('2025 PDF field maps agree with the official forms', () => {
  for (const [key, m] of Object.entries(FORMS_2025)) {
    it(key, () => {
      const { misses, compared } = check(m);
      expect(misses).toEqual([]);
      if (Object.keys(m.lines).length) expect(compared).toBeGreaterThan(0);
    });
  }
  it('SCHB_2025', () => {
    const m = { file: SCHB_2025.file, ...SCHB_2025.map };
    expect(check(m).misses).toEqual([]);
    const fields = load(SCHB_2025.file);
    for (const [a, b] of [...SCHB_2025.interestRows, ...SCHB_2025.dividendRows]) {
      expect(fields.has(short(a)), a).toBe(true);
      expect(fields.has(short(b)), b).toBe(true);
    }
  });
});

describe('2024 and 2023 PDF field maps agree with the official forms', () => {
  for (const [year, maps] of [[2024, MAPS_2024], [2023, MAPS_2023]] as const) {
    for (const key of ['F1040', 'SCH1', 'SCH2', 'SCH3', 'SCH8812', 'F1116', 'F2555', 'F6251', 'SCHC', 'F4562'] as const) {
      it(`${year} ${key}`, () => {
        const { misses, compared } = check(maps[key], year);
        expect(misses).toEqual([]);
        expect(compared).toBeGreaterThan(0);
      });
    }
    it(`${year} SCHB`, () => {
      expect(check({ file: maps.SCHB.file, ...maps.SCHB.map }, year).misses).toEqual([]);
    });
  }
});
