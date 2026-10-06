import { describe, expect, it } from 'vitest';
import { initialState, sanitizeState } from './store';

// Cases found by pen testing: saved or restored data in the wrong shape must never be able to blank the app.
describe('sanitizeState', () => {
  it('keeps a good state as it is', () => {
    const s = { ...initialState(), step: 'results' as const, year: 2025 as const, licenses: ['LOU1.a.b'] };
    expect(sanitizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('falls back to a fresh state for things that are not a Lou state', () => {
    for (const bad of [null, undefined, 'x', 42, [], {}, { version: 2 }]) expect(sanitizeState(bad)).toEqual(initialState());
  });

  it('turns wrongly shaped lists and records into usable ones', () => {
    const s = sanitizeState({ version: 1, slips: 'oops', docs: { a: 1 }, accounts: null, dependents: [1, 'x', { id: 'ok' }], elections: 'no', taxpayer: null, address: [] });
    expect(s.slips).toEqual([]);
    expect(s.docs).toEqual([]);
    expect(s.accounts).toEqual([]);
    expect(s.dependents).toEqual([{ id: 'ok' }]);
    expect(s.elections).toEqual(initialState().elections);
    expect(s.taxpayer).toEqual(initialState().taxpayer);
    expect(s.address).toEqual(initialState().address);
  });

  it('keeps only text keys, and never lets a bad entry through', () => {
    expect(sanitizeState({ version: 1, licenses: ['LOU1.a.b', 1, null, {}, '', 'x'.repeat(5000)] }).licenses).toEqual(['LOU1.a.b']);
    expect(sanitizeState({ version: 1, licenses: 'LOU1.x.y' }).licenses).toEqual([]);
  });

  it('resets an unknown step or tax year, and drops damaged put-away years', () => {
    const s = sanitizeState({ version: 1, step: 'hax', year: 1999, years: { 2024: 'x', 2023: { slips: 5, docs: [{ id: 'd' }] }, 1900: {} } });
    expect(s.step).toBe('start');
    expect(s.year).toBeNull();
    expect(Object.keys(s.years)).toEqual(['2023']);
    expect(s.years[2023]?.slips).toEqual([]);
    expect(s.years[2023]?.docs).toEqual([{ id: 'd' }]);
  });

  it('does not let __proto__ keys change what every object inherits', () => {
    sanitizeState(JSON.parse('{"version":1,"__proto__":{"polluted":"yes"},"taxpayer":{"__proto__":{"polluted":"yes"}}}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
