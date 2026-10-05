import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAmount } from './amount';
import { detectSlipType } from './detect';
import { extractPdf } from './index';

// Fixtures: official CRA fillable slips filled by research/make_slip_fixtures.py (fillable + flattened copies).
const FIX = resolve(__dirname, '__fixtures__');
const fixture = (name: string) => new Uint8Array(readFileSync(`${FIX}/${name}`));

describe('parseAmount', () => {
  it.each([
    ['100,000.00', 100000], ['100 000,00', 100000], ['1.234,56', 1234.56], ['$1,234.56', 1234.56],
    ['1234.5', 1234.5], ['(12.00)', -12], ['22000', 22000], ['abc', null], ['12-34', null],
  ])('%s', (s, v) => expect(parseAmount(s)).toBe(v));
});

describe('detectSlipType', () => {
  it.each([
    ['T4 Statement of Remuneration Paid', 'T4'], ['T5 Statement of Investment Income', 'T5'],
    ['T4RSP Statement of RRSP Income', 'T4RSP'], ['T4A(P) Statement of Canada Pension Plan Benefits', 'T4AP'],
    ['Notice of Assessment 2025', 'NOA'], ['État des revenus de placement T5', 'T5'],
  ])('%s', (s, t) => expect(detectSlipType(s).type).toBe(t));
});

describe('reads an official CRA T4', () => {
  it('from form fields (fillable PDF)', async () => {
    const r = await extractPdf(fixture('t4-2025-fillable.pdf'));
    expect(r.method).toBe('fields');
    expect(r.slips).toHaveLength(1);
    const s = r.slips[0];
    expect(s.type).toBe('T4');
    expect(s.year).toBe(2025);
    expect(s.payer).toBe('Maple Co');
    expect(Object.fromEntries(Object.entries(s.boxes).map(([k, v]) => [k, v.value]))).toEqual({
      '14': 100000, '22': 22000, '16': 4034.1, '18': 1077.48, '20': 5000, '44': 650,
    });
  }, 30000);

  it('from the text layer (flattened PDF)', async () => {
    const r = await extractPdf(fixture('t4-2025-flat.pdf'));
    expect(r.method).toBe('text');
    const s = r.slips[0];
    expect(s.type).toBe('T4');
    const got = Object.fromEntries(Object.entries(s.boxes).map(([k, v]) => [k, v.value]));
    expect(got).toEqual({ '14': 100000, '22': 22000, '16': 4034.1, '18': 1077.48, '20': 5000, '44': 650 });
  }, 30000);
});

describe('reads an official CRA T5', () => {
  it('from form fields', async () => {
    const r = await extractPdf(fixture('t5-2025-fillable.pdf'));
    expect(r.slips[0].type).toBe('T5');
    expect(Object.fromEntries(Object.entries(r.slips[0].boxes).map(([k, v]) => [k, v.value])))
      .toEqual({ '13': 1000, '24': 2000, '25': 2760, '26': 414.55 });
  }, 30000);
  it('from the text layer', async () => {
    const r = await extractPdf(fixture('t5-2025-flat.pdf'));
    expect(Object.fromEntries(Object.entries(r.slips[0].boxes).map(([k, v]) => [k, v.value])))
      .toEqual({ '13': 1000, '24': 2000, '25': 2760, '26': 414.55 });
  }, 30000);
});

describe('reads an official CRA T4A (amount fields named "Line16"; box 028 in Other information)', () => {
  const expected = { '016': 24000, '022': 4800, '024': 1200, '028': 350 };
  it('from form fields', async () => {
    const r = await extractPdf(fixture('t4a-2025-fillable.pdf'));
    expect(r.method).toBe('fields');
    expect(r.slips[0].type).toBe('T4A');
    expect(r.slips[0].payer).toBe('Pine Pension Plan');
    expect(Object.fromEntries(Object.entries(r.slips[0].boxes).map(([k, v]) => [k, v.value]))).toEqual(expected);
  }, 30000);
  it('from the text layer', async () => {
    const r = await extractPdf(fixture('t4a-2025-flat.pdf'));
    expect(r.method).toBe('text');
    expect(Object.fromEntries(Object.entries(r.slips[0].boxes).map(([k, v]) => [k, v.value]))).toEqual(expected);
  }, 30000);
});

describe('reads a Notice of Assessment (CRA summary layout)', () => {
  it('from the text layer: T1 line numbers paired with their amounts', async () => {
    const r = await extractPdf(fixture('noa-2025.pdf'));
    expect(r.slips[0].type).toBe('NOA');
    expect(r.slips[0].year).toBe(2025);
    expect(Object.fromEntries(Object.entries(r.slips[0].boxes).map(([k, v]) => [k, v.value]))).toEqual({
      '15000': 103760, '23600': 103760, '26000': 103760, '42000': 13000, '42800': 7000, '43500': 20000, '43700': 22000,
    });
  }, 30000);
});

// Made-up T1 returns from the official CRA 5006-R (research/make_t1_fixture.py): the fillable form, and a
// flattened copy laid out like a Wealthsimple Tax export (dollars and cents apart, watermark words on rows).
describe('reads a T1 return exported by tax software', () => {
  const T1 = {
    '15000': 91987.42, '23600': 95000.12, '26000': 95000.12, '42000': 11234.56, '42800': 5432.1, '43700': 17000,
    '10100': 90000, '12000': 1495, '12010': 115, '12100': 39.42, '12900': 453,
  };
  const values = (boxes: Record<string, { value: number }>) => Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, v.value]));
  it.each([['t1-2025-fillable.pdf', 'fields'], ['t1-2025-flat.pdf', 'text']])('%s', async (file, method) => {
    const r = await extractPdf(fixture(file));
    expect(r.method).toBe(method);
    expect(r.slips).toHaveLength(1);
    expect(r.slips[0]).toMatchObject({ type: 'NOA', year: 2025, payer: 'T1 return' });
    expect(values(r.slips[0].boxes)).toEqual(T1); // not the spouse's 55,555.55 net income from page 1
  }, 60000);
  it('is not mistaken for a slip it mentions (line 11300 names the T4A(OAS))', () => {
    expect(detectSlipType('5006-R E (25)\nIncome Tax and Benefit Return\nOld age security (OAS) pension (box 18 of the T4A(OAS) slip) 11300').type).toBe('NOA');
  });
});
