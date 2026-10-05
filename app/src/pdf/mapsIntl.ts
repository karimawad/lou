// Field maps for Schedule D, Form 8949 (per year), and the non-annual forms Form 8621 (Rev. December 2025)
// and Forms 3520 / 3520-A (Rev. December 2023), which are the same PDF for 2023-2025.
// Built from research/fields/<year>/*.tsv and research/rects.mjs; maps.test.ts checks them.

import type { FormMap } from './maps2025';

const T = 'topmostSubform[0].';
const pg = (p: number, n: string) => `${T}Page${p}[0].${n}[0]`;

/** Schedule D: 2025 numbers fields f1_1.., 2023/2024 pad them (f1_01..) and mark some read-only. */
export function schDMap(year: 2023 | 2024 | 2025): FormMap {
  const pad = year === 2025 ? (n: number) => String(n) : (n: number) => String(n).padStart(2, '0');
  const f1 = (n: number) => pg(1, `f1_${pad(n)}`);
  const row = (part: 'PartI' | 'PartII', r: string, n: number) => `${T}Page1[0].Table_${part}[0].Row${r}[0].f1_${pad(n)}[0]`;
  return {
    file: 'f1040sd.pdf',
    lines: {
      '3d': row('PartI', '3', 15), '3e': row('PartI', '3', 16), '3h': row('PartI', '3', 18),
      '6': f1(21), '7': f1(22),
      '10d': row('PartII', '10', 35), '10e': row('PartII', '10', 36), '10h': row('PartII', '10', 38),
      '11': f1(39), '13': f1(41), '14': f1(42), '15': f1(43),
      '16': pg(2, `f2_${pad(1)}`), '18': pg(2, `f2_${pad(2)}`), '19': pg(2, `f2_${pad(3)}`),
      '21': year === 2025 ? pg(2, 'f2_4') : `${T}Page2[0].TagCorrectingSubform[0].f2_04[0]`,
    },
    text: { name: f1(1), ssn: f1(2) },
    checks: {
      qofNo: [`${T}Page1[0].c1_1[1]`, '2'],
      l17Yes: [`${T}Page2[0].c2_1[0]`, '1'], l17No: [`${T}Page2[0].c2_1[1]`, '2'],
      l20Yes: [`${T}Page2[0].c2_2[0]`, '1'], l20No: [`${T}Page2[0].c2_2[1]`, '2'],
      l22Yes: [`${T}Page2[0].c2_3[0]`, '1'], l22No: [`${T}Page2[0].c2_3[1]`, '2'],
    },
  };
}

export interface Form8949Map {
  file: string;
  /** [page 1 (short-term), page 2 (long-term)]: name, SSN, box C/F checkbox, rows of 8 fields (a-h), totals d, e, g, h. */
  parts: { name: string; ssn: string; box: string; rows: string[][]; totals: { d: string; e: string; g: string; h: string } }[];
}

/** Form 8949: 2025 has 11 rows per page and six boxes (C/F is the 3rd); 2023/2024 have 14 rows and three boxes. */
export function f8949Map(year: 2023 | 2024 | 2025): Form8949Map {
  const n25 = year === 2025;
  const rows = n25 ? 11 : 14;
  const pad = (n: number) => (n25 ? String(n).padStart(2, '0') : String(n));
  const part = (p: 1 | 2) => {
    const table = n25 ? `Table_Line1_Part${p}` : 'Table_Line1';
    const f = (n: number) => `f${p}_${pad(n)}`;
    const tot = n25 ? 91 : 115;
    return {
      name: pg(p, f(1)), ssn: pg(p, f(2)), box: `${T}Page${p}[0].c${p}_1[2]`,
      rows: Array.from({ length: rows }, (_, r) => Array.from({ length: 8 }, (_, c) => `${T}Page${p}[0].${table}[0].Row${r + 1}[0].${f(3 + r * 8 + c)}[0]`)),
      totals: { d: pg(p, f(tot)), e: pg(p, f(tot + 1)), g: pg(p, f(tot + 3)), h: pg(p, f(tot + 4)) },
    };
  };
  return { file: 'f8949.pdf', parts: [part(1), part(2)] };
}

