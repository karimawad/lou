// Field maps for the official 2025 IRS fillable PDFs (research/irs-pdfs/2025).
// Field names come from research/fields/2025/*.tsv (dumpfields.mjs), where each
// field is labeled with the line number printed beside it. maps.test.ts
// re-checks every amount field against that dump.

const P = 'topmostSubform[0].';

export interface FormMap {
  /** File name under public/forms/<year>/. */
  file: string;
  /** Line number -> text field (whole-dollar amounts). */
  lines: Record<string, string>;
  /** Named text fields (names, SSN, descriptions). */
  text: Record<string, string>;
  /** Named checkboxes: [field, export value]. */
  checks: Record<string, [string, string]>;
}

const p1 = (n: string) => `${P}Page1[0].${n}[0]`;
const p2 = (n: string) => `${P}Page2[0].${n}[0]`;

export const F1040_2025: FormMap = {
  file: 'f1040.pdf',
  lines: {
    '1a': p1('f1_47'), '1b': p1('f1_48'), '1c': p1('f1_49'), '1d': p1('f1_50'), '1e': p1('f1_51'),
    '1f': p1('f1_52'), '1g': p1('f1_53'), '1h': p1('f1_55'), '1i': p1('f1_56'), '1z': p1('f1_57'),
    '2a': p1('f1_58'), '2b': p1('f1_59'), '3a': p1('f1_60'), '3b': p1('f1_61'),
    '4a': p1('f1_62'), '4b': p1('f1_63'), '5a': p1('f1_65'), '5b': p1('f1_66'),
    '6a': p1('f1_68'), '6b': p1('f1_69'), '7a': p1('f1_70'), '8': p1('f1_72'), '9': p1('f1_73'),
    '10': p1('f1_74'), '11a': p1('f1_75'),
    '11b': p2('f2_01'), '12e': p2('f2_02'), '13a': p2('f2_03'), '13b': p2('f2_04'), '14': p2('f2_05'),
    '15': p2('f2_06'), '16': p2('f2_08'), '17': p2('f2_09'), '18': p2('f2_10'), '19': p2('f2_11'),
    '20': p2('f2_12'), '21': p2('f2_13'), '22': p2('f2_14'), '23': p2('f2_15'), '24': p2('f2_16'),
    '25a': p2('f2_17'), '25b': p2('f2_18'), '25c': p2('f2_19'), '25d': p2('f2_20'), '26': p2('f2_21'),
    '27a': p2('f2_23'), '28': p2('f2_24'), '29': p2('f2_25'), '30': p2('f2_26'), '31': p2('f2_27'),
    '32': p2('f2_28'), '33': p2('f2_29'), '34': p2('f2_30'), '35a': p2('f2_31'), '36': p2('f2_34'),
    '37': p2('f2_35'), '38': p2('f2_36'),
  },
  text: {
    firstName: p1('f1_14'), lastName: p1('f1_15'), ssn: p1('f1_16'),
    spouseFirstName: p1('f1_17'), spouseLastName: p1('f1_18'), spouseSsn: p1('f1_19'),
    street: `${P}Page1[0].Address_ReadOrder[0].f1_20[0]`, apt: `${P}Page1[0].Address_ReadOrder[0].f1_21[0]`,
    city: `${P}Page1[0].Address_ReadOrder[0].f1_22[0]`, state: `${P}Page1[0].Address_ReadOrder[0].f1_23[0]`,
    zip: `${P}Page1[0].Address_ReadOrder[0].f1_24[0]`, foreignCountry: `${P}Page1[0].Address_ReadOrder[0].f1_25[0]`,
    foreignProvince: `${P}Page1[0].Address_ReadOrder[0].f1_26[0]`, foreignPostalCode: `${P}Page1[0].Address_ReadOrder[0].f1_27[0]`,
    mfsSpouseName: `${P}Page1[0].Checkbox_ReadOrder[0].f1_28[0]`,
    line1hType: p1('f1_54'), line16Other: p2('f2_07'),
    occupation: p2('f2_40'), spouseOccupation: p2('f2_42'),
  },
  checks: {
    single: [`${P}Page1[0].Checkbox_ReadOrder[0].c1_8[0]`, '1'],
    mfj: [`${P}Page1[0].Checkbox_ReadOrder[0].c1_8[1]`, '2'],
    mfs: [`${P}Page1[0].Checkbox_ReadOrder[0].c1_8[2]`, '3'],
    hoh: [`${P}Page1[0].c1_8[0]`, '4'],
    qss: [`${P}Page1[0].c1_8[1]`, '5'],
    digitalAssetsYes: [`${P}Page1[0].c1_10[0]`, '1'],
    digitalAssetsNo: [`${P}Page1[0].c1_10[1]`, '2'],
    capGainNoSchD: [`${P}Page1[0].c1_43[0]`, '1'],
    line16Box3: [`${P}Page2[0].c2_11[0]`, '1'],
    youBornBefore: [`${P}Page2[0].c2_5[0]`, '1'],
    youBlind: [`${P}Page2[0].c2_6[0]`, '1'],
    spouseBornBefore: [`${P}Page2[0].c2_7[0]`, '1'],
    spouseBlind: [`${P}Page2[0].c2_8[0]`, '1'],
  },
};

