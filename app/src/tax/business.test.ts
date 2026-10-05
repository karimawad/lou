import { describe, expect, it } from 'vitest';
import { adsFraction, computeScheduleC, type Business } from './business';
import { computeReturn } from './compute';
import { dailyRate } from './fx';
import type { ReturnInput } from './model';

describe('ADS straight line (Pub 946, Appendix A)', () => {
  it('half-year convention, 5-year property (Table A-8: 10, 20, 20, 20, 20, 10%)', () => {
    expect([2025, 2026, 2027, 2028, 2029, 2030, 2031].map((y) => adsFraction(5, 2025, 2, 'HY', y))).toEqual([0.1, 0.2, 0.2, 0.2, 0.2, 0.1, 0]);
  });
  it('mid-quarter convention, 5-year property placed in Q4 (Table A-12: 2.5% first year, 17.5% last)', () => {
    const f = [2025, 2026, 2027, 2028, 2029, 2030].map((y) => adsFraction(5, 2025, 4, 'MQ', y));
    expect(f[0]).toBeCloseTo(0.025, 10);
    expect(f[1]).toBeCloseTo(0.2, 10);
    expect(f[5]).toBeCloseTo(0.175, 10);
  });
  it('mid-quarter, 10-year property placed in Q1 (Table A-9: 8.75% first year)', () => {
    expect(adsFraction(10, 2024, 1, 'MQ', 2024)).toBeCloseTo(0.0875, 10);
  });
});

const designer = (over: Partial<Business> = {}): Business => ({
  id: 'b1', owner: 'taxpayer', name: 'Lee Design', activity: 'Graphic design', code: '541430', accounting: 'cash',
  grossCad: 120000, returnsCad: 0, cogsCad: 0, otherIncomeCad: 0,
  expensesCad: { '8': 1000, '17': 1500, '18': 2000 }, mealsCad: 800,
  vehicle: { businessKm: 5000, commutingKm: 0, totalKm: 15000, parkingTollsCad: 200, placedInService: '2021-06-01',
    personalUseAvailable: true, anotherVehicle: false, evidence: true, writtenEvidence: true },
  homeOffice: { homeSqM: 100, officeSqM: 10, regularExclusive: true },
  assets: [
    { description: 'Laptop', kind: 'computer', costCad: 2200, placedInService: '2025-03-14', businessUsePct: 100 },
    { description: 'Camera', kind: 'computer', costCad: 6000, placedInService: '2025-11-20', businessUsePct: 100 },
  ],
  deMinimis: true, capitalMaterial: false, materiallyParticipated: true,
  ...over,
});

describe('Schedule C (2025)', () => {
  const c = computeScheduleC(2025, designer());
  const L = c.lines;
  it('converts income and expenses at the yearly average rate (1.398)', () => {
    expect(L['1']).toBe(85837); // 120,000 / 1.398 = 85,836.91
    expect(L['7']).toBe(85837);
    expect(L['8']).toBe(715); // 1,000 / 1.398
    expect(L['17']).toBe(1073);
    expect(L['18']).toBe(1431);
    expect(L['24b']).toBe(286); // 50% of 800 = 400 / 1.398
  });
  it('uses the standard mileage rate: 5,000 km = 3,107 miles x $0.70 + parking', () => {
    expect(c.miles).toEqual({ business: 3107, commuting: 0, other: 6214 });
    expect(L['9']).toBe(2175 + 143); // 2,174.90 -> 2,175; 200 / 1.398 = 143
  });
  it('expenses the laptop under the de minimis safe harbor and depreciates the camera with ADS', () => {
    const r1 = dailyRate('2025-03-14')!.rate;
    const r2 = dailyRate('2025-11-20')!.rate;
    const laptop = Math.round(2200 / r1);
    const camera = Math.round(6000 / r2);
    expect(laptop).toBeLessThanOrEqual(2500);
    expect(camera).toBeGreaterThan(2500);
    expect(L['22']).toBe(laptop);
    // Only depreciable asset placed in Q4 -> mid-quarter; 5-year ADS, Q4 = 2.5%.
    expect(c.depreciation.find((d) => d.asset.description === 'Camera')).toMatchObject({ convention: 'MQ', basisUsd: camera, deduction: Math.round(camera * 0.025) });
    expect(L['13']).toBe(Math.round(camera * 0.025));
    expect(c.needs4562).toBe(true);
  });
  it('simplified home office: 10 m2 = 108 sq ft x $5', () => {
    expect(c.homeOfficeSqFt).toEqual({ home: 1076, office: 108 });
    expect(L['30']).toBe(540);
    expect(L['31']).toBe(L['29'] - 540);
    expect(L['29']).toBe(L['7'] - L['28']);
  });
  it('limits the home office to the tentative profit', () => {
    const small = computeScheduleC(2025, designer({ grossCad: 3000, expensesCad: { '18': 2500 }, mealsCad: 0, vehicle: undefined, assets: [] }));
    // 3,000 / 1.398 = 2,146; 2,500 / 1.398 = 1,788; tentative profit 358 < 540.
    expect(small.lines['29']).toBe(358);
    expect(small.lines['30']).toBe(358);
    expect(small.lines['31']).toBe(0);
  });
});

describe('Schedule C inside a return', () => {
  const input: ReturnInput = {
    year: 2025, filingStatus: 'single',
    taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
    dependents: [{ firstName: 'Ava', lastName: 'Lee', ssn: '111-22-3333', relationship: 'daughter', dateOfBirth: '2015-02-01', hasValidSsn: true, usPerson: true, livedWithYouOverHalfYear: true }],
    address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
    slips: [],
    assessments: [{ owner: 'taxpayer', totalIncome: 100000, netIncome: 100000, netFederalTax: 12000, provincialTax: 6000 }],
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    businesses: [designer()],
  };
  const r = computeReturn(input).best;
  const C = r.scheduleC[0].lines;
  it('puts the net profit on Schedule 1, line 3', () => {
    expect(r.schedule1['3']).toBe(C['31']);
    expect(r.f1040['8']).toBe(C['31']);
  });
  it('enters business income gross on Form 1116 with expenses on line 2', () => {
    const g = r.f1116.find((f) => f.category === 'general')!.lines;
    expect(g['1a']).toBe(C['7']);
    expect(g['2']).toBe(C['28'] + C['30']);
    expect(g['3e']).toBe(C['7']);
  });
  it('gives no refundable child tax credit from SE-exempt income', () => {
    expect(r.schedule8812['18a'] ?? 0).toBe(0);
    expect(r.f1040['28'] ?? 0).toBe(0);
    expect(r.flags.some((f) => f.id === 'se-totalization')).toBe(true);
  });
  it('Form 2555: gross business income on line 20a, allocable expenses on line 44', () => {
    const fe = computeReturn({ ...input, elections: { ...input.elections, feie: 'yes' }, feieFacts: { bonaFideResident: true, residenceStart: '2015-01-01', daysInUs: 0 } }).best;
    const F = fe.f2555[0].lines;
    expect(F['20a']).toBe(C['7']);
    expect(F['27']).toBe(C['7']);
    // Whole gross is under the $130,000 limit, so all expenses are allocable to excluded income.
    expect(F['43']).toBe(C['7']);
    expect(F['44']).toBe(C['28'] + C['30']);
    expect(F['45']).toBe(C['31']);
  });
});