/** Form 8621 (Rev. December 2025). */
export const F8621: FormMap = {
  file: 'f8621.pdf',
  lines: {
    '6a': pg(2, 'f2_1'), '6b': pg(2, 'f2_2'), '6c': pg(2, 'f2_3'), '7a': pg(2, 'f2_4'), '7b': pg(2, 'f2_5'), '7c': pg(2, 'f2_6'),
    '10a': pg(2, 'f2_15'), '10b': pg(2, 'f2_16'), '10c': pg(2, 'f2_17'), '11': pg(2, 'f2_18'), '12': pg(2, 'f2_19'),
    '13a': pg(2, 'f2_20'), '13b': pg(2, 'f2_21'), '13c': pg(2, 'f2_22'), '14a': pg(2, 'f2_23'), '14b': pg(2, 'f2_24'), '14c': pg(2, 'f2_25'),
    '15a': pg(3, 'f3_2'), '15b': pg(3, 'f3_3'), '15c': pg(3, 'f3_4'), '15d': pg(3, 'f3_5'), '15e(1)': pg(3, 'f3_6'), '15e(2)': pg(3, 'f3_7'), '15f': pg(3, 'f3_8'),
    '16b': pg(3, 'f3_9'), '16c': pg(3, 'f3_10'), '16d': pg(3, 'f3_11'), '16e': pg(3, 'f3_12'), '16f': pg(3, 'f3_13'),
  },
  text: {
    name: `${T}Page1[0].NameAddress[0].f1_1[0]`, street: `${T}Page1[0].NameAddress[0].f1_2[0]`, city: `${T}Page1[0].NameAddress[0].f1_4[0]`,
    province: `${T}Page1[0].NameAddress[0].f1_5[0]`, country: `${T}Page1[0].NameAddress[0].f1_6[0]`, postal: `${T}Page1[0].NameAddress[0].f1_7[0]`,
    ssn: pg(1, 'f1_8'), year: `${T}Page1[0].NameAddress[0].ShareholderTaxYear[0].f1_9[0]`,
    pficName: `${T}Page1[0].NameAddress2[0].f1_14[0]`, pficAddress: `${T}Page1[0].NameAddress2[0].f1_15[0]`, referenceId: pg(1, 'f1_17'),
    pficYear: `${T}Page1[0].TaxYearOfPFIC[0].f1_18[0]`,
    l1: pg(1, 'f1_23'), l2: pg(1, 'f1_24'), l3: pg(1, 'f1_25'), l4e: pg(1, 'f1_26'),
    l5a: pg(1, 'f1_27'), l5b: pg(1, 'f1_28'), l5c: pg(1, 'f1_29'), currency: pg(3, 'f3_1'),
  },
  checks: {
    individual: [`${T}Page1[0].c1_1[0]`, '1'], joint: [pg(1, 'c1_4'), '1'],
    v4a: [`${T}Page1[0].c1_5[0]`, '1'], v4b: [`${T}Page1[0].c1_5[1]`, '2'], v4c: [`${T}Page1[0].c1_5[2]`, '3'], v4d: [`${T}Page1[0].c1_5[3]`, '4'],
    t5a: [pg(1, 'c1_6'), '1'], t5b: [pg(1, 'c1_7'), '1'], t5c: [pg(1, 'c1_8'), '1'],
    electionC: [pg(1, 'c1_11'), '1'],
  },
};