const s = (pg: 1 | 2, n: string) => `${P}Page${pg}[0].${n}[0]`;
/** Schedules 1-A and 2 use a different root subform. */
const f = (pg: 1 | 2, n: string) => `form1[0].Page${pg}[0].${n}[0]`;

export const SCH1_2025: FormMap = {
  file: 'f1040s1.pdf',
  lines: {
    '3': s(1, 'f1_07'), '7': s(1, 'f1_12'), '8d': s(1, 'f1_16'), '24j': s(2, 'f2_25'), '8z': s(1, 'f1_36'), '9': s(1, 'f1_37'), '10': s(1, 'f1_38'),
    '26': s(2, 'f2_30'),
  },
  text: { name: s(1, 'f1_01'), ssn: s(1, 'f1_02'), line8zType: `${P}Page1[0].Line8z_ReadOrder[0].f1_35[0]` },
  checks: {},
};

export const SCH1A_2025: FormMap = {
  file: 'f1040s1a.pdf',
  lines: {
    '1': f(1, 'f1_03'), '2b': f(1, 'f1_05'), '2c': f(1, 'f1_06'), '2e': f(1, 'f1_08'), '3': f(1, 'f1_09'),
    '31': f(2, 'f2_15'), '32': f(2, 'f2_16'), '33': f(2, 'f2_17'), '34': f(2, 'f2_18'), '35': f(2, 'f2_19'),
    '36a': f(2, 'f2_20'), '36b': f(2, 'f2_21'), '37': f(2, 'f2_22'), '38': f(2, 'f2_23'),
  },
  text: { name: f(1, 'f1_01'), ssn: f(1, 'f1_02') },
  checks: {},
};

export const SCH2_2025: FormMap = {
  file: 'f1040s2.pdf',
  lines: { '1z': f(1, 'f1_11'), '2': f(1, 'f1_12'), '3': f(1, 'f1_13'), '12': f(1, 'f1_23'), '17p': f(2, 'f2_17'), '18': f(2, 'f2_21'), '21': f(2, 'f2_24') },
  text: { name: f(1, 'f1_01'), ssn: f(1, 'f1_02') },
  checks: {},
};

export const SCH3_2025: FormMap = {
  file: 'f1040s3.pdf',
  lines: { '1': s(1, 'f1_03'), '8': s(1, 'f1_25'), '15': s(1, 'f1_37') },
  text: { name: s(1, 'f1_01'), ssn: s(1, 'f1_02') },
  checks: {},
};

export const SCH8812_2025: FormMap = {
  file: 'f1040s8.pdf',
  lines: {
    '1': s(1, 'f1_3'), '2b': s(1, 'f1_5'), '2d': s(1, 'f1_7'), '3': s(1, 'f1_8'), '4': s(1, 'f1_9'), '5': s(1, 'f1_10'),
    '6': `${P}Page1[0].Line6ReadOrder[0].f1_11[0]`, '7': s(1, 'f1_12'), '8': s(1, 'f1_13'), '9': s(1, 'f1_14'), '10': s(1, 'f1_15'),
    '11': s(1, 'f1_16'), '12': s(1, 'f1_17'), '13': s(1, 'f1_18'), '14': s(1, 'f1_19'),
    '16a': s(2, 'f2_2'), '16b': s(2, 'f2_4'), '17': s(2, 'f2_5'), '18a': s(2, 'f2_6'), '19': s(2, 'f2_8'),
    '20': s(2, 'f2_9'), '27': s(2, 'f2_16'),
  },
  text: { name: s(1, 'f1_1'), ssn: s(1, 'f1_2') },
  checks: {},
};

