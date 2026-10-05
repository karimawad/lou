// Field maps for the official 2024 and 2023 IRS PDFs (research/irs-pdfs/<year>), built
// from research/fields/<year>/*.tsv. Keys use the engine's 2025 line numbering; on these
// forms '7a' is line 7, '11a' is line 11, '12e' is line 12 and '13a' is line 13 (2023/2024
// have no 11b or 13b). maps.test.ts checks every key against the printed line number.
// Form 2555, Schedule B (Form 1116), Form 8833 and Form 8938 are unchanged across these
// years, so the 2025 maps are reused.

import {
  F2555_2025, F2555_TRIPS_2025, F8833, F8833_EXPLANATION, F8938, F8938_PART3, SCH1116B, SCH1116B_GRID, SCHB_2025, f6251Map, schCMap, f4562Map,
  type FormMap,
} from './maps2025';

const T = 'topmostSubform[0].';
const t1 = (n: string) => `${T}Page1[0].${n}[0]`;
const t2 = (n: string) => `${T}Page2[0].${n}[0]`;
const f1 = (n: string) => `form1[0].Page1[0].${n}[0]`;
const f2 = (n: string) => `form1[0].Page2[0].${n}[0]`;

export interface YearMaps {
  F1040: FormMap; SCH1: FormMap; SCH2: FormMap; SCH3: FormMap; SCH8812: FormMap; F1116: FormMap;
  SCHB: typeof SCHB_2025;
  F2555: FormMap; F2555_TRIPS: string[][]; SCH1116B: FormMap; SCH1116B_GRID: typeof SCH1116B_GRID;
  F8833: FormMap; F8833_EXPLANATION: string[]; F8938: FormMap; F8938_PART3: Record<string, string[]>;
  F6251: FormMap;
  SCHC: FormMap;
  F4562: ReturnType<typeof f4562Map>;
}

/** Form 1040 page 1 lines 1a-15 and page 2 lines 16-38 for 2024 (n = field number of line 1a). */
function f1040Lines(first: number): Record<string, string> {
  const r = `${T}Page1[0].Line4a-11_ReadOrder[0]`;
  const n = (k: number) => `f1_${first + k}`;
  return {
    '1a': t1(n(0)), '1h': t1(n(7)), '1z': t1(n(9)), '2a': t1(n(10)), '2b': t1(n(11)), '3a': t1(n(12)), '3b': t1(n(13)),
    '4a': `${r}.${n(14)}[0]`, '4b': `${r}.${n(15)}[0]`, '5a': `${r}.${n(16)}[0]`, '5b': `${r}.${n(17)}[0]`,
    '6a': `${r}.${n(18)}[0]`, '6b': `${r}.${n(19)}[0]`, '7a': `${r}.${n(20)}[0]`, '8': `${r}.${n(21)}[0]`,
    '9': `${r}.${n(22)}[0]`, '10': `${r}.${n(23)}[0]`, '11a': `${r}.${n(24)}[0]`,
    '12e': t1(n(25)), '13a': t1(n(26)), '14': t1(n(27)), '15': t1(n(28)),
    '16': t2('f2_02'), '17': t2('f2_03'), '18': t2('f2_04'), '19': t2('f2_05'), '20': t2('f2_06'), '21': t2('f2_07'),
    '22': t2('f2_08'), '23': t2('f2_09'), '24': t2('f2_10'), '25a': t2('f2_11'), '25b': t2('f2_12'), '25c': t2('f2_13'),
    '25d': t2('f2_14'), '26': t2('f2_15'), '27a': t2('f2_16'), '28': t2('f2_17'), '29': t2('f2_18'), '31': t2('f2_20'),
    '32': t2('f2_21'), '33': t2('f2_22'), '34': t2('f2_23'), '35a': t2('f2_24'), '36': t2('f2_27'), '37': t2('f2_28'), '38': t2('f2_29'),
  };
}

