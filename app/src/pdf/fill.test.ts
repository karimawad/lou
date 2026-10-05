import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { computeReturn } from '../tax/compute';
import type { ReturnInput } from '../tax/model';
import type { ForeignAccount } from '../tax/accounts';
import { F1040_2025, F1116_2025, F2555_2025, F8833, F8833_EXPLANATION, SCH1_2025 } from './maps2025';
import { fillReturn, fillReturn2025, mergeForms, wrapText, YEAR_MAPS } from './fill';

const PUBLIC = resolve(__dirname, '../../public');
const load = async (p: string) => { const b = readFileSync(PUBLIC + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

const input: ReturnInput = {
  year: 2025, filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01', occupation: 'Engineer' },
  dependents: [],
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  slips: [
    { id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 100000, '22': 22000 } },
    { id: 't5', type: 'T5', owner: 'taxpayer', payer: 'RBC', boxes: { '13': 1000, '24': 2000 }, answers: { dividendSource: 'company', metHoldingPeriod: true } },
  ],
  assessments: [{ owner: 'taxpayer', totalIncome: 103760, netIncome: 103760, netFederalTax: 13000, provincialTax: 7000 }],
  elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
};

async function value(bytes: Uint8Array, name: string) {
  const doc = await PDFDocument.load(bytes);
  const f = doc.getForm().getField(name);
  return f instanceof PDFTextField ? f.getText() : undefined;
}

describe('fillReturn2025', () => {
  it('fills the official PDFs with the computed values', async () => {
    const r = computeReturn(input).best;
    const forms = await fillReturn2025(input, r, load);
    expect(forms.map((f) => f.id)).toEqual(['1040', 'sch3', 'schB', '1116-passive', '1116sb-passive', '1116-general', '1116sb-general']);
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/1116sb-general.pdf'), forms.find((f) => f.id === '1116sb-general')!.bytes);
    const f1040 = forms[0].bytes;
    expect(await value(f1040, F1040_2025.lines['1h'])).toBe('71,531');
    expect(await value(f1040, F1040_2025.lines['16'])).toBe('7,554');
    expect(await value(f1040, F1040_2025.lines['20'])).toBe('7,554');
    expect(await value(f1040, F1040_2025.lines['24'])).toBe('0');
    expect(await value(f1040, F1040_2025.text.ssn)).toBe('123456789');
    const general = forms.find((f) => f.id === '1116-general')!.bytes;
    expect(await value(general, F1116_2025.lines['3f'])).toBe('0.9709');
    expect(await value(general, F1116_2025.lines['35'])).toBe('7,554');

    // Write outputs for visual inspection (research/render_check).
    const dir = resolve(__dirname, '../../../research/render_check/filled');
    mkdirSync(dir, { recursive: true });
    for (const f of forms) writeFileSync(`${dir}/${f.id}.pdf`, f.bytes);
    writeFileSync(`${dir}/combined.pdf`, await mergeForms(forms));
  }, 60000);
});

describe('spouse with no SSN or ITIN', () => {
  const spouse = { firstName: 'Ana', lastName: 'Roy', ssn: '', dateOfBirth: '1986-02-01' };
  const spouseBox = async (patch: Partial<ReturnInput>) => {
    const i = { ...input, spouse, ...patch };
    const forms = await fillReturn2025(i, computeReturn(i).best, load);
    return value(forms[0].bytes, F1040_2025.text.spouseSsn);
  };
  it('prints NRA on a separate return with a nonresident spouse (i1040)', async () => {
    expect(await spouseBox({ filingStatus: 'mfs', spouseIsUsPerson: false })).toBe('NRA');
  }, 60000);
  it('leaves the box blank on a joint return, for Form W-7 (iW7)', async () => {
    expect(await spouseBox({ filingStatus: 'mfj', spouseIsUsPerson: false })).toBeFalsy();
  }, 60000);
  it('never prints NRA for a US-person spouse', async () => {
    expect(await spouseBox({ filingStatus: 'mfs', spouseIsUsPerson: true })).toBeFalsy();
  }, 60000);
});

describe('Form 2555', () => {
  it('fills Parts I, II, IV, VII and VIII for the exclusion', async () => {
    const feieInput: ReturnInput = {
      ...input,
      slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 150000 } }],
      assessments: [{ owner: 'taxpayer', totalIncome: 150000, netIncome: 150000, netFederalTax: 24000, provincialTax: 14000 }],
      elections: { feie: 'yes', canadianSocialSecurityExempt: true, useAdjustmentException: true },
      feieFacts: { bonaFideResident: true, residenceStart: '2015-06-01', daysInUs: 6 },
      feie2555: { taxpayer: {
        employerAddress: '100 King St W, Toronto, ON', employerType: 'foreign', filedBefore: false, priorYear: '', revoked: false,
        revokedDetail: '', residenceStart: '2015-06-01', quarters: 'rented', familyWithYou: false, familyWho: '', status: 'pr',
        statusOther: '', visaLimited: false, usHome: false, usHomeAddress: '', trips: [{ arrived: '2025-07-01', left: '2025-07-06', businessDays: 0 }],
      } },
    };
    const r = computeReturn(feieInput).best;
    expect(r.usedFeie).toBe(true);
    expect(r.flags.filter((f) => f.id.startsWith('2555'))).toEqual([]);
    const forms = await fillReturn2025(feieInput, r, load);
    expect(forms.map((f) => f.id)).toContain('2555-taxpayer');
    const f2555 = forms.find((f) => f.id === '2555-taxpayer')!.bytes;
    // 150,000 / 1.398 = 107,296; under the 130,000 cap, so the whole amount is excluded.
    expect(await value(f2555, F2555_2025.lines['19'])).toBe('107,296');
    expect(await value(f2555, F2555_2025.lines['42'])).toBe('107,296');
    expect(await value(f2555, F2555_2025.lines['45'])).toBe('107,296');
    expect(await value(f2555, F2555_2025.lines['37'])).toBe('130,000');
    expect(await value(f2555, F2555_2025.text.residenceBegan)).toBe('06/01/2015');
    expect(await value(f2555, F2555_2025.text.visa)).toBe('Canadian permanent resident');
    const sch1 = forms.find((f) => f.id === 'sch1')!.bytes;
    expect(await value(sch1, SCH1_2025.lines['8d'])).toBe('107,296');
    const dir = resolve(__dirname, '../../../research/render_check/filled');
    writeFileSync(`${dir}/2555.pdf`, f2555);
  }, 60000);
});