/** Schedule B: 14 interest rows and 15 dividend rows of [payer, amount]. */
const schBRow = (nameNo: number) => [s(1, `f1_${String(nameNo).padStart(2, '0')}`), s(1, `f1_${String(nameNo + 1).padStart(2, '0')}`)];
export const SCHB_2025 = {
  file: 'f1040sb.pdf',
  map: {
    lines: { '2': s(1, 'f1_31'), '4': s(1, 'f1_33'), '6': s(1, 'f1_64') },
    text: { name: s(1, 'f1_01'), ssn: s(1, 'f1_02'), country: s(1, 'f1_65') },
    checks: {
      foreignAccountYes: [`${P}Page1[0].TagcorrectingSubform[0].c1_1[0]`, '1'],
      foreignAccountNo: [`${P}Page1[0].TagcorrectingSubform[0].c1_1[1]`, '2'],
      fbarRequiredYes: [s(1, 'c1_2'), '1'],
      fbarRequiredNo: [`${P}Page1[0].c1_2[1]`, '2'],
      foreignTrustYes: [s(1, 'c1_3'), '1'],
      foreignTrustNo: [`${P}Page1[0].c1_3[1]`, '2'],
    } as Record<string, [string, string]>,
  } satisfies Omit<FormMap, 'file'>,
  // The first interest payer field sits inside a ReadOrder subform.
  interestRows: [[`${P}Page1[0].Line1_ReadOrder[0].f1_03[0]`, s(1, 'f1_04')],
    ...[5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29].map(schBRow)],
  dividendRows: [[`${P}Page1[0].ReadOrderControl[0].f1_34[0]`, s(1, 'f1_35')],
    ...[36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62].map(schBRow)],
};

const t1 = `${P}Page1[0].Table_Part1_LinesI-1a[0]`;
const t26 = `${P}Page1[0].Table_Part1_Lines2-6[0]`;
/** Form 1116, one country (Canada) in column A. */
export const F1116_2025: FormMap = {
  file: 'f1116.pdf',
  lines: {
    '1a': `${t1}.Line1a[0].ColA[0].f1_10[0]`, 'total1a': s(1, 'f1_13'),
    '2': `${t26}.Line2[0].f1_14[0]`, '3a': `${t26}.Line3a[0].f1_17[0]`, '3b': `${t26}.Line3b[0].f1_20[0]`,
    '3c': `${t26}.Line3c[0].f1_23[0]`, '3d': `${t26}.Line3d[0].f1_26[0]`, '3e': `${t26}.Line3e[0].f1_29[0]`,
    '3f': `${t26}.Line3f[0].f1_32[0]`, '3g': `${t26}.Line3g[0].f1_35[0]`, '4a': `${t26}.Line4a[0].f1_38[0]`,
    '4b': `${t26}.Line4b[0].f1_41[0]`, '5': `${t26}.Line5[0].f1_44[0]`, '6A': `${t26}.Line6[0].f1_47[0]`,
    '6': s(1, 'f1_50'), '7': s(1, 'f1_51'),
    // Part II row A: (l) date, (m)-(p) foreign currency, (q)-(t) USD, (u) total.
    'p': `${P}Page1[0].Table_Part2[0].RowA[0].f1_56[0]`, 't': `${P}Page1[0].Table_Part2[0].RowA[0].f1_60[0]`,
    'u': `${P}Page1[0].Table_Part2[0].RowA[0].f1_61[0]`, '8': s(1, 'f1_82'),
    '9': `${P}Page2[0].Line9_ReadOrder[0].f2_01[0]`, '10': s(2, 'f2_02'), '11': s(2, 'f2_03'), '12': s(2, 'f2_04'),
    '13': s(2, 'f2_05'), '14': s(2, 'f2_06'), '15': `${P}Page2[0].Line15_ReadOrder[0].f2_07[0]`, '16': s(2, 'f2_08'),
    '17': s(2, 'f2_09'), '18': s(2, 'f2_10'), '19': s(2, 'f2_11'), '20': s(2, 'f2_12'), '21': s(2, 'f2_13'),
    '22': s(2, 'f2_14'), '23': s(2, 'f2_15'), '24': s(2, 'f2_16'), '27': s(2, 'f2_19'), '28': s(2, 'f2_20'),
    '32': s(2, 'f2_24'), '33': s(2, 'f2_25'), '35': s(2, 'f2_27'),
  },
  text: {
    name: s(1, 'f1_01'), ssn: s(1, 'f1_02'), residentOf: s(1, 'f1_03'),
    countryA: `${t1}.Rowi[0].f1_04[0]`, line1aDesc: `${t1}.Line1a[0].Line1a_Text[0].f1_07[0]`,
    dateA: `${P}Page1[0].Table_Part2[0].RowA[0].f1_52[0]`,
  },
  checks: {
    passive: [`${P}Page1[0].LineC-D_ReadOrder[0].c1_1[0]`, '3'],
    general: [`${P}Page1[0].LineC-D_ReadOrder[0].c1_1[1]`, '4'],
    paid: [`${P}Page1[0].Part2[0].ActiveHeaderElements[0].c1_3[0]`, '1'],
    accrued: [`${P}Page1[0].Part2[0].ActiveHeaderElements[0].c1_3[1]`, '2'],
  },
};