/** Form 3520 (Rev. December 2023): identifying information, Part I (transfers), Part II (owner), Part III (distributions). */
export const F3520: FormMap & { line13: string[]; line15: string[]; line16: string[]; line20: string[]; line24: string[]; line18: { yes: string; no: string }[] } = {
  file: 'f3520.pdf',
  lines: { '23': pg(4, 'f4_19'), '24total': pg(4, 'f4_68'), '27': pg(4, 'f4_88'), '13totalF': `${T}Page2[0].Totals[0].f2_61[0]`, '13totalI': `${T}Page2[0].Totals[0].f2_62[0]` },
  text: {
    year: pg(1, 'f1_1'), name: pg(1, 'f1_6'), ssn: pg(1, 'f1_7'), street: pg(1, 'f1_8'), spouseSsn: pg(1, 'f1_9'),
    city: pg(1, 'f1_10'), province: pg(1, 'f1_11'), postal: pg(1, 'f1_12'), country: pg(1, 'f1_13'),
    trustName: pg(1, 'f1_15'), trustEin: pg(1, 'f1_16'), trustStreet: pg(1, 'f1_17'), trustCreated: pg(1, 'f1_18'),
    trustCity: pg(1, 'f1_19'), trustProvince: pg(1, 'f1_20'), trustPostal: pg(1, 'f1_21'), trustCountry: pg(1, 'f1_22'),
    creatorName: pg(2, 'f2_1'), creatorAddress: pg(2, 'f2_2'), creatorTin: pg(2, 'f2_3'),
    countryCreated: pg(2, 'f2_4'), countryLaw: pg(2, 'f2_5'), dateCreated: pg(2, 'f2_6'),
    country21a: pg(4, 'f4_16'), country21b: pg(4, 'f4_17'), date21c: pg(4, 'f4_18'),
  },
  checks: {
    individual: [`${T}Page1[0].c1_4[0]`, '1'], partI: [pg(1, 'c1_6'), '1'], partII: [pg(1, 'c1_7'), '1'], partIII: [pg(1, 'c1_8'), '1'],
    joint: [pg(1, 'c1_10'), '1'], abroad: [pg(1, 'c1_11'), '1'], agentNo: [`${T}Page1[0].c1_13[1]`, '2'],
    l7aYes: [`${T}Page2[0].c2_1[0]`, '1'], l8No: [`${T}Page2[0].c2_2[1]`, '2'], l9aYes: [`${T}Page2[0].c2_3[0]`, '1'],
    l11aNo: [`${T}Page2[0].c2_6[1]`, '2'], l13Yes: [`${T}Page2[0].c2_9[0]`, '1'], l22No: [`${T}Page4[0].c4_1[1]`, '2'],
  },
  line13: Array.from({ length: 9 }, (_, c) => `${T}Page2[0].Table_Line13[0].Row1[0].f2_${34 + c}[0]`),
  line15: [`${T}Page3[0].Table_Line15[0].Row1[0].f3_1[0]`, `${T}Page3[0].Table_Line15[0].Row1[0].f3_2[0]`, `${T}Page3[0].Table_Line15[0].Row1[0].c3_1[0]`, `${T}Page3[0].Table_Line15[0].Row1[0].f3_3[0]`],
  line16: [`${T}Page3[0].Table_Line16[0].Row1[0].f3_13[0]`, `${T}Page3[0].Table_Line16[0].Row1[0].f3_14[0]`, `${T}Page3[0].Table_Line16[0].Row1[0].f3_15[0]`],
  line20: Array.from({ length: 5 }, (_, c) => `${T}Page4[0].Table_Line20[0].Row1[0].f4_${1 + c}[0]`),
  line24: Array.from({ length: 6 }, (_, c) => `${T}Page4[0].Table_Line24[0].Row1[0].f4_${20 + c}[0]`),
  // Line 18 a-f: [Yes, No] checkboxes (the third box is "previously attached").
  line18: ['a', 'b', 'c', 'd', 'e', 'f'].map((l, i) => ({ yes: `${T}Page3[0].Table_Line18[0].Line18${l}[0].c3_${5 + i}[0]`, no: `${T}Page3[0].Table_Line18[0].Line18${l}[0].c3_${5 + i}[1]` })),
};

/** Line 7b row 1 (name, address, country of residence, TIN, Code section). */
export const F3520_7B = Array.from({ length: 5 }, (_, c) => `${T}Page2[0].Table_Line7b[0].Row1[0].f2_${7 + c}[0]`);

