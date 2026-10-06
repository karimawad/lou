import { describe, expect, it } from 'vitest';
import {
  SCREEN_QUESTIONS, catchUpInterest, emptyCatchup, evaluateScreening, fbarLateAfter, fullDaysOutside, interestStart, lastRateDay,
  meets330, nextBusinessDay, returnDueDate, sfopPlan, type CatchupState,
} from './catchup';
import { interestFactor } from './pfic';

describe('which years the procedure covers moves with the date', () => {
  it('after the extended FBAR date: returns 2023-2025, FBARs 2020-2025 (the scope in CLAUDE.md)', () => {
    const p = sfopPlan('2026-10-16');
    expect(p.returnYears).toEqual([2023, 2024, 2025]);
    expect(p.fbarYears).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
    expect(p.fbarAlsoNow).toBeNull();
    expect(p.askExtensionFor).toBeNull();
    expect(p.unsupportedReturnYears).toEqual([]);
    expect(p.unsupportedFbarYears).toEqual([]);
  });

  it('before October 15 the newest FBAR is not late yet: six older years plus one to file now', () => {
    const p = sfopPlan('2026-10-06');
    expect(p.returnYears).toEqual([2023, 2024, 2025]);
    expect(p.fbarYears).toEqual([2019, 2020, 2021, 2022, 2023, 2024]);
    expect(p.fbarAlsoNow).toBe(2025);
    expect(p.askExtensionFor).toBe(2025);
    expect(p.unsupportedFbarYears).toEqual([]);
  });

  it('a Form 4868 extension keeps last year out until October 15', () => {
    const none = sfopPlan('2026-07-01', {});
    const ext = sfopPlan('2026-07-01', { 2025: true });
    expect(none.returnYears).toEqual([2023, 2024, 2025]);
    expect(ext.returnYears).toEqual([2022, 2023, 2024]);
    expect(ext.unsupportedReturnYears).toEqual([2022]);
    expect(ext.askExtensionFor).toBe(2025);
  });

  it('on June 15 a person abroad is not late yet; the next day they are', () => {
    expect(sfopPlan('2026-06-15').returnYears).toEqual([2022, 2023, 2024]);
    expect(sfopPlan('2026-06-16').returnYears).toEqual([2023, 2024, 2025]);
  });

  it('next year the window slides and says what Lou cannot do yet', () => {
    const p = sfopPlan('2027-11-01');
    expect(p.returnYears).toEqual([2024, 2025, 2026]);
    expect(p.unsupportedReturnYears).toEqual([2026]);
    expect(p.fbarYears).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(p.unsupportedFbarYears).toEqual([2026]);
  });

  it('weekend deadlines move to Monday', () => {
    expect(nextBusinessDay('2026-06-13')).toBe('2026-06-15'); // Saturday
    expect(nextBusinessDay('2027-10-17')).toBe('2027-10-18'); // Sunday
    expect(returnDueDate(2025, false)).toBe('2026-06-15');
    expect(returnDueDate(2025, true)).toBe('2026-10-15');
    expect(interestStart(2025)).toBe('2026-04-15');
    expect(fbarLateAfter(2025)).toBe('2026-10-15');
  });
});

describe('interest on late tax', () => {
  it('matches the IRS rate table, compounded daily from April 15', () => {
    const [row] = catchUpInterest([{ year: 2024, tax: 10000 }], '2026-04-15');
    const f = interestFactor('2025-04-15', '2026-04-15')!;
    expect(row.interest).toBe(Math.round(10000 * (f - 1) * 100) / 100);
    // 2025 Q2-Q4 at 7% and 2026 Q1 at 7%, about one year, daily compounding: just over 7%.
    expect(row.interest).toBeGreaterThan(700);
    expect(row.interest).toBeLessThan(740);
    expect(row.partial).toBe(false);
  });

  it('is zero when nothing is owed, and counts only to the last known rate for a far date', () => {
    expect(catchUpInterest([{ year: 2025, tax: 0 }], '2026-10-06')[0]).toMatchObject({ interest: 0, partial: false });
    const far = catchUpInterest([{ year: 2025, tax: 1000 }], '2030-01-01')[0];
    expect(far.partial).toBe(true);
    expect(far.interest).toBeGreaterThan(0);
    expect(lastRateDay()).toBe('2026-12-31');
  });

  it('older years cost more than newer ones on the same tax', () => {
    const rows = catchUpInterest([{ year: 2023, tax: 1000 }, { year: 2024, tax: 1000 }, { year: 2025, tax: 1000 }], '2026-10-06');
    expect(rows[0].interest).toBeGreaterThan(rows[1].interest);
    expect(rows[1].interest).toBeGreaterThan(rows[2].interest);
  });
});