const p3 = (n: string) => `${P}Page3[0].${n}[0]`;
/** Form 2555 (Parts I-IX). Same fields 2023-2025. */
/** Form 2555 line 18 travel table: 4 rows x (a) country, (b) arrived, (c) left, (d) full days, (e) US business days, (f) US income. */
export const F2555_TRAVEL: string[][] = [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `${P}Page2[0].Table_Line18[0].BodyRow${r + 1}[0].f2_${4 + r * 6 + c}[0]`));

export const F2555_2025: FormMap = {
  file: 'f2555.pdf',
  lines: {
    '19': p2('f2_28'), '20a': p2('f2_29'), '24': p2('f2_51'), '25': p2('f2_52'), '26': p2('f2_53'),
    '27': `${P}Page3[0].Line27TagCorrectingSubform[0].f3_1[0]`,
    '28': `${P}Page3[0].Line28TagCorrectingSubform[0].f3_2[0]`, '29b': p3('f3_4'), '30': p3('f3_5'), '31': p3('f3_6'), '32': p3('f3_7'),
    '33': p3('f3_8'), '34': p3('f3_9'),
    '46': p3('f3_23'), '47': p3('f3_24'), '48': p3('f3_25'), '49': p3('f3_26'), '50': p3('f3_27'),
    '36': p3('f3_12'), '37': p3('f3_13'), '38': p3('f3_14'), '40': p3('f3_17'), '41': p3('f3_18'),
    '42': p3('f3_19'), '43': p3('f3_20'), '44': p3('f3_21'), '45': p3('f3_22'),
  },
  text: {
    name: p1('f1_1'), ssn: p1('f1_2'), foreignAddress: p1('f1_3'), occupation: p1('f1_4'),
    employerName: p1('f1_5'), employerUsAddress: p1('f1_6'), employerForeignAddress: p1('f1_7'), employerOther: p1('f1_8'),
    lastYearFiled: p1('f1_9'), revocation: p1('f1_10'), citizenship: p1('f1_11'), secondHousehold: p1('f1_12'),
    taxHome: p1('f1_13'), taxHome2: p1('f1_14'), residenceBegan: p1('f1_15'), residenceEnded: p1('f1_16'),
    familyWho: p1('f1_17'), contractTerms: p1('f1_50'), contractTerms2: p1('f1_51'), visa: p1('f1_52'),
    usHomeAddress: p1('f1_53'), usHomeAddress2: p1('f1_54'), line39Whole: p3('f3_15'), line39Decimal: p3('f3_16'),
    pptFrom: p2('f2_1'), pptTo: p2('f2_2'), pptCountry: p2('f2_3'), housingLocation: p3('f3_3'), line35Whole: p3('f3_10'), line35Decimal: p3('f3_11'),
  },
  checks: {
    employerForeign: [p1('c1_1'), '1'], employerUs: [p1('c1_2'), '1'], employerSelf: [p1('c1_3'), '1'],
    employerForeignAffiliate: [p1('c1_4'), '1'], employerOther: [p1('c1_5'), '1'],
    neverFiled: [p1('c1_6'), '1'],
    revokedYes: [`${P}Page1[0].c1_7[0]`, '1'], revokedNo: [`${P}Page1[0].c1_7[1]`, '2'],
    secondHouseholdYes: [`${P}Page1[0].c1_9[0]`, '1'], secondHouseholdNo: [`${P}Page1[0].c1_9[1]`, '2'],
    quartersPurchased: [`${P}Page1[0].c1_11[0]`, '1'], quartersRented: [`${P}Page1[0].c1_11[1]`, '2'],
    quartersRoom: [`${P}Page1[0].c1_11[2]`, '3'], quartersEmployer: [`${P}Page1[0].c1_11[3]`, '4'],
    familyYes: [`${P}Page1[0].c1_15[0]`, '1'], familyNo: [`${P}Page1[0].c1_15[1]`, '2'],
    nonResidentStatementYes: [`${P}Page1[0].c1_17[0]`, '1'], nonResidentStatementNo: [`${P}Page1[0].c1_17[1]`, '2'],
    payForeignTaxYes: [`${P}Page1[0].c1_19[0]`, '1'], payForeignTaxNo: [`${P}Page1[0].c1_19[1]`, '2'],
    visaLimitYes: [`${P}Page1[0].c1_21[0]`, '1'], visaLimitNo: [`${P}Page1[0].c1_21[1]`, '2'],
    usHomeYes: [`${P}Page1[0].c1_23[0]`, '1'], usHomeNo: [`${P}Page1[0].c1_23[1]`, '2'],
    housingYes: [`${P}Page3[0].c3_1[0]`, '1'], housingNo: [`${P}Page3[0].c3_1[1]`, '2'],
  },
};

