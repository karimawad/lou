import { describe, expect, it } from 'vitest';
import { addToYear, initialState, switchYear, yearData, type AppState, type SlipRecord } from './store';
import { autoCarryover, toReturnInput } from './toInput';

const slip = (id: string, over: Partial<SlipRecord>): SlipRecord => ({
  id, type: 'T4', owner: 'taxpayer', payer: 'Maple Co', boxes: {}, reads: {}, edited: [], confirmed: true, ...over,
});

/** A household with a confirmed Toronto-style return for `year` (wages + NOA). */
function withYear(state: AppState, year: 2023 | 2024 | 2025): AppState {
  const s = switchYear(state, year);
  return {
    ...s, filingStatus: 'single', livedInCanadaAllYear: true, noAccounts: true,
    slips: [
      slip(`t4-${year}`, { year, boxes: { '14': 100000 } }),
      slip(`noa-${year}`, { type: 'NOA', year, boxes: { '15000': 100000, '23600': 100000, '42000': 13000, '42800': 7000 } }),
    ],
    elections: { feie: 'no', canadianSocialSecurityExempt: true, useAdjustmentException: true },
  };
}

const base = (): AppState => ({
  ...initialState(),
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
  address: { street: '1 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'Canada' },
});

describe('multi-year workspace', () => {
  it('keeps each year intact when switching back and forth; people are shared', () => {
    let s = withYear(base(), 2025);
    s = withYear(s, 2024);
    expect(s.year).toBe(2024);
    expect(s.slips.map((x) => x.id)).toEqual(['t4-2024', 'noa-2024']);
    s = switchYear(s, 2025);
    expect(s.slips.map((x) => x.id)).toEqual(['t4-2025', 'noa-2025']);
    expect(yearData(s, 2024)?.slips).toHaveLength(2);
    expect(s.taxpayer.firstName).toBe('Sam');
  });

  it('starts a new year with the same filing situation but no slips', () => {
    const s = switchYear(withYear(base(), 2025), 2023);
    expect(s.filingStatus).toBe('single');
    expect(s.slips).toEqual([]);
    expect(s.step).toBe('you');
  });

  it('keeps dependents per year, starting a new year from a copy', () => {
    const kid = { firstName: 'Ava', lastName: 'Lee', ssn: '111-22-3333', relationship: 'daughter', dateOfBirth: '2015-02-01', hasValidSsn: true, usPerson: true, livedWithYouOverHalfYear: true };
    let s = { ...withYear(base(), 2025), dependents: [kid] };
    s = switchYear(s, 2024);
    expect(s.dependents).toEqual([kid]);
    s = { ...s, dependents: [{ ...kid, livedWithYouOverHalfYear: false }] };
    s = switchYear(s, 2025);
    expect(s.dependents[0].livedWithYouOverHalfYear).toBe(true);
    expect(yearData(s, 2024)?.dependents[0].livedWithYouOverHalfYear).toBe(false);
  });

  it('files slips into another year without switching to it', () => {
    let s = withYear(base(), 2025);
    s = addToYear(s, 2024, [], [slip('t5-2024', { type: 'T5', year: 2024 })]);
    expect(s.year).toBe(2025);
    expect(s.slips).toHaveLength(2);
    expect(yearData(s, 2024)?.slips.map((x) => x.id)).toEqual(['t5-2024']);
  });
});

describe('carryovers flow from year to year', () => {
  it('2024 picks up the unused Canadian tax generated in 2023', () => {
    let s = withYear(base(), 2023);
    s = withYear(s, 2024);
    const auto = autoCarryover(s);
    expect(auto?.fromYear).toBe(2023);
    expect(auto?.vintages.map((v) => v.year)).toEqual([2023]);
    expect(auto!.vintages[0].general).toBeGreaterThan(0);
    expect(toReturnInput(s)?.carryover?.vintages).toEqual(auto?.vintages);
  });

  it('chains: 2025 carries 2023 and 2024 amounts by year of origin', () => {
    let s = withYear(base(), 2023);
    s = withYear(s, 2024);
    s = withYear(s, 2025);
    const auto = autoCarryover(s);
    expect(auto?.fromYear).toBe(2024);
    expect(auto?.vintages.map((v) => v.year)).toEqual([2023, 2024]);
  });

  it('carries the AMT foreign tax credit separately', () => {
    let s = withYear(base(), 2023);
    s = withYear(s, 2024);
    const auto = autoCarryover(s);
    expect(auto?.amtVintages.map((v) => v.year)).toEqual([2023]);
    expect(toReturnInput(s)?.carryover?.amtVintages).toEqual(auto?.amtVintages);
  });

  it("a carryover the user typed in wins over the automatic one", () => {
    let s = withYear(base(), 2023);
    s = withYear(s, 2024);
    s = { ...s, carryover: { general: 0, passive: 0, vintages: [{ year: 2020, general: 100, passive: 0 }] } };
    expect(toReturnInput(s)?.carryover?.vintages).toEqual([{ year: 2020, general: 100, passive: 0 }]);
  });

  it('ignores a prior year whose slips are not all checked yet', () => {
    let s = withYear(base(), 2023);
    s = { ...s, slips: s.slips.map((x) => ({ ...x, confirmed: false })) };
    s = withYear(s, 2024);
    expect(autoCarryover(s)).toBeNull();
  });
});