describe('Form 8833 (CPP/OAS treaty position)', () => {
  it('is included last, with the excluded benefits explained', async () => {
    const cppInput: ReturnInput = {
      ...input,
      slips: [...input.slips,
        { id: 'cpp', type: 'T4AP', owner: 'taxpayer', payer: 'Service Canada', boxes: { '20': 12000 } },
        { id: 'oas', type: 'T4AOAS', owner: 'taxpayer', payer: 'Service Canada', boxes: { '18': 8500 } }],
    };
    const r = computeReturn(cppInput).best;
    const forms = await fillReturn2025(cppInput, r, load);
    expect(forms.at(-1)!.id).toBe('8833-taxpayer');
    const bytes = forms.at(-1)!.bytes;
    expect(await value(bytes, F8833.text.treatyCountry)).toBe('Canada');
    expect(await value(bytes, F8833.text.articles)).toBe('XVIII(5); XXIX(3)(a)');
    const lines = await Promise.all(F8833_EXPLANATION.map((n) => value(bytes, n)));
    const text = lines.filter(Boolean).join(' ');
    expect(text).toContain('Canada Pension Plan benefits CA$12,000 (US$8,584)');
    expect(text).toContain('Old Age Security CA$8,500');
    expect(text).toContain('301.6114-1(c)(1)(iv)');
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/8833.pdf'), bytes);
  }, 60000);
});