/** Line 14 trips table: 8 rows of [arrived, left, business days, US business income]. */
export const F2555_TRIPS_2025: string[][] = Array.from({ length: 8 }, (_, r) => {
  const table = r < 4 ? 'Table1_Line14' : 'Table2_Line14';
  const first = 18 + r * 4;
  return [0, 1, 2, 3].map((c) => `${P}Page1[0].${table}[0].BodyRow${r + 1}[0].f1_${first + c}[0]`);
});


/** Form 8833 (Rev. December 2022). */
export const F8833: FormMap = {
  file: 'f8833.pdf',
  lines: {},
  text: {
    name: p1('f1_1'), tin: p1('f1_2'), addressResidence: p1('f1_4'), addressUs: p1('f1_5'),
    treatyCountry: `${P}Page1[0].Lines1-2_ReadOrder[0].f1_6[0]`, articles: `${P}Page1[0].Lines1-2_ReadOrder[0].f1_7[0]`,
    codeProvisions: p1('f1_8'), payor: p1('f1_9'), lob: p1('f1_10'),
  },
  checks: {
    section6114: [`${P}Page1[0].BulletedList1[0].Bullet1[0].c1_1[0]`, '1'],
    usCitizen: [p1('c1_3'), '1'],
    specificYes: [`${P}Page1[0].c1_4[0]`, '1'], specificNo: [`${P}Page1[0].c1_4[1]`, '2'],
  },
};
/** Line 6 explanation: a short first line, then 24 full-width lines. */
export const F8833_EXPLANATION: string[] = Array.from({ length: 25 }, (_, i) => p1(`f1_${12 + i}`));


