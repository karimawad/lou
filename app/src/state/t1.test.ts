import { describe, expect, it } from 'vitest';
import { computeReturn } from '../tax/compute';
import { initialState, switchYear, type AppState, type SlipRecord } from './store';
import { deriveFromT1, incomeSlips, withSlipAnswer } from './t1';
import { toReturnInput } from './toInput';

const slip = (id: string, over: Partial<SlipRecord>): SlipRecord => ({
  id, type: 'T4', owner: 'taxpayer', payer: 'Maple Co', year: 2025, boxes: {}, reads: {}, edited: [], confirmed: true, ...over,
});
const TAX = { '23600': 104000, '26000': 104000, '42000': 13000, '42800': 7000 };
/** A consistent T1: line 15000 is the sum of the income lines (12010 is part of 12000), unless given. */
const t1 = (boxes: Record<string, number>, over: Partial<SlipRecord> = {}) => {
  const total = Object.entries(boxes).filter(([k]) => k !== '12010').reduce((a, [, v]) => a + v, 0);
  return slip('t1', { type: 'NOA', payer: 'T1 return', boxes: { ...TAX, '15000': Math.round(total * 100) / 100, ...boxes }, ...over });
};

function household(slips: SlipRecord[], over: Partial<AppState> = {}): AppState {
  const s = switchYear({
    ...initialState(),
    taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
    address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
  }, 2025);
  return { ...s, filingStatus: 'single', livedInCanadaAllYear: true, noAccounts: true, slips,
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true }, ...over };
}

describe('income from a T1 return', () => {
  it('makes slips for lines no slip feeds; dividends lose the Canadian gross-up (138% / 115%)', () => {
    // 1,000 eligible + 100 other actual dividends: taxable 1,380 + 115 = 1,495 on line 12000, 115 on 12010.
    const d = deriveFromT1(household([t1({ '10100': 100000, '12100': 39.42, '12900': 453, '12000': 1495, '12010': 115 })]));
    expect(Object.fromEntries(d.slips.map((s) => [s.fromT1Line, { type: s.type, boxes: s.boxes }]))).toEqual({
      '10100': { type: 'T4', boxes: { '14': 100000 } },
      '12100': { type: 'T5', boxes: { '13': 39.42 } },
      '12900': { type: 'T4RSP', boxes: { '22': 453 } },
      '12000': { type: 'T5', boxes: { '24': 1000, '10': 100 } },
    });
    expect(d.flags).toEqual([]);
  });

  it('uses the slips when they exist, and flags a T1 total they do not add up to', () => {
    const match = deriveFromT1(household([t1({ '10100': 100000 }), slip('t4', { boxes: { '14': 100000 } })]));
    expect(match.slips).toEqual([]);
    expect(match.flags).toEqual([]);
    const missing = deriveFromT1(household([t1({ '10100': 150000 }), slip('t4', { boxes: { '14': 100000 } })]));
    expect(missing.slips).toEqual([]);
    expect(missing.flags.map((f) => [f.id, f.severity])).toEqual([['t1-check-t1-10100', 'warn']]);
  });

  it("doesn't let a spouse's slip stand in for the taxpayer's T1 line", () => {
    const d = deriveFromT1(household([t1({ '10100': 100000 }), slip('t4s', { owner: 'spouse', boxes: { '14': 100000 } })]));
    expect(d.slips.map((s) => [s.fromT1Line, s.owner])).toEqual([['10100', 'taxpayer']]);
  });

  it('asks for the sales behind capital gains, unless they are T3/T5 capital gains dividends', () => {
    expect(deriveFromT1(household([t1({ '12700': 500 })])).flags.map((f) => f.severity)).toEqual(['block']);
    expect(deriveFromT1(household([t1({ '12700': 500 }), slip('t3', { type: 'T3', boxes: { '21': 1000 } })])).flags).toEqual([]);
    expect(deriveFromT1(household([t1({ '12700': 500 })], { sales: [{ id: 's', owner: 'taxpayer', description: 'x', acquired: '2020-01-02', sold: '2025-03-03', proceedsCad: 2000, costCad: 1000 }] })).flags).toEqual([]);
  });

  it("flags a T1 whose income lines don't add up to line 15000 (a missed or misread line)", () => {
    const d = deriveFromT1(household([t1({ '10100': 100000, '15000': 100500 })]));
    expect(d.flags.map((f) => [f.id, f.severity])).toEqual([['t1-total-t1', 'block']]);
  });

  it('stores answers on the T1, and the RRSP answer picks the T4RSP box', () => {
    let s = household([t1({ '12900': 453 })]);
    const rrsp = incomeSlips(s).find((x) => x.fromT1Line === '12900')!;
    s = withSlipAnswer(s, rrsp, { rrspKind: 'annuity', usBasisCad: 50 });
    expect(s.slips[0].derivedAnswers).toEqual({ '12900': { rrspKind: 'annuity', usBasisCad: 50 } });
    const again = incomeSlips(s).find((x) => x.fromT1Line === '12900')!;
    expect(again.boxes).toEqual({ '16': 453 });
    expect(again.answers).toEqual({ rrspKind: 'annuity', usBasisCad: 50 });
  });

  it('gives the same US return as uploading the slips themselves', () => {
    const fromT1 = household([t1({ '10100': 100000, '12100': 400, '12900': 2000 }, { derivedAnswers: { '12900': { rrspKind: 'withdrawal' } } })]);
    const fromSlips = household([
      t1({}),
      slip('t4', { boxes: { '14': 100000 } }),
      slip('t5', { type: 'T5', payer: 'Bank', boxes: { '13': 400 } }),
      slip('rsp', { type: 'T4RSP', payer: 'Bank', boxes: { '22': 2000 } }),
    ]);
    const a = computeReturn(toReturnInput(fromT1)!).best;
    const b = computeReturn(toReturnInput(fromSlips)!).best;
    expect(a.f1040).toEqual(b.f1040);
    expect(a.f1040['1h']).toBeGreaterThan(0);
  });
});
