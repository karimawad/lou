import { describe, expect, it } from 'vitest';
import { initialState, patchYear, sanitizeState, switchYear, type SlipRecord } from './store';
import { resultLine, yearCard, yearCards } from './dashboard';

const slip = (over: Partial<SlipRecord> = {}): SlipRecord => ({ id: 's1', type: 'T4', owner: 'taxpayer', payer: 'Acme', boxes: {}, reads: {}, edited: [], confirmed: true, ...over });
const none = new Set<2023 | 2024 | 2025>();

describe('dashboard cards', () => {
  it('a fresh workspace has three not-started cards, newest first', () => {
    const cards = yearCards(initialState());
    expect(cards.map((c) => [c.year, c.status])).toEqual([[2025, 'not-started'], [2024, 'not-started'], [2023, 'not-started']]);
  });

  it('lists what is missing and points the button at the first gap', () => {
    const s = { ...initialState(), year: 2025 as const, filingStatus: 'single' as const, taxpayer: { ...initialState().taxpayer, firstName: 'A', lastName: 'B' } };
    const c = yearCard(s, 2025, none);
    expect(c.status).toBe('progress');
    expect(c.next).toBe('slips');
    expect(c.refund).toBeNull();
  });

  it('asks for the Notice of Assessment and unchecked slips', () => {
    const base = { ...initialState(), year: 2025 as const, filingStatus: 'single' as const, taxpayer: { ...initialState().taxpayer, firstName: 'A', lastName: 'B' } };
    const c = yearCard({ ...base, slips: [slip({ confirmed: false })] }, 2025, none);
    expect(c.next).toBe('review');
    expect(c.todo.some((t) => t.includes('Notice of Assessment'))).toBe(true);
  });

  it('another year put away is still counted', () => {
    const s = { ...initialState(), year: 2025 as const, filingStatus: 'single' as const };
    const away = patchYear(switchYear(s, 2024), 2025, {});
    expect(yearCard(away, 2025, none).status).toBe('progress');
  });

  it('marking a year filed shows Filed and survives sanitizing', () => {
    let s = { ...initialState(), year: 2025 as const, filingStatus: 'single' as const };
    s = patchYear(s, 2025, { filed: { date: '2026-06-01', method: 'mail', fbar: true } });
    expect(yearCard(s, 2025, none).status).toBe('filed');
    expect(sanitizeState(JSON.parse(JSON.stringify(s))).filed).toEqual({ date: '2026-06-01', method: 'mail', fbar: true });
    expect(sanitizeState({ ...JSON.parse(JSON.stringify(s)), filed: { date: 'nope' } }).filed).toBeNull();
  });

  it('formats the result line', () => {
    expect(resultLine(1234.4)).toBe('Refund $1,234');
    expect(resultLine(-50)).toBe('Owes $50');
    expect(resultLine(null)).toBeNull();
  });
});