describe('the 330-day test', () => {
  it('counts full days outside the US, by calendar year (leap years have 366)', () => {
    expect(fullDaysOutside(2025, 35)).toBe(330);
    expect(meets330(2025, 35)).toBe(true);
    expect(meets330(2025, 36)).toBe(false);
    expect(meets330(2024, 36)).toBe(true); // 366 - 36 = 330
    expect(meets330(2024, 37)).toBe(false);
  });
});

describe('screening sends risky cases to a professional', () => {
  const plan = sfopPlan('2026-10-16');
  const clean = (): CatchupState => {
    const c = emptyCatchup();
    for (const q of SCREEN_QUESTIONS) c.screen[q.key] = !q.risky;
    for (const y of plan.returnYears) { c.alreadyFiled[y] = false; c.daysInUs[y] = 10; }
    return c;
  };

  it('a clean set of answers can go ahead', () => {
    const s = evaluateScreening(clean(), plan);
    expect(s.findings).toEqual([]);
    expect(s.pending).toEqual([]);
    expect(s.canProceed).toBe(true);
  });

  it('unanswered questions hold it back', () => {
    const c = clean();
    delete c.screen.exam;
    const s = evaluateScreening(c, plan);
    expect(s.pending).toHaveLength(1);
    expect(s.clear).toBe(false);
  });

  it('an examination, a deliberate choice, or no SSN is a hard stop that an acknowledgement cannot lift', () => {
    for (const [key, risky] of [['exam', true], ['chose', true], ['tin', false], ['illegal', true]] as const) {
      const c = clean();
      c.screen[key] = risky;
      c.professionalAck = true;
      const s = evaluateScreening(c, plan);
      expect(s.findings.some((f) => f.id === key && f.level === 'stop'), key).toBe(true);
      expect(s.canProceed, key).toBe(false);
    }
  });

  it('knowing the rules, IRS contact, an earlier wrong return or a US home need a professional, then can go on once acknowledged', () => {
    for (const key of ['contact', 'knew', 'warned', 'priorFiled', 'abode'] as const) {
      const c = clean();
      c.screen[key] = true;
      const s = evaluateScreening(c, plan);
      expect(s.findings.some((f) => f.id === key && f.level === 'refer'), key).toBe(true);
      expect(s.canProceed, key).toBe(false);
      c.professionalAck = true;
      expect(evaluateScreening(c, plan).canProceed, key).toBe(true);
    }
  });

  it('a year already filed needs a 1040-X, which Lou does not make', () => {
    const c = clean();
    c.alreadyFiled[2024] = true;
    const s = evaluateScreening(c, plan);
    expect(s.findings.find((f) => f.id === 'filed-2024')?.level).toBe('stop');
  });

  it('under 330 days in every year stops; one qualifying year is enough', () => {
    const c = clean();
    for (const y of plan.returnYears) c.daysInUs[y] = 100;
    expect(evaluateScreening(c, plan).findings.some((f) => f.id === 'days')).toBe(true);
    c.daysInUs[2024] = 20;
    expect(evaluateScreening(c, plan).findings.some((f) => f.id === 'days')).toBe(false);
  });

  it('large balances ask for a professional but are not a stop', () => {
    const s = evaluateScreening(clean(), plan, { maxAggregateUsd: 1_500_000 });
    expect(s.findings.find((f) => f.id === 'large')?.level).toBe('refer');
    expect(s.canProceed).toBe(false);
    expect(evaluateScreening({ ...clean(), professionalAck: true }, plan, { maxAggregateUsd: 1_500_000 }).canProceed).toBe(true);
  });

  it('asks about the extension only when the answer matters', () => {
    const p = sfopPlan('2026-10-06');
    const c = emptyCatchup();
    expect(evaluateScreening(c, p).pending).toContain('Did you file Form 4868 for 2025?');
    expect(evaluateScreening(clean(), plan).pending).not.toContain('Did you file Form 4868 for 2025?');
  });
});