/** Schedule B (Form 1116) grid: [page][line] -> 7 column fields, left to right (generated from research/fields/2025/f1116sb.tsv). */
export const SCH1116B_GRID: Record<'p1' | 'p2', Record<'1' | '3' | '4' | '5' | '6' | '7' | '8', string[]>> = {
 "p1": {
  "1": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_10[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_11[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_12[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_13[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_14[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_15[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line1[0].f1_16[0]"
  ],
  "3": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_71[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_72[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_73[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_74[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_75[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_76[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line3[0].f1_77[0]"
  ],
  "4": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_78[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_79[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_80[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_81[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_82[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_83[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line4[0].f1_84[0]"
  ],
  "5": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_85[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_86[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_87[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_88[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_89[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_90[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line5[0].f1_91[0]"
  ],
  "6": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_92[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_93[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_94[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_95[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_96[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_97[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line6[0].f1_98[0]"
  ],
  "7": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_99[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_100[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_101[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_102[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_103[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_104[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line7[0].f1_105[0]"
  ],
  "8": [
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_106[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_107[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_108[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_109[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_110[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_111[0]",
   "topmostSubform[0].Page1[0].Table_Page1[0].Line8[0].f1_112[0]"
  ]
 },
 "p2": {
  "1": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_01[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_02[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_03[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_04[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_05[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_06[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line1[0].f2_07[0]"
  ],
  "3": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_62[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_63[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_64[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_65[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_66[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_67[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line3[0].f2_68[0]"
  ],
  "4": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_69[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_70[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_71[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_72[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_73[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_74[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line4[0].f2_75[0]"
  ],
  "5": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_76[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_77[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_78[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_79[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_80[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_81[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line5[0].f2_82[0]"
  ],
  "6": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_83[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_84[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_85[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_86[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_87[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_88[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line6[0].f2_89[0]"
  ],
  "7": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_90[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_91[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_92[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_93[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_94[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_95[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line7[0].f2_96[0]"
  ],
  "8": [
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_97[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_98[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_99[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_100[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_101[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_102[0]",
   "topmostSubform[0].Page2[0].Table_Page2[0].Line8[0].f2_103[0]"
  ]
 }
};

/** Schedule B (Form 1116) header and category boxes. */
export const SCH1116B: FormMap = {
  file: 'f1116sb.pdf',
  lines: {},
  text: { year: 'topmostSubform[0].Page1[0].Pg1Header[0].f1_01[0]', name: 'topmostSubform[0].Page1[0].f1_06[0]', tin: 'topmostSubform[0].Page1[0].f1_07[0]' },
  checks: {
    passive: ['topmostSubform[0].Page1[0].CheckboxC-D_ReadOrder[0].c1_01[0]', '3'],
    general: ['topmostSubform[0].Page1[0].CheckboxC-D_ReadOrder[0].c1_01[1]', '4'],
  },
};

/** Form 8938 (Rev. November 2021). Page 2 holds one Part V account and one Part VI asset. */
export const F8938: FormMap = {
  file: 'f8938.pdf',
  lines: {},
  text: {
    year: `${P}Page1[0].Pg1Header[0].f1_01[0]`,
    statementsCount: p1('f1_06'), name: p1('f1_07'), tin: p1('f1_08'),
    depositCount: p1('f1_11'), depositMax: p1('f1_12'), custodialCount: p1('f1_13'), custodialMax: p1('f1_14'),
    otherCount: p1('f1_15'), otherMax: p1('f1_16'),
    forms3520: p1('f1_59'), forms3520A: p1('f1_60'), forms5471: p1('f1_61'), forms8621: p1('f1_62'), forms8865: p1('f1_63'),
    // Part V
    accountNumber: p2('f2_01'), accountMax: p2('f2_02'), accountCurrency: p2('f2_03'), accountRate: p2('f2_04'), accountRateSource: p2('f2_05'),
    institution: p2('f2_06'), institutionStreet: p2('f2_11'), institutionCity: p2('f2_12'),
    // Part VI
    assetDescription: p2('f2_13'), assetId: p2('f2_14'), assetAcquired: p2('f2_15'), assetDisposed: p2('f2_16'), assetValueOver200k: p2('f2_17'),
    assetCurrency: p2('f2_18'), assetRate: p2('f2_19'), assetRateSource: p2('f2_20'),
    issuerName: p2('f2_28'), issuerStreet: p2('f2_29'), issuerCity: p2('f2_30'),
  },
  checks: {
    statements: [p1('c1_1'), '1'], specifiedIndividual: [`${P}Page1[0].c1_2[0]`, '1'],
    closedYes: [`${P}Page1[0].c1_3[0]`, '1'], closedNo: [`${P}Page1[0].c1_3[1]`, '2'],
    otherChangedYes: [`${P}Page1[0].c1_4[0]`, '1'], otherChangedNo: [`${P}Page1[0].c1_4[1]`, '2'],
    deposit: [`${P}Page2[0].Line20_ReadOrder[0].c2_1[0]`, '1'], custodial: [`${P}Page2[0].Line20_ReadOrder[0].c2_1[1]`, '2'],
    opened: [p2('c2_2'), '1'], closed: [p2('c2_3'), '1'], joint: [p2('c2_4'), '1'],
    accountRateYes: [`${P}Page2[0].c2_6[0]`, '1'], accountRateNo: [`${P}Page2[0].c2_6[1]`, '2'],
    assetJoint: [p2('c2_7'), '1'],
    value0to50k: [`${P}Page2[0].c2_9[0]`, '1'], value50to100k: [`${P}Page2[0].c2_9[1]`, '2'],
    value100to150k: [`${P}Page2[0].c2_9[2]`, '3'], value150to200k: [`${P}Page2[0].c2_9[3]`, '4'],
    assetRateYes: [`${P}Page2[0].c2_10[0]`, '1'], assetRateNo: [`${P}Page2[0].c2_10[1]`, '2'],
    issuer: [`${P}Page2[0].c2_12[0]`, '1'], issuerTrust: [`${P}Page2[0].c2_13[3]`, '4'],
    issuerForeign: [`${P}Page2[0].c2_14[1]`, '2'],
  },
};

/** Form 8938 Part III rows: [amount, form and line, schedule and line]. */
const part3 = (row: string, n: number) => [0, 1, 2].map((i) => `${P}Page1[0].Table_Part3[0].BodyRow${row}[0].f1_${n + i}[0]`);
export const F8938_PART3: Record<string, string[]> = {
  '13a': part3('13a', 17), '13b': part3('13b', 20), '13d': part3('13d', 26), '13e': part3('13e', 29), '13g': part3('13g', 35),
  '14d': part3('14d', 47),
};

/** Form 6251 page 1: [line, field number] (f1_3 = line 1a on 2025; line 1 on 2023/2024, which have no 1a/1b). */
export function f6251Map(year: 2023 | 2024 | 2025): FormMap {
  const part1 = year === 2025 ? ['1a', '1b'] : ['1'];
  const p1Lines = [...part1, '2a', '2b', '2c', '2d', '2e', '2f', '2g', '2h', '2i', '2j', '2k', '2l', '2m', '2n', '2o', '2p', '2q', '2r', '2s', '2t',
    '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  const lines: Record<string, string> = {};
  p1Lines.forEach((l, i) => { lines[l] = s(1, `f1_${i + 3}`); });
  for (let l = 12; l <= 40; l++) lines[String(l)] = s(2, `f2_${l - 11}`);
  return { file: 'f6251.pdf', lines, text: { name: s(1, 'f1_1'), ssn: s(1, 'f1_2') }, checks: {} };
}
export const F6251_2025 = f6251Map(2025);

/**
 * Schedule C (research/fields/<year>/f1040sc.tsv). Keys use the 2025 numbering: '27b' is "Other
 * expenses (from line 48)", printed as line 27a on 2023/2024 (same field, f1_39, every year).
 */
export function schCMap(year: 2023 | 2024 | 2025): FormMap {
  const p1n = (n: string) => `${P}Page1[0].${n}[0]`;
  const l817 = (n: string) => `${P}Page1[0].Lines8-17[0].${n}[0]`;
  const l1827 = (n: string) => `${P}Page1[0].Lines18-27[0].${n}[0]`;
  const lines: Record<string, string> = {};
  ['1', '2', '3', '4', '5', '6', '7'].forEach((l, i) => { lines[l] = p1n(`f1_${10 + i}`); });
  ['8', '9', '10', '11', '12', '13', '14', '15', '16a', '16b', '17'].forEach((l, i) => { lines[l] = l817(`f1_${17 + i}`); });
  ['18', '19', '20a', '20b', '21', '22', '23', '24a', '24b', '25', '26'].forEach((l, i) => { lines[l] = l1827(`f1_${28 + i}`); });
  lines['27b'] = l1827('f1_39');
  lines['27a'] = l1827('f1_40');
  Object.assign(lines, { '28': p1n('f1_41'), '29': p1n('f1_42'), '30': p1n('f1_45'), '31': p1n('f1_46'), '48': s(2, 'f2_33') });
  return {
    file: 'f1040sc.pdf', lines,
    text: {
      name: year === 2023 ? `${P}Page1[0].Pg1Header[0].f1_1[0]` : p1n('f1_1'), ssn: p1n('f1_2'), activity: p1n('f1_3'),
      code: `${P}Page1[0].BComb[0].f1_4[0]`, businessName: p1n('f1_5'), address: p1n('f1_7'), city: p1n('f1_8'),
      homeSqFt: `${P}Page1[0].Line30_ReadOrder[0].f1_43[0]`, officeSqFt: `${P}Page1[0].Line30_ReadOrder[0].f1_44[0]`,
      vehicleMonth: s(2, 'f2_9'), vehicleDay: s(2, 'f2_10'), vehicleYear: s(2, 'f2_11'),
      milesBusiness: s(2, 'f2_12'), milesCommuting: s(2, 'f2_13'), milesOther: s(2, 'f2_14'),
      otherDesc1: `${P}Page2[0].PartVTable[0].Item1[0].f2_15[0]`, otherAmt1: `${P}Page2[0].PartVTable[0].Item1[0].f2_16[0]`,
    },
    checks: {
      cash: [p1n('c1_1'), '1'], accrual: [`${P}Page1[0].c1_1[1]`, '2'],
      materialYes: [p1n('c1_2'), 'Yes'], materialNo: [`${P}Page1[0].c1_2[1]`, 'No'],
      form1099No: [`${P}Page1[0].c1_4[1]`, 'No'], atRisk: [p1n('c1_7'), '1'],
      personalUseYes: [s(2, 'c2_5'), '1'], personalUseNo: [`${P}Page2[0].c2_5[1]`, '2'],
      anotherVehicleYes: [s(2, 'c2_6'), '1'], anotherVehicleNo: [`${P}Page2[0].c2_6[1]`, '2'],
      evidenceYes: [s(2, 'c2_7'), '1'], evidenceNo: [`${P}Page2[0].c2_7[1]`, '2'],
      writtenYes: [s(2, 'c2_8'), '1'], writtenNo: [`${P}Page2[0].c2_8[1]`, '2'],
    },
  };
}
export const SCHC_2025 = schCMap(2025);

/**
 * Form 4562: header, line 17 (earlier years' MACRS), line 20a (ADS class life, columns b-e and g),
 * line 22, and Part V for one vehicle on the standard mileage rate (lines 24a/b, 30-36).
 */
export function f4562Map(year: 2023 | 2024 | 2025): FormMap & { row20a: string[]; row26: string[]; row27: string[] } {
  const n25 = year === 2025;
  const r20 = (n: string) => `${P}Page1[0].SectionCTable[0].Line20a[0].${n}[0]`;
  const v = (line: number, n: string) => `${P}Page2[0].Table_Ln30-33[0].Line${line}[0].${n}[0]`;
  const yn = (line: number, n: string, i: 0 | 1) => `${P}Page2[0].SectionBTable2[0].Line${line}[0].${n}[${i}]`;
  const [c34, c35, c36] = n25 ? ['c2_4', 'c2_10', 'c2_16'] : ['c2_3', 'c2_9', 'c2_15'];
  return {
    file: 'f4562.pdf',
    lines: {
      '17': s(1, 'f1_25'), '22': n25 ? s(2, 'f2_2') : s(1, 'f1_108'),
      '30': v(30, n25 ? 'f2_59' : 'f2_55'), '31': v(31, n25 ? 'f2_65' : 'f2_61'), '32': v(32, n25 ? 'f2_71' : 'f2_67'), '33': v(33, n25 ? 'f2_77' : 'f2_73'),
    },
    row20a: n25 ? ['f1_98', 'f1_99', 'f1_100', 'f1_101', 'f1_103'].map(r20) : ['R11', 'f1_85', 'f1_86', 'f1_87', 'f1_89'].map(r20),
    // Part V Section A columns (a)-(c), first row of line 26 (over 50% business use) and line 27 (50% or less).
    row26: (n25 ? ['f2_6', 'f2_7', 'f2_8'] : ['f2_2', 'f2_3', 'f2_4']).map((n) => `${P}Page2[0].Table_Ln26[0].BodyRow1[0].${n}[0]`),
    row27: (n25 ? ['f2_33', 'f2_34', 'f2_35'] : ['f2_29', 'f2_30', 'f2_31']).map((n) => `${P}Page2[0].Table_Ln27[0].BodyRow1[0].${n}[0]`),
    text: { name: s(1, 'f1_1'), activity: s(1, 'f1_2'), ssn: s(1, 'f1_3') },
    checks: {
      evidenceYes: [`${P}Page2[0].c2_1[0]`, '1'], evidenceNo: [`${P}Page2[0].c2_1[1]`, '2'],
      writtenYes: [`${P}Page2[0].c2_2[0]`, '1'], writtenNo: [`${P}Page2[0].c2_2[1]`, '2'],
      personalUseYes: [yn(34, c34, 0), '1'], personalUseNo: [yn(34, c34, 1), '2'],
      ownerUseYes: [yn(35, c35, 0), '1'], ownerUseNo: [yn(35, c35, 1), '2'],
      anotherVehicleYes: [yn(36, c36, 0), '1'], anotherVehicleNo: [yn(36, c36, 1), '2'],
    },
  };
}
export const F4562_2025 = f4562Map(2025);

/** Schedule 2 line 4 when self-employment income is exempt under a totalization agreement. */
export interface SeExemptMap { check?: [string, string]; text?: string; draw?: { x: number; y: number } }
export const SCH2_SE_EXEMPT: Record<2023 | 2024 | 2025, SeExemptMap> = {
  // 2025: check box 3 and write the reason beside it.
  2025: { check: ['form1[0].Page1[0].Line4_ReadOrder[0].c1_5[0]', '1'], text: 'form1[0].Page1[0].Line4_ReadOrder[0].f1_14[0]' },
  // 2023/2024 have no box: the words go on line 4 itself (drawn on the dotted leader, left of the amount column).
  2024: { draw: { x: 330, y: 326 } },
  2023: { draw: { x: 330, y: 578 } },
};

export const FORMS_2025 = { F1040_2025, F6251_2025, SCHC_2025, F4562_2025, SCH1_2025, SCH1A_2025, SCH2_2025, SCH3_2025, SCH8812_2025, F1116_2025, F2555_2025, F8833, F8938, SCH1116B };
