import { describe, expect, it } from 'vitest';
import { emptyCatchup } from '../tax/catchup';
import { initialState, sanitizeCatchup, sanitizeState } from './store';

describe('catch-up state from storage or a backup', () => {
  it('starts empty, and old saves without it get an empty one', () => {
    expect(initialState().catchup).toEqual(emptyCatchup());
    const old = { ...initialState() } as Record<string, unknown>;
    delete old.catchup;
    expect(sanitizeState(old).catchup).toEqual(emptyCatchup());
  });

  it('keeps good answers and survives damaged ones', () => {
    const c = sanitizeCatchup({
      started: true, screen: { exam: false, knew: 'yes', '<script>': true }, alreadyFiled: { 2024: true, abc: true, 2023: 'x' },
      extension: { 2025: true }, daysInUs: { 2025: 12, 2024: -5, 2023: 'many', 2022: 9999 }, professionalAck: 'sure', mailDate: 'tomorrow',
      statement: { why: 'my words', bad: 5 }, fbar: { 2021: { accounts: [{ institution: 'RBC', maxValueCad: 'lots', kind: 'crypto' }, 'junk'], noAccounts: true }, nope: {} },
    });
    expect(c.started).toBe(true);
    expect(c.screen).toEqual({ exam: false });
    expect(c.alreadyFiled).toEqual({ 2024: true });
    expect(c.extension).toEqual({ 2025: true });
    expect(c.daysInUs).toEqual({ 2025: 12 });
    expect(c.professionalAck).toBe(false);
    expect(c.mailDate).toBe('');
    expect(c.statement).toEqual({ why: 'my words' });
    expect(Object.keys(c.fbar)).toEqual(['2021']);
    const a = c.fbar[2021]!.accounts;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ institution: 'RBC', maxValueCad: 0, kind: 'bank', owner: 'taxpayer' });
    expect(c.fbar[2021]!.noAccounts).toBe(true);
    expect(sanitizeCatchup('garbage')).toEqual(emptyCatchup());
  });

  it('lets the catch-up screen survive a reload', () => {
    const s = { ...initialState(), step: 'catchup' as const };
    expect(sanitizeState(JSON.parse(JSON.stringify(s))).step).toBe('catchup');
  });
});