const f1040Text = {
  firstName: t1('f1_04'), lastName: t1('f1_05'), ssn: t1('f1_06'),
  line16Other: `${T}Page2[0].f2_01[0]`,
  spouseFirstName: t1('f1_07'), spouseLastName: t1('f1_08'), spouseSsn: t1('f1_09'),
  street: `${T}Page1[0].Address_ReadOrder[0].f1_10[0]`, apt: `${T}Page1[0].Address_ReadOrder[0].f1_11[0]`,
  city: `${T}Page1[0].Address_ReadOrder[0].f1_12[0]`, state: `${T}Page1[0].Address_ReadOrder[0].f1_13[0]`,
  zip: `${T}Page1[0].Address_ReadOrder[0].f1_14[0]`, foreignCountry: `${T}Page1[0].Address_ReadOrder[0].f1_15[0]`,
  foreignProvince: `${T}Page1[0].Address_ReadOrder[0].f1_16[0]`, foreignPostalCode: `${T}Page1[0].Address_ReadOrder[0].f1_17[0]`,
  // One field serves the MFS spouse's name and the HOH/QSS child's name on these years' forms.
  mfsSpouseName: t1('f1_18'),
  occupation: t2('f2_33'), spouseOccupation: t2('f2_35'),
};

const sharedSch3 = { lines: { '1': t1('f1_03'), '8': t1('f1_26') }, text: { name: t1('f1_01'), ssn: t1('f1_02') }, checks: {} };

const sch8812: FormMap = {
  file: 'f1040s8.pdf',
  lines: {
    '1': t1('f1_3'), '2b': t1('f1_5'), '2d': t1('f1_7'), '3': t1('f1_8'), '4': t1('f1_9'), '5': t1('f1_10'),
    '6': `${T}Page1[0].Line6ReadOrder[0].f1_11[0]`, '7': t1('f1_12'), '8': t1('f1_13'), '9': t1('f1_14'), '10': t1('f1_15'),
    '11': t1('f1_16'), '12': t1('f1_17'), '13': t1('f1_18'), '14': t1('f1_19'),
    '16a': t2('f2_1'), '16b': t2('f2_3'), '17': t2('f2_4'), '18a': t2('f2_5'), '19': t2('f2_7'), '20': t2('f2_8'), '27': t2('f2_15'),
  },
  text: { name: t1('f1_1'), ssn: t1('f1_2') },
  checks: {},
};

/** Form 1116 Part III lines 9-35 are numbered the same in 2023-2025; field names differ only on page 2 line 9/15 in 2024. */
function f1116Page2(year: 2024 | 2023): Record<string, string> {
  const nine = year === 2024 ? `${T}Page2[0].Line9_ReadOrder[0].f2_01[0]` : t2('f2_1');
  const fifteen = year === 2024 ? `${T}Page2[0].Line15_ReadOrder[0].f2_07[0]` : t2('f2_7');
  const n = (k: number) => (year === 2024 ? `f2_${String(k).padStart(2, '0')}` : `f2_${k}`);
  return {
    '9': nine, '10': t2(n(2)), '11': t2(n(3)), '12': t2(n(4)), '13': t2(n(5)), '14': t2(n(6)), '15': fifteen, '16': t2(n(8)),
    '17': t2(n(9)), '18': t2(n(10)), '19': t2(n(11)), '20': t2(n(12)), '21': t2(n(13)), '22': t2(n(14)), '23': t2(n(15)),
    '24': t2(n(16)), '27': t2(n(19)), '28': t2(n(20)), '32': t2(n(24)), '33': t2(n(25)), '35': t2(n(27)),
  };
}

const reused = {
  F2555: F2555_2025, F2555_TRIPS: F2555_TRIPS_2025, SCH1116B, SCH1116B_GRID, F8833, F8833_EXPLANATION, F8938, F8938_PART3,
};

