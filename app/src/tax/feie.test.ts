import { describe, expect, it } from 'vitest';
import { bonaFide, housingPart6, physicalPresence } from './feie';
import { computeReturn } from './compute';
import type { ReturnInput } from './model';
import { emptyFeie2555 } from './model';

describe('physical presence test (330 full days in 12 months)', () => {
  it('first year: the 12-month period can start 35 days before the first full day', () => {
    // Arrived July 1, 2024 (first full day July 2). July 2, 2024 - May 27, 2025 = 183 + 147 = 330 full days,
    // so the period May 28, 2024 - May 27, 2025 qualifies; 2024 days in it = 4 + 30 + 184 = 218.
    const r = physicalPresence(2024, '2024-07-01', []);
    expect(r).toMatchObject({ qualifies: true, start: '2024-05-28', end: '2025-05-27', fullDays: 330, daysInTaxYear: 218 });
  });
  it('picks the period that avoids a second US trip', () => {
    // Two 20-day trips in 2025. Starting March 6 keeps 15 March days + 20 August days away = 330 full days,
    // with March 6 - December 31 = 301 days in 2025 (a later start gives fewer 2025 days).
    const r = physicalPresence(2025, '2020-01-01', [
      { arrived: '2025-03-01', left: '2025-03-20', businessDays: 0 }, { arrived: '2025-08-01', left: '2025-08-20', businessDays: 0 },
    ], undefined, '2026-10-04');
    expect(r).toMatchObject({ qualifies: true, start: '2025-03-06', daysInTaxYear: 301, fullDays: 330 });
  });
  it('a whole year abroad covers all 365 days', () => {
    expect(physicalPresence(2025, '2019-06-01', [{ arrived: '2025-07-01', left: '2025-07-10', businessDays: 2 }]).daysInTaxYear).toBe(365);
  });
  it('fails with too little time abroad', () => {
    // Arrived March 1, 2025 and it is now December 31, 2025: 305 full days so far.
    const r = physicalPresence(2025, '2025-03-01', [], undefined, '2025-12-31');
    expect(r.qualifies).toBe(false);
    expect(r.fullDays).toBeLessThan(330);
  });
});

describe('bona fide residence', () => {
  it('full year', () => expect(bonaFide(2025, '2018-04-01')).toEqual({ qualifies: true, daysInTaxYear: 365 }));
  it('i2555 line 31 example: residence from August 14 counts 140 days once the next year is complete', () => {
    expect(bonaFide(2025, '2025-08-14', '2027-02-01')).toEqual({ qualifies: true, daysInTaxYear: 140 });
    expect(bonaFide(2025, '2025-08-14', '2026-10-04')).toEqual({ qualifies: false, daysInTaxYear: 140, waitForNextYear: true });
  });
});

describe('housing (Form 2555 Part VI)', () => {
  it('i2555 line 29b example: 276 days at $106.85 = $29,491 (unlisted location)', () => {
    expect(housingPart6(2025, { expensesUsd: 40000, location: '' }, 276, 100000, 100000)['29b']).toBe(29491);
  });
  it('uses the Toronto limit from Notice 2025-16 for a full year', () => {
    const L = housingPart6(2025, { expensesUsd: 60000, location: 'Toronto' }, 365, 100000, 100000);
    expect(L['29b']).toBe(57400);
    expect(L['30']).toBe(57400);
    expect(L['32']).toBe(20800);
    expect(L['33']).toBe(36600);
    expect(L['36']).toBe(36600);
  });
  it('Pub 54 example: half of the housing amount is employer-provided', () => {
    // Housing amount 18,000 (38,800 expenses - 20,800 base); foreign earned income 100,000, wages 50,000 -> exclude 9,000.
    const L = housingPart6(2025, { expensesUsd: 38800, location: '' }, 365, 100000, 50000);
    expect(L['33']).toBe(18000);
    expect(L['35']).toBe(0.5);
    expect(L['36']).toBe(9000);
  });
});

describe('Form 2555 inside a return', () => {
  const base: ReturnInput = {
    year: 2025, filingStatus: 'single',
    taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
    dependents: [], address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
    slips: [{ id: 't4', type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: { '14': 250000 } }],
    assessments: [{ owner: 'taxpayer', totalIncome: 250000, netIncome: 250000, netFederalTax: 40000, provincialTax: 25000 }],
    elections: { feie: 'yes', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    feieFacts: { bonaFideResident: true, residenceStart: '2015-01-01', daysInUs: 0 },
    feie2555: { taxpayer: { ...emptyFeie2555(), residenceStart: '2015-01-01', filedBefore: false, quarters: 'rented', familyWithYou: false, status: 'citizen', visaLimited: false,
      housing: { expensesCad: 50000, location: 'Toronto' } } },
  };
  it('adds the housing exclusion to the earned income exclusion', () => {
    const r = computeReturn(base).best;
    const L = r.f2555[0].lines;
    // Wages 250,000 / 1.398 = 178,827. Housing 50,000 / 1.398 = 35,765; limit 57,400; base 20,800 -> 14,965;
    // all employer-provided (line 35 = 1.000) -> line 36 14,965. Line 41 = 178,827 - 14,965 = 163,862; line 42 = 130,000.
    expect(L['27']).toBe(178827);
    expect(L['28']).toBe(35765);
    expect(L['33']).toBe(14965);
    expect(L['36']).toBe(14965);
    expect(L['42']).toBe(130000);
    expect(L['43']).toBe(144965);
    expect(r.schedule1['8d']).toBe(-144965);
  });
  it('physical presence test with a partial year prorates the exclusion', () => {
    const r = computeReturn({ ...base, year: 2024, slips: base.slips,
      feie2555: { taxpayer: { ...base.feie2555!.taxpayer!, test: 'ppt', residenceStart: '2024-07-01', housing: undefined } } }).best;
    const L = r.f2555[0].lines;
    // 218 qualifying days in 2024 (a leap year): 218 / 366 = 0.596 -> 126,500 x 0.596 = 75,394.
    expect(L['38']).toBe(218);
    expect(L['39']).toBe(0.596);
    expect(L['40']).toBe(75394);
    expect(r.f2555[0].ppt?.start).toBe('2024-05-28');
  });
});
