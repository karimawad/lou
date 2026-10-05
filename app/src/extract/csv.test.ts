import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, parseCsvRows, slipsFromCsv } from './csv';

describe('CSV import', () => {
  it('parses quoted fields with commas', () => {
    expect(parseCsvRows('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
  });
  it('reads the Lou template into slips grouped by payer', () => {
    const r = slipsFromCsv(CSV_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.slips).toHaveLength(2);
    const t4 = r.slips.find((s) => s.type === 'T4')!;
    expect(t4.payer).toBe('Maple Co');
    expect(t4.boxes['14'].value).toBe(100000);
    expect(t4.boxes['22'].value).toBe(22000);
  });
  it('accepts French headers and amounts, and T4A three-digit boxes', () => {
    const r = slipsFromCsv('Feuillet;Case;Montant\nT4A;16;"12 500,00"\n');
    expect(r.errors).toEqual([]);
    expect(r.slips[0].boxes['016'].value).toBe(12500);
  });
  it('explains what is wrong instead of guessing', () => {
    expect(slipsFromCsv('a,b\n1,2').errors[0]).toMatch(/slip, box and amount/);
    const r = slipsFromCsv('slip,box,amount\nT9,14,5\nT4,14,abc\nT4,99,10');
    expect(r.errors).toHaveLength(3);
  });
});