export const MAPS_2024: YearMaps = {
  ...reused,
  F6251: f6251Map(2024), SCHC: schCMap(2024), F4562: f4562Map(2024),
  F1040: {
    file: 'f1040.pdf', lines: f1040Lines(32), text: f1040Text,
    checks: {
      single: [`${T}Page1[0].FilingStatus_ReadOrder[0].c1_3[0]`, '1'], mfj: [`${T}Page1[0].c1_3[0]`, '2'],
      mfs: [`${T}Page1[0].FilingStatus_ReadOrder[0].c1_3[1]`, '3'], hoh: [`${T}Page1[0].FilingStatus_ReadOrder[0].c1_3[2]`, '4'],
      qss: [`${T}Page1[0].c1_3[1]`, '5'],
      digitalAssetsYes: [`${T}Page1[0].c1_5[0]`, '1'], digitalAssetsNo: [`${T}Page1[0].c1_5[1]`, '2'],
      youBornBefore: [t1('c1_9'), '1'], youBlind: [t1('c1_10'), '1'], spouseBornBefore: [t1('c1_11'), '1'], spouseBlind: [t1('c1_12'), '1'],
      capGainNoSchD: [`${T}Page1[0].Line4a-11_ReadOrder[0].c1_23[0]`, '1'],
      line16Box3: [`${T}Page2[0].c2_3[0]`, '1'],
    },
  },
  SCH1: {
    file: 'f1040s1.pdf',
    lines: { '3': f1('f1_07'), '7': f1('f1_11'), '8d': f1('f1_15'), '24j': f2('f2_25'), '8z': f1('f1_36'), '9': f1('f1_37'), '10': f1('f1_38'), '26': f2('f2_31') },
    text: { name: f1('f1_01'), ssn: f1('f1_02'), line8zType: `form1[0].Page1[0].Line8z_ReadOrder[0].f1_34[0]` },
    checks: {},
  },
  SCH2: {
    file: 'f1040s2.pdf',
    lines: { '1z': f1('f1_11'), '2': f1('f1_12'), '3': f1('f1_13'), '12': f1('f1_22'), '17p': f2('f2_17'), '18': f2('f2_22'), '21': f2('f2_25') },
    text: { name: f1('f1_01'), ssn: f1('f1_02') },
    checks: {},
  },
  SCH3: { file: 'f1040s3.pdf', ...sharedSch3, lines: { ...sharedSch3.lines, '15': t1('f1_39') } },
  SCH8812: sch8812,
  SCHB: {
    ...SCHB_2025,
    map: { ...SCHB_2025.map, checks: {
      ...SCHB_2025.map.checks,
      foreignAccountYes: [`${T}Page1[0].c1_1[0]`, '1'], foreignAccountNo: [`${T}Page1[0].c1_1[1]`, '2'],
    } },
  },
  F1116: {
    file: 'f1116.pdf',
    lines: {
      '1a': `${T}Page1[0].Table_Part1_LinesI-1a[0].Line1a[0].ColA[0].f1_10[0]`, total1a: t1('f1_13'),
      '2': `${T}Page1[0].Table_Part1_Lines2-6[0].Line2[0].f1_14[0]`, '3a': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3a[0].f1_17[0]`,
      '3b': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3b[0].f1_20[0]`, '3c': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3c[0].f1_23[0]`,
      '3d': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3d[0].f1_26[0]`, '3e': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3e[0].f1_29[0]`,
      '3f': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3f[0].f1_32[0]`, '3g': `${T}Page1[0].Table_Part1_Lines2-6[0].Line3g[0].f1_35[0]`,
      '6A': `${T}Page1[0].Table_Part1_Lines2-6[0].Line6[0].f1_47[0]`, '6': t1('f1_50'), '7': t1('f1_51'),
      p: `${T}Page1[0].Table_Part2[0].RowA[0].f1_56[0]`, t: `${T}Page1[0].Table_Part2[0].RowA[0].f1_60[0]`,
      u: `${T}Page1[0].Table_Part2[0].RowA[0].f1_61[0]`, '8': t1('f1_82'),
      ...f1116Page2(2024),
    },
    text: {
      name: t1('f1_01'), ssn: t1('f1_02'), residentOf: t1('f1_03'),
      countryA: `${T}Page1[0].Table_Part1_LinesI-1a[0].Rowi[0].f1_04[0]`,
      line1aDesc: `${T}Page1[0].Table_Part1_LinesI-1a[0].Line1a[0].Line1a_Text[0].f1_07[0]`,
      dateA: `${T}Page1[0].Table_Part2[0].RowA[0].f1_52[0]`,
    },
    checks: {
      passive: [`${T}Page1[0].LineC-D_ReadOrder[0].c1_1[0]`, '3'], general: [`${T}Page1[0].LineC-D_ReadOrder[0].c1_1[1]`, '4'],
      paid: [`${T}Page1[0].ActiveHeaderElements[0].c1_3[0]`, '1'], accrued: [`${T}Page1[0].ActiveHeaderElements[0].c1_3[1]`, '2'],
    },
  },
};