describe('wrapText', () => {
  it('wraps on word boundaries with a narrower first line', () => {
    expect(wrapText('aaa bbb ccc ddd', 7, 11)).toEqual(['aaa bbb', 'ccc ddd']);
  });
});

describe('Form 8938', () => {
  it('lists each account on its own page 2 when over the abroad threshold', async () => {
    const acct = (kind: ForeignAccount['kind'], max: number, end: number, n: string) => ({
      id: n, owner: 'taxpayer' as const, kind, institution: 'RBC Royal Bank', street: '200 Bay St', city: 'Toronto', province: 'ON',
      postalCode: 'M5J 2J5', accountNumber: n, maxValueCad: max, yearEndValueCad: end, opened: false, closed: false,
    });
    const accInput: ReturnInput = { ...input, accounts: [
      acct('bank', 40000, 30000, '111'), acct('rrsp', 200000, 210000, '222'), acct('tfsa', 60000, 65000, '333'), acct('pension', 150000, 150000, '444'),
    ] };
    const r = computeReturn(accInput).best;
    const forms = await fillReturn2025(accInput, r, load);
    const f8938 = forms.find((f) => f.id === '8938')!;
    expect(f8938).toBeTruthy();
    const doc = await PDFDocument.load(f8938.bytes);
    expect(doc.getPageCount()).toBe(4); // page 1 + three page-2 copies (3 accounts; the pension shares page 2 #1)
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/8938.pdf'), f8938.bytes);
  }, 60000);
});

describe('prior years', () => {
  for (const year of [2024, 2023] as const) {
    it(`fills the official ${year} forms`, async () => {
      const y: ReturnInput = { ...input, year, slips: input.slips, assessments: input.assessments };
      const r = computeReturn(y).best;
      const forms = await fillReturn(y, r, load);
      expect(forms.map((f) => f.id)).toEqual(['1040', 'sch3', 'schB', '1116-passive', '1116sb-passive', '1116-general', '1116sb-general']);
      const maps = YEAR_MAPS[year];
      const f1040 = forms[0].bytes;
      expect(await value(f1040, maps.F1040.lines['1h'])).toBe(r.f1040['1h'].toLocaleString('en-US'));
      expect(await value(f1040, maps.F1040.lines['11a'])).toBe(r.f1040['11a'].toLocaleString('en-US'));
      expect(await value(f1040, maps.F1040.lines['12e'])).toBe(r.f1040['12e'].toLocaleString('en-US'));
      expect(await value(f1040, maps.F1040.lines['20'])).toBe(r.f1040['20'].toLocaleString('en-US'));
      const dir = resolve(__dirname, '../../../research/render_check/filled');
      writeFileSync(`${dir}/combined-${year}.pdf`, await mergeForms(forms));
    }, 60000);
  }
});

