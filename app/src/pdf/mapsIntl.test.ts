import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { F3520, F3520_7B, F3520A, F8621, f8949Map, schDMap } from './mapsIntl';

// Every mapped name must exist in that year's official PDF with the right kind of field, and
// line fields must sit next to the printed line number (research/fields/<year>/*.tsv).
const PUBLIC = resolve(__dirname, '../../public/forms');
const FIELDS = resolve(__dirname, '../../../research/fields');

async function fieldKinds(year: number, file: string) {
  const doc = await PDFDocument.load(readFileSync(`${PUBLIC}/${year}/${file}`));
  return new Map(doc.getForm().getFields().map((f) => [f.getName(), f instanceof PDFCheckBox ? 'check' : f instanceof PDFTextField ? 'text' : 'other']));
}
function printed(year: number, file: string) {
  const m = new Map<string, string>();
  for (const row of readFileSync(`${FIELDS}/${year}/${file.replace('.pdf', '.tsv')}`, 'utf8').split('\n')) {
    const c = row.split('\t');
    if (c.length > 5) m.set(c[2], c[5]);
  }
  return m;
}
const short = (n: string) => n.replace('topmostSubform[0].', '');
const all = (o: unknown): string[] => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(all) : o && typeof o === 'object' ? Object.values(o).flatMap(all) : []);

describe.each([2025, 2024, 2023] as const)('international and capital forms (%i)', (year) => {
  it('Schedule D fields exist and match printed line numbers', async () => {
    const m = schDMap(year);
    const kinds = await fieldKinds(year, m.file);
    for (const n of [...Object.values(m.lines), ...Object.values(m.text)]) expect(kinds.get(n), n).toBe('text');
    for (const [n] of Object.values(m.checks)) expect(kinds.get(n), n).toBe('check');
    const p = printed(year, m.file);
    for (const k of ['6', '7', '11', '13', '14', '15', '16', '18', '19', '21']) expect(p.get(short(m.lines[k])), k).toBe(k);
  });
  it('Form 8949 rows, boxes and totals exist', async () => {
    const m = f8949Map(year);
    const kinds = await fieldKinds(year, m.file);
    for (const part of m.parts) {
      expect(kinds.get(part.box), part.box).toBe('check');
      for (const n of [part.name, part.ssn, ...part.rows.flat(), ...Object.values(part.totals)]) expect(kinds.get(n), n).toBe('text');
    }
    expect(m.parts[0].rows).toHaveLength(year === 2025 ? 11 : 14);
  });
  it('Form 8621 fields exist and match printed line numbers', async () => {
    const kinds = await fieldKinds(year, F8621.file);
    for (const n of [...Object.values(F8621.lines), ...Object.values(F8621.text)]) expect(kinds.get(n), n).toBe('text');
    for (const [n] of Object.values(F8621.checks)) expect(kinds.get(n), n).toBe('check');
    const p = printed(2025, F8621.file);
    for (const [k, n] of Object.entries(F8621.lines)) { const label = p.get(short(n)); if (label) expect(label, k).toBe(k); }
  });
  it('Forms 3520 and 3520-A fields exist', async () => {
    const k3520 = await fieldKinds(year, F3520.file);
    const texts = [...Object.values(F3520.lines), ...Object.values(F3520.text), ...F3520.line13, ...F3520.line16, ...F3520.line20, ...F3520.line24, ...F3520_7B,
      F3520.line15[0], F3520.line15[1], F3520.line15[3]];
    for (const n of texts) expect(k3520.get(n), n).toBe('text');
    for (const n of [...Object.values(F3520.checks).map((c) => c[0]), F3520.line15[2], ...F3520.line18.flatMap((x) => [x.yes, x.no])]) expect(k3520.get(n), n).toBe('check');
    const kA = await fieldKinds(year, F3520A.file);
    const checks = new Set([F3520A.page1.substitute, F3520A.page1.agentNo, ...F3520A.page1.docs.flatMap((d) => [d.yes, d.no]), F3520A.owner.agentNo,
      F3520A.beneficiary.agentNo, F3520A.beneficiary.inspectYes, F3520A.beneficiary.ownerIndividual]);
    for (const n of all(F3520A).filter((n) => n.includes('[0]'))) expect(kA.get(n), n).toBe(checks.has(n) ? 'check' : 'text');
  });
});