/** Form 3520-A (Rev. December 2023), filed by the US owner as a substitute. */
export const F3520A = {
  file: 'f3520a.pdf',
  page1: {
    year: pg(1, 'f1_01'), substitute: pg(1, 'c1_5'), trustName: pg(1, 'f1_06'), ein: pg(1, 'f1_07'), street: pg(1, 'f1_08'), created: pg(1, 'f1_09'),
    city: pg(1, 'f1_10'), province: pg(1, 'f1_11'), postal: pg(1, 'f1_12'), country: pg(1, 'f1_13'),
    agentNo: `${T}Page1[0].c1_7[1]`,
    docs: ['a', 'b', 'c', 'd', 'e'].map((l, i) => ({ yes: `${T}Page1[0].Table_Line2[0].Line2${l}[0].c1_${9 + i}[0]`, no: `${T}Page1[0].Table_Line2[0].Line2${l}[0].c1_${9 + i}[1]` })),
    trustee: pg(1, 'f1_31'), trusteeTin: pg(1, 'f1_32'), trusteeStreet: pg(1, 'f1_33'),
    trusteeCity: pg(1, 'f1_34'), trusteeProvince: pg(1, 'f1_35'), trusteePostal: pg(1, 'f1_36'), trusteeCountry: pg(1, 'f1_37'),
    ownerStatements: pg(1, 'f1_38'), beneficiaryStatements: pg(1, 'f1_39'), title: pg(1, 'f1_40'),
  },
  /** Part II income statement lines 1-17a. */
  income: Object.fromEntries(['1', '2', '3', '4', '5a', '5b', '6', '7', '8', '9', '10a', '10b', '11', '12', '13', '14', '15', '16', '17a']
    .map((l, i) => [l, pg(2, `f2_${String(i + 1).padStart(2, '0')}`)])) as Record<string, string>,
  line17b: Array.from({ length: 4 }, (_, c) => `${T}Page2[0].Table_Line17b[0].Row1[0].f2_${20 + c}[0]`),
  /** Part III balance sheet: [beginning (b), end (d)] for the lines Lou fills. */
  balance: {
    '1': [`${T}Page2[0].Table_Part3[0].Line1[0].f2_41[0]`, `${T}Page2[0].Table_Part3[0].Line1[0].f2_43[0]`],
    '6': [`${T}Page2[0].Table_Part3[0].Line6[0].f2_61[0]`, `${T}Page2[0].Table_Part3[0].Line6[0].f2_63[0]`],
    '11': [`${T}Page2[0].Table_Part3[0].Line11[0].f2_85[0]`, `${T}Page2[0].Table_Part3[0].Line11[0].f2_87[0]`],
    '17': [`${T}Page2[0].Table_Part3[0].Line17[0].f2_109[0]`, `${T}Page2[0].Table_Part3[0].Line17[0].f2_111[0]`],
    '20': [`${T}Page2[0].Table_Part3[0].Line20[0].f2_121[0]`, `${T}Page2[0].Table_Part3[0].Line20[0].f2_123[0]`],
    '21': [`${T}Page2[0].Table_Part3[0].Line21[0].f2_125[0]`, `${T}Page2[0].Table_Part3[0].Line21[0].f2_127[0]`],
  } as Record<string, [string, string]>,
  owner: {
    year: pg(3, 'f3_01'), trustName: pg(3, 'f3_02'), ein: pg(3, 'f3_03'), street: pg(3, 'f3_04'), created: pg(3, 'f3_05'),
    city: pg(3, 'f3_06'), province: pg(3, 'f3_07'), postal: pg(3, 'f3_08'), country: pg(3, 'f3_09'), agentNo: `${T}Page3[0].c3_1[1]`,
    trustee: pg(3, 'f3_17'), trusteeTin: pg(3, 'f3_18'), trusteeStreet: pg(3, 'f3_19'),
    trusteeCity: pg(3, 'f3_20'), trusteeProvince: pg(3, 'f3_21'), trusteePostal: pg(3, 'f3_22'), trusteeCountry: pg(3, 'f3_23'),
    taxYear: pg(3, 'f3_24'), ownerName: pg(3, 'f3_25'), ownerTin: pg(3, 'f3_26'), ownerStreet: pg(3, 'f3_27'),
    ownerCity: pg(3, 'f3_28'), ownerProvince: pg(3, 'f3_29'), ownerPostal: pg(3, 'f3_30'), ownerCountry: pg(3, 'f3_31'),
    docs1: pg(3, 'f3_32'), docs2: pg(3, 'f3_33'), value: pg(3, 'f3_34'),
    line10: Array.from({ length: 6 }, (_, c) => `${T}Page3[0].Table_Line10[0].Row1[0].f3_${35 + c}[0]`), line10total: pg(3, 'f3_82'),
  },
  /** Page 4: income attributable to the US owner. */
  ownerIncome: Object.fromEntries([['year', 'f4_01'], ['1a', 'f4_02'], ['1b', 'f4_03'], ['2a', 'f4_04'], ['2b', 'f4_05'], ['3', 'f4_06'], ['4', 'f4_07'],
    ['5', 'f4_08'], ['6', 'f4_09'], ['7', 'f4_10'], ['8', 'f4_11'], ['15', 'f4_19'], ['title', 'f4_20']].map(([k, n]) => [k, pg(4, n)])) as Record<string, string>,
  beneficiary: {
    year: pg(5, 'f5_01'), trustName: pg(5, 'f5_02'), ein: pg(5, 'f5_03'), street: pg(5, 'f5_04'), created: pg(5, 'f5_05'),
    city: pg(5, 'f5_06'), province: pg(5, 'f5_07'), postal: pg(5, 'f5_08'), country: pg(5, 'f5_09'), agentNo: `${T}Page5[0].c5_1[1]`, inspectYes: `${T}Page5[0].c5_2[0]`,
    trustee: pg(5, 'f5_17'), trusteeTin: pg(5, 'f5_18'), trusteeStreet: pg(5, 'f5_19'),
    trusteeCity: pg(5, 'f5_20'), trusteeProvince: pg(5, 'f5_21'), trusteePostal: pg(5, 'f5_22'), trusteeCountry: pg(5, 'f5_23'),
    taxYear: pg(5, 'f5_24'), name: pg(5, 'f5_25'), tin: pg(5, 'f5_26'), street2: pg(5, 'f5_27'),
    bCity: pg(5, 'f5_28'), bProvince: pg(5, 'f5_29'), bPostal: pg(5, 'f5_30'), bCountry: pg(5, 'f5_31'),
    line7: Array.from({ length: 6 }, (_, c) => `${T}Page5[0].Table_Line7[0].Row1[0].f5_${32 + c}[0]`), line7total: pg(5, 'f5_80'),
    ownerIndividual: `${T}Page5[0].c5_3[0]`, title: pg(5, 'f5_81'),
  },
};