describe('Form 6251', () => {
  const high = (year: 2025 | 2024): ReturnInput => ({
    ...input, year,
    slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 400000 }, year }],
    assessments: [{ owner: 'taxpayer', totalIncome: 400000, netIncome: 400000, netFederalTax: 70000, provincialTax: 45000 }],
  });

  it('is attached, with its AMT Form 1116, when line 7 is more than line 10 (2025)', async () => {
    const r = computeReturn(high(2025)).best;
    const forms = await fillReturn(high(2025), r, load);
    const ids = forms.map((f) => f.id);
    // Sequence: 1116 (19) before 6251 (32); the AMT Form 1116 goes right after Form 6251.
    expect(ids.indexOf('6251')).toBeGreaterThan(ids.indexOf('1116-general'));
    expect(ids[ids.indexOf('6251') + 1]).toBe('1116amt-general');
    const M = YEAR_MAPS[2025].F6251;
    const f6251 = forms.find((f) => f.id === '6251')!.bytes;
    expect(await value(f6251, M.lines['4'])).toBe('286,123');
    expect(await value(f6251, M.lines['7'])).toBe('51,486');
    expect(await value(f6251, M.lines['8'])).toBe('51,486');
    expect(await value(f6251, M.lines['11'])).toBe('0');
    const amt1116 = forms.find((f) => f.id === '1116amt-general')!.bytes;
    expect(await value(amt1116, F1116_2025.lines['18'])).toBe('286,123');
    expect(await value(amt1116, F1116_2025.lines['35'])).toBe('51,486');
    const dir = resolve(__dirname, '../../../research/render_check/filled');
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/6251-2025.pdf`, await mergeForms(forms.filter((f) => f.id === '6251' || f.id === '1116amt-general')));
  });

  it('uses the 2024 form (line 1 instead of 1a/1b)', async () => {
    const r = computeReturn(high(2024)).best;
    const forms = await fillReturn(high(2024), r, load);
    const f6251 = forms.find((f) => f.id === '6251')!.bytes;
    // 400,000 / 1.370 = 291,971; line 1 = 291,971 - 14,600 = 277,371.
    expect(await value(f6251, YEAR_MAPS[2024].F6251.lines['1'])).toBe('277,371');
    expect(await value(f6251, YEAR_MAPS[2024].F6251.lines['4'])).toBe('291,971');
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/6251-2024.pdf'), f6251);
  });

  it('is left out for a typical salary', async () => {
    const forms = await fillReturn(input, computeReturn(input).best, load);
    expect(forms.some((f) => f.id === '6251')).toBe(false);
  });
});

describe('Schedule C and Form 4562', () => {
  const biz: ReturnInput = {
    ...input, slips: [],
    assessments: [{ owner: 'taxpayer', totalIncome: 100000, netIncome: 100000, netFederalTax: 12000, provincialTax: 6000 }],
    businesses: [{
      id: 'b1', owner: 'taxpayer', name: 'Lee Design', activity: 'Graphic design', code: '541430', accounting: 'cash',
      grossCad: 120000, returnsCad: 0, cogsCad: 0, otherIncomeCad: 0, expensesCad: { '8': 1000, '17': 1500, '18': 2000, '27b': 300 },
      otherDescription: 'Software subscriptions', mealsCad: 800,
      vehicle: { businessKm: 5000, commutingKm: 0, totalKm: 15000, parkingTollsCad: 200, placedInService: '2021-06-01', personalUseAvailable: true, anotherVehicle: false, evidence: true, writtenEvidence: true },
      homeOffice: { homeSqM: 100, officeSqM: 10, regularExclusive: true },
      assets: [
        { description: 'Laptop', kind: 'computer', costCad: 2200, placedInService: '2025-03-14', businessUsePct: 100 },
        { description: 'Camera', kind: 'computer', costCad: 6000, placedInService: '2025-11-20', businessUsePct: 100 },
      ],
      deMinimis: true, capitalMaterial: false, materiallyParticipated: true,
    }],
  };
  for (const year of [2025, 2024, 2023] as const) {
    it(`fills Schedule C, Form 4562 and the statements (${year})`, async () => {
      const inp: ReturnInput = { ...biz, year, businesses: biz.businesses!.map((b) => ({ ...b, assets: b.assets.map((a) => ({ ...a, placedInService: `${year}${a.placedInService.slice(4)}` })) })) };
      const r = computeReturn(inp).best;
      const forms = await fillReturn(inp, r, load);
      const ids = forms.map((f) => f.id);
      expect(ids).toEqual(expect.arrayContaining(['sch1', 'sch2', 'schC-b1', '4562-b1', '4562stmt-b1', 'deminimis', 'se-statement']));
      expect(ids.indexOf('schC-b1')).toBeGreaterThan(ids.indexOf('schB'));
      const M = YEAR_MAPS[year];
      const sc = forms.find((f) => f.id === 'schC-b1')!.bytes;
      expect(await value(sc, M.SCHC.lines['31'])).toBe(r.scheduleC[0].lines['31'].toLocaleString('en-US'));
      expect(await value(sc, M.SCHC.lines['27b'])).toBe(r.scheduleC[0].lines['27b'].toLocaleString('en-US'));
      expect(await value(sc, M.SCHC.text.officeSqFt)).toBe('108');
      expect(await value(sc, M.SCHC.text.milesBusiness)).toBeUndefined(); // vehicle goes on Form 4562 Part V
      const f4562 = forms.find((f) => f.id === '4562-b1')!.bytes;
      expect(await value(f4562, M.F4562.lines['22'])).toBe(r.scheduleC[0].lines['13'].toLocaleString('en-US'));
      expect(await value(f4562, M.F4562.lines['30'])).toBe('3,107');
      const dir = resolve(__dirname, '../../../research/render_check/filled');
      writeFileSync(`${dir}/schc-${year}.pdf`, await mergeForms(forms.filter((f) => ['sch2', 'schC-b1', '4562-b1', '4562stmt-b1', 'deminimis', 'se-statement'].includes(f.id))));
    }, 60000);
  }
});

describe('Form 2555 housing and physical presence', () => {
  const feieInput = (over: Partial<ReturnInput>): ReturnInput => ({
    ...input, slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 250000 } }],
    assessments: [{ owner: 'taxpayer', totalIncome: 250000, netIncome: 250000, netFederalTax: 40000, provincialTax: 25000 }],
    elections: { feie: 'yes', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    feieFacts: { bonaFideResident: true, residenceStart: '2015-01-01', daysInUs: 0 },
    ...over,
  });
  const details = { employerAddress: '100 King St W, Toronto', employerType: 'foreign' as const, filedBefore: false, priorYear: '', revoked: false, revokedDetail: '',
    residenceStart: '2015-01-01', quarters: 'rented' as const, familyWithYou: false, familyWho: '', status: 'citizen' as const, statusOther: '', visaLimited: false,
    usHome: false, usHomeAddress: '', trips: [] };

  it('fills Part VI (Toronto housing) and the exclusion', async () => {
    const inp = feieInput({ feie2555: { taxpayer: { ...details, housing: { expensesCad: 50000, location: 'Toronto' } } } });
    const r = computeReturn(inp).best;
    const forms = await fillReturn(inp, r, load);
    const f = forms.find((x) => x.id === '2555-taxpayer')!.bytes;
    expect(await value(f, F2555_2025.lines['36'])).toBe('14,965');
    expect(await value(f, F2555_2025.lines['43'])).toBe('144,965');
    expect(await value(f, F2555_2025.text.housingLocation)).toBe('Toronto, Canada');
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/2555-housing.pdf'), f);
  }, 60000);

  it('fills Part III (physical presence) with the travel table, and leaves Part II empty', async () => {
    const inp = feieInput({ year: 2024, asOf: '2026-10-04', feie2555: { taxpayer: { ...details, test: 'ppt', residenceStart: '2024-07-01',
      trips: [{ arrived: '2024-11-22', left: '2024-11-26', businessDays: 1 }] } } });
    const r = computeReturn(inp).best;
    const forms = await fillReturn(inp, r, load);
    const f = forms.find((x) => x.id === '2555-taxpayer')!.bytes;
    expect(await value(f, F2555_2025.text.pptCountry)).toBe('Canada');
    expect(await value(f, F2555_2025.text.residenceBegan)).toBeUndefined();
    writeFileSync(resolve(__dirname, '../../../research/render_check/filled/2555-ppt.pdf'), f);
  }, 60000);
});

describe('capital gains, PFIC and TFSA forms', () => {
  for (const year of [2025, 2023] as const) {
    it(`fills Schedule D, Form 8949, Form 8621 and the Form 3520 package (${year})`, async () => {
      const inp: ReturnInput = {
        ...input, year, slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 100000 } }],
        assessments: [{ owner: 'taxpayer', totalIncome: 110000, netIncome: 110000, netFederalTax: 15000, provincialTax: 9000 }],
        sales: [
          { id: 's1', owner: 'taxpayer', description: '100 sh Royal Bank', acquired: '2019-03-15', sold: `${year}-06-02`, proceedsCad: 17500, costCad: 9800 },
          { id: 's2', owner: 'taxpayer', description: '50 sh Shopify', acquired: `${year}-01-10`, sold: `${year}-05-20`, proceedsCad: 4000, costCad: 5000 },
        ],
        pficFunds: [{ id: 'f1', owner: 'taxpayer', name: 'Maple Balanced Fund', account: 'taxable', regime: '1291', acquired: '2018-06-01', sharesYearEnd: 1000,
          valueYearEndCad: 40000, distributions: [{ date: `${year}-12-15`, amountCad: 1000 }], priorDistributionsCad: [400, 400, 400] }],
        accounts: [{ id: 'a1', owner: 'taxpayer', kind: 'tfsa', institution: 'RBC Direct Investing', street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J5',
          accountNumber: '555', maxValueCad: 60000, yearEndValueCad: 58000, opened: false, closed: false,
          registered: { openedDate: '2015-03-01', startValueCad: 50000, contributionsCad: 7000, withdrawalsCad: 2000, interestCad: 300, companyDividendsCad: 1200,
            dividendsQualified: true, holdsInvestments: true, file3520: true } }],
      };
      const r = computeReturn(inp).best;
      const forms = await fillReturn(inp, r, load);
      const ids = forms.map((f) => f.id);
      expect(ids).toEqual(expect.arrayContaining(['schD', '8949', '8949stmt', '8621-f1', '8621stmt-f1', '3520-a1', '3520a-a1', '3520stmt-a1']));
      expect(ids.indexOf('schD')).toBeLessThan(ids.indexOf('8949'));
      expect(forms.filter((f) => f.packet === '3520').map((f) => f.id)).toEqual(['3520-a1', '3520a-a1', '3520stmt-a1']);
      const sd = forms.find((f) => f.id === 'schD')!.bytes;
      expect(await value(sd, YEAR_MAPS[year].SCH1.file ? (await import('./mapsIntl')).schDMap(year).lines['16'] : '')).toBe(r.scheduleD!.lines['16'].toLocaleString('en-US'));
      const f1040 = forms[0].bytes;
      expect(await value(f1040, YEAR_MAPS[year].F1040.text.line16Other)).toBe('1291TAX');
      const dir = resolve(__dirname, '../../../research/render_check/filled');
      writeFileSync(`${dir}/intl-${year}.pdf`, await mergeForms(forms.filter((f) => ['schD', '8949', '8621-f1', '8621stmt-f1', '3520-a1', '3520a-a1', 'sch2'].includes(f.id))));
    }, 90000);
  }
});

describe('Form 3520 package without withdrawals', () => {
  it('drops the beneficiary statement page and still merges', async () => {
    const inp: ReturnInput = {
      ...input, accounts: [{ id: 'a1', owner: 'taxpayer', kind: 'tfsa', institution: 'RBC', street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J5',
        accountNumber: '1', maxValueCad: 10000, yearEndValueCad: 10000, opened: false, closed: false,
        registered: { openedDate: '2020-01-01', startValueCad: 9000, contributionsCad: 1000, withdrawalsCad: 0, interestCad: 50, companyDividendsCad: 0, dividendsQualified: true, holdsInvestments: false, file3520: true } }],
    };
    const forms = await fillReturn(inp, computeReturn(inp).best, load);
    const pkt = forms.filter((f) => f.packet === '3520');
    expect((await PDFDocument.load(pkt.find((f) => f.id === '3520a-a1')!.bytes)).getPageCount()).toBe(4);
    expect((await PDFDocument.load(await mergeForms(pkt))).getPageCount()).toBe(11);
  }, 60000);
});