export const MAPS_2023: YearMaps = {
  ...reused,
  F6251: f6251Map(2023), SCHC: schCMap(2023), F4562: f4562Map(2023),
  F1040: {
    file: 'f1040.pdf', lines: f1040Lines(31), text: f1040Text,
    checks: {
      single: [`${T}Page1[0].c1_3[0]`, '1'], mfj: [`${T}Page1[0].c1_3[1]`, '2'], mfs: [`${T}Page1[0].c1_3[2]`, '3'],
      hoh: [`${T}Page1[0].c1_3[3]`, '4'], qss: [`${T}Page1[0].c1_3[4]`, '5'],
      digitalAssetsYes: [`${T}Page1[0].c1_4[0]`, '1'], digitalAssetsNo: [`${T}Page1[0].c1_4[1]`, '2'],
      youBornBefore: [t1('c1_8'), '1'], youBlind: [t1('c1_9'), '1'], spouseBornBefore: [t1('c1_10'), '1'], spouseBlind: [t1('c1_11'), '1'],
      capGainNoSchD: [`${T}Page1[0].Line4a-11_ReadOrder[0].c1_22[0]`, '1'],
      line16Box3: [`${T}Page2[0].c2_3[0]`, '1'],
    },
  },
  SCH1: {
    file: 'f1040s1.pdf',
    lines: { '3': f1('f1_06'), '7': f1('f1_10'), '8d': f1('f1_14'), '24j': f2('f2_25'), '8z': f1('f1_34'), '9': f1('f1_35'), '10': f1('f1_36'), '26': f2('f2_31') },
    text: { name: f1('f1_01'), ssn: f1('f1_02'), line8zType: `form1[0].Page1[0].Line8z_ReadOrder[0].f1_32[0]` },
    checks: {},
  },
  SCH2: {
    file: 'f1040s2.pdf',
    // 2023 Schedule 2 numbers AMT as line 1 (2024+: line 2) and has no line 1z. Key '2' (AMT) is printed line 1 here.
    lines: { '2': f1('f1_03'), '3': f1('f1_05'), '12': f1('f1_14'), '17p': f2('f2_17'), '18': f2('f2_22'), '21': f2('f2_25') },
    text: { name: f1('f1_01'), ssn: f1('f1_02') },
    checks: {},
  },
  SCH3: { file: 'f1040s3.pdf', ...sharedSch3, lines: { ...sharedSch3.lines, '15': t2('f2_17') } },
  SCH8812: sch8812,
  SCHB: MAPS_2024.SCHB,
  F1116: {
    file: 'f1116.pdf',
    lines: {
      '1a': `${T}Page1[0].Part1Table[0].Line1a[0].Line1aColA[0].f1_10[0]`, total1a: `${T}Page1[0].Part1Table[0].Line1a[0].Ln1aTotal[0].f1_13[0]`,
      '2': `${T}Page1[0].Part1Table[0].Line2[0].f1_14[0]`, '3a': `${T}Page1[0].Part1Table[0].Line3a[0].f1_17[0]`,
      '3b': `${T}Page1[0].Part1Table[0].Line3b[0].f1_20[0]`, '3c': `${T}Page1[0].Part1Table[0].Line3c[0].f1_23[0]`,
      '3d': `${T}Page1[0].Part1Table[0].Line3d[0].f1_26[0]`, '3e': `${T}Page1[0].Part1Table[0].Line3e[0].f1_29[0]`,
      '3f': `${T}Page1[0].Part1Table[0].Line3f[0].f1_32[0]`, '3g': `${T}Page1[0].Part1Table[0].Line3g[0].f1_35[0]`,
      '6A': `${T}Page1[0].Part1Table[0].Line6[0].f1_47[0]`, '6': `${T}Page1[0].Part1Table[0].Line6[0].f1_50[0]`, '7': t1('f1_51'),
      p: `${T}Page1[0].Part2TableBody[0].RowA[0].f1_56[0]`, t: `${T}Page1[0].Part2TableBody[0].RowA[0].f1_60[0]`,
      u: `${T}Page1[0].Part2TableBody[0].RowA[0].f1_61[0]`, '8': t1('f1_82'),
      ...f1116Page2(2023),
    },
    text: {
      name: t1('f1_1'), ssn: t1('f1_2'), residentOf: t1('f1_3'),
      countryA: `${T}Page1[0].Part1Table[0].LineI[0].f1_4[0]`,
      line1aDesc: `${T}Page1[0].Part1Table[0].Line1a[0].Line1a[0].f1_7[0]`,
      dateA: `${T}Page1[0].Part2TableBody[0].RowA[0].f1_52[0]`,
    },
    checks: {
      passive: [`${T}Page1[0].c1_1[2]`, '3'], general: [`${T}Page1[0].c1_1[3]`, '4'],
      paid: [`${T}Page1[0].Part2TableHeader[0].ColumnJ[0].CreditClaimedCheckboxes[0].c1_3[0]`, 'Paid'],
      accrued: [`${T}Page1[0].Part2TableHeader[0].ColumnJ[0].CreditClaimedCheckboxes[0].c1_3[1]`, 'Accrued'],
    },
  },
};

