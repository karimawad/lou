import { describe, expect, it } from 'vitest';
import { addToYear, initialState, switchYear, yearData, type AppState, type SlipRecord } from './store';
import { autoCarryover, toReturnInput } from './toInput';
import { computeReturn } from '../tax/compute';
import { reviewSnapshot, staleReasons, staleYears } from './staleness';

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

describe('doing an earlier year after a later one', () => {
  it('flags the later year for review and keeps the paid key', () => {
    const key = 'LOU1.payload.signature';
    let s = { ...withYear(base(), 2025), licenses: [key] };
    expect(staleYears(s)).toEqual([]);
    s = { ...s, reviewed: { 2025: reviewSnapshot(s, 2025)! } };
    expect(staleYears(s)).toEqual([]);

    // The user now does 2024 (its unused Canadian tax carries into 2025).
    s = switchYear(s, 2024);
    s = withYear(s, 2024);
    s = switchYear(s, 2025);
    const stale = staleYears(s);
    expect(stale.map((x) => x.year)).toEqual([2025]);
    expect(stale[0].now.ftc).toBeGreaterThan(stale[0].before.ftc);
    expect(staleReasons(stale[0]).join(' ')).toContain('Unused Canadian tax carried in');

    // Same key in every year, nothing to pay again; reviewing clears the flag.
    expect(s.licenses).toEqual([key]);
    s = { ...s, reviewed: { ...s.reviewed, 2025: reviewSnapshot(s, 2025)! } };
    expect(staleYears(s)).toEqual([]);
  });

  it('does not flag a year that has no carry-in change', () => {
    let s = withYear(base(), 2023);
    s = { ...s, reviewed: { 2023: reviewSnapshot(s, 2023)! } };
    s = withYear(s, 2025);
    expect(staleYears(s).map((x) => x.year)).toEqual([]);
  });
});

describe('carryback to the prior year (IRC 904(c))', () => {
  /** A year with the given Canadian tax (CAD) on 100,000 of wages. */
  const taxed = (state: AppState, year: 2023 | 2024 | 2025, federal: number, provincial: number): AppState => {
    const s = withYear(state, year);
    return { ...s, slips: s.slips.map((x) => (x.type === 'NOA' ? { ...x, boxes: { ...x.boxes, '42000': federal, '42800': provincial } } : x)) };
  };

  it('2025 excess tax fills 2024 room: Schedule B line 7, an amend notice, and 2024 flagged for review', () => {
    // 2024: very little Canadian tax, so US tax on the income is left over (room). 2025: lots of Canadian tax.
    let s = taxed(base(), 2024, 1000, 500);
    s = taxed(s, 2025, 13000, 7000);
    const inp = toReturnInput(s)!;
    expect(inp.priorYearRoom!.general).toBeGreaterThan(0);
    const g = computeReturn(inp).best.f1116.find((f) => f.category === 'general')!;
    const room = inp.priorYearRoom!.general;
    expect(g.carryback).toBe(Math.min(g.scheduleB!.cols[0].l6, room));
    expect(g.carryback).toBeGreaterThan(0);
    expect(g.scheduleB!.cols[0].l7).toBe(-g.carryback);
    expect(g.scheduleB!.cols[0].l8).toBe(g.scheduleB!.cols[0].l6 - g.carryback);
    expect(computeReturn(inp).best.flags.some((f) => f.id === 'carryback-general' && f.title.includes('Amend your 2024'))).toBe(true);

    // 2024 was looked at before 2025 existed: now it needs a 1040-X.
    const before = { ...reviewSnapshot(taxed(base(), 2024, 1000, 500), 2024)! };
    expect(before.back).toBe(0);
    const stale = staleYears({ ...s, reviewed: { 2024: before } });
    expect(stale.map((x) => x.year)).toEqual([2024]);
    expect(stale[0].now.back).toBe(g.carryback);
    expect(staleReasons(stale[0]).join(' ')).toContain('carries back into 2024');
  });

  it('no carryback when the prior year used its whole limit, or is not in Lou', () => {
    let s = taxed(base(), 2024, 13000, 7000);
    s = taxed(s, 2025, 13000, 7000);
    const r = computeReturn(toReturnInput(s)!).best;
    expect(r.f1116.every((f) => f.carryback === 0)).toBe(true);
    expect(r.flags.find((f) => f.id === 'carryback')?.title).toContain('No carryback to 2024');
    const alone = computeReturn(toReturnInput(taxed(base(), 2025, 13000, 7000))!).best;
    expect(alone.flags.find((f) => f.id === 'carryback')?.title).toContain('carries back to 2024 first');
  });
});
