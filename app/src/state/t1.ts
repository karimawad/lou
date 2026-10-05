// A T1 return as an income source. For each T1 income line, if the same person has no slip that
// feeds that line, Lou makes a slip from the T1 amount so the rest of the engine treats it the usual
// way. If slips do feed the line, the slips win and the T1 total is a completeness check. Nothing is
// counted twice. Lines Lou can't turn into US figures (capital gains, rental, business, ...) are flagged.
//
// T1 line contents: CRA Federal Worksheet (5000-D1) and the T1 line descriptions (canada.ca/line-xxxxx).

import { T1_INCOME_LINES } from '../extract/t1';
import type { Flag, SlipAnswers } from '../tax/model';
import type { SlipType } from '../tax/slips';
import type { AppState, SlipRecord } from './store';

/** Dividend gross-up on the T1 (Federal Worksheet, line 12000: 138% eligible, 115% other than eligible; same 2023-2025). */
export const GROSS_UP = { eligible: 1.38, other: 1.15 } as const;

type Box = [SlipType, string];
interface Rule {
  /** Slip boxes (actual amounts) that feed the T1 line. */
  from: Box[];
  /** The slip Lou makes when no slip feeds the line. */
  make: (amount: number, answers: SlipAnswers | undefined) => { type: SlipType; boxes: Record<string, number> };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const RULES: Record<string, Rule> = {
  '10100': { from: [['T4', '14']], make: (v) => ({ type: 'T4', boxes: { '14': v } }) },
  '11300': { from: [['T4AOAS', '18']], make: (v) => ({ type: 'T4AOAS', boxes: { '18': v } }) },
  '11400': { from: [['T4AP', '20']], make: (v) => ({ type: 'T4AP', boxes: { '20': v } }) },
  '11500': { from: [['T4A', '016'], ['T4A', '024'], ['T4RIF', '16']], make: (v) => ({ type: 'T4A', boxes: { '016': v } }) },
  '11900': { from: [['T4E', '14']], make: (v) => ({ type: 'T4E', boxes: { '14': v } }) },
  // Line 12100: T5 boxes 13, 14, 15 and 30, T3 box 25 (Federal Worksheet). Made as Canadian interest.
  '12100': { from: [['T5', '13'], ['T5', '14'], ['T5', '15'], ['T5', '30'], ['T3', '25']], make: (v) => ({ type: 'T5', boxes: { '13': v } }) },
  '12900': {
    from: [['T4RSP', '16'], ['T4RSP', '18'], ['T4RSP', '20'], ['T4RSP', '22'], ['T4RSP', '26'], ['T4RSP', '28'], ['T4RSP', '34']],
    make: (v, a) => ({ type: 'T4RSP', boxes: { [a?.rrspKind === 'annuity' ? '16' : '22']: v } }),
  },
};

/** Dividends: the T1 shows taxable (grossed-up) amounts; the US uses the actual amounts. */
const DIVIDEND_FROM: Box[] = [['T5', '24'], ['T5', '10'], ['T3', '49'], ['T3', '23']];
function actualDividends(t1: Record<string, number>) {
  const other = t1['12010'] ?? 0;
  const eligible = Math.max(0, (t1['12000'] ?? 0) - other);
  return { eligible: round2(eligible / GROSS_UP.eligible), other: round2(other / GROSS_UP.other) };
}

/** Lines Lou never turns into US figures from the T1, with what to do instead. */
const NOT_TAKEN: Record<string, string> = {
  '10400': 'Add the slip or record it came from (for example a T4A), or enter it on the US return yourself.',
  '11600': 'The US has no pension splitting: each person reports the pension paid to them. Lou leaves this out; the spouse whose pension it is reports all of it.',
  '11700': 'Lou leaves this out.',
  '12200': 'Partnership income needs the T5013 slip and the US partnership rules. Lou does not prepare this part.',
  '12500': 'RDSP payments need the T4A box 131 slip and a professional view on their US treatment.',
  '12600': "Rental income goes on US Schedule E, with US depreciation rules. Lou doesn't prepare Schedule E.",
  '12800': 'Support payments: spousal support is US income only under agreements made before 2019, and child support never is (IRC 71, repealed for later agreements). Enter it yourself if it applies.',
  '12905': 'FHSA income: add your FHSA under Your Canadian accounts so Lou can report it.',
  '12906': 'FHSA income: add your FHSA under Your Canadian accounts so Lou can report it.',
  '13000': 'Add the slips this came from (for example a T4A box 028 or a T3). Lou needs to know what it is.',
  '13010': 'Scholarships need the T4A box 105 slip; for a degree student the US taxes only the part not spent on tuition, fees and required books (IRC 117).',
  '14400': "Workers' compensation is generally not taxable on a US return. Lou leaves it out.",
  '14500': 'Social assistance: check whether it is taxable on a US return; Lou leaves it out.',
  '14600': 'The guaranteed income supplement is paid under the Old Age Security Act. Lou leaves it out; check its US treatment.',
};
const SELF_EMPLOYMENT = ['13500', '13700', '13900', '14100', '14300'];

const label = (line: string) => T1_INCOME_LINES.find((l) => l.box === line)?.label ?? `Line ${line}`;
const fmt = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });

function sumBoxes(slips: SlipRecord[], owner: SlipRecord['owner'], boxes: Box[]) {
  let total = 0;
  let found = false;
  for (const s of slips) {
    if (s.owner !== owner) continue;
    for (const [type, box] of boxes) {
      if (s.type === type && s.boxes[box] !== undefined) { total += s.boxes[box]; found = true; }
    }
  }
  return { total: round2(total), found };
}

export interface T1Derived {
  /** Slips made from T1 lines (ids "t1:<T1 slip id>:<line>"). */
  slips: SlipRecord[];
  flags: Flag[];
}

/** T1 returns in this year's workspace: NOA-type records that carry income lines. */
export function t1Returns(state: Pick<AppState, 'slips' | 'year'>): SlipRecord[] {
  return state.slips.filter((s) => s.type === 'NOA' && (!s.year || !state.year || s.year === state.year)
    && T1_INCOME_LINES.some((l) => s.boxes[l.box] !== undefined));
}

export function deriveFromT1(state: Pick<AppState, 'slips' | 'year' | 'businesses' | 'sales' | 'accounts'>): T1Derived {
  const real = state.slips.filter((s) => s.type !== 'NOA' && (!s.year || !state.year || s.year === state.year));
  const slips: SlipRecord[] = [];
  const flags: Flag[] = [];
  for (const t1 of t1Returns(state)) {
    const owner = t1.owner;
    const make = (line: string, type: SlipType, boxes: Record<string, number>) => slips.push({
      id: `t1:${t1.id}:${line}`, type, owner, payer: `From your T1, line ${line}`, year: t1.year, docId: t1.docId,
      boxes, reads: {}, edited: [], confirmed: t1.confirmed, answers: t1.derivedAnswers?.[line], fromT1Line: line,
    });
    const check = (line: string, t1Amount: number, slipTotal: number) => {
      if (Math.abs(t1Amount - slipTotal) <= 1) return;
      flags.push({
        id: `t1-check-${t1.id}-${line}`, severity: 'warn', title: `Your slips and your T1 don't match on line ${line}`,
        detail: `${label(line)}: your slips add up to ${fmt(slipTotal)}, but your T1 shows ${fmt(t1Amount)}. A slip may be missing, or a joint account's income was split with your spouse on the T1. Lou uses the slips.`,
      });
    };

    // The income lines must add up to total income (line 15000); if not, a line was missed or misread.
    const lines = T1_INCOME_LINES.filter((l) => l.box !== '12010').reduce((a, l) => a + (t1.boxes[l.box] ?? 0), 0);
    if (t1.boxes['15000'] !== undefined && Math.abs(round2(lines) - t1.boxes['15000']) > 1) {
      flags.push({
        id: `t1-total-${t1.id}`, severity: 'block', title: "The income lines on your T1 don't add up to total income",
        detail: `The lines Lou has add up to ${fmt(round2(lines))}, but line 15000 shows ${fmt(t1.boxes['15000'])}. Go back to Check the numbers and compare your T1 line by line (show all lines to add one that's missing).`,
      });
    }

    for (const [line, rule] of Object.entries(RULES)) {
      const amount = t1.boxes[line];
      if (!amount) continue;
      const fed = sumBoxes(real, owner, rule.from);
      if (fed.found) { check(line, amount, fed.total); continue; }
      const m = rule.make(amount, t1.derivedAnswers?.[line]);
      make(line, m.type, m.boxes);
    }

    if (t1.boxes['12000']) {
      const fed = sumBoxes(real, owner, DIVIDEND_FROM);
      const actual = actualDividends(t1.boxes);
      if (fed.found) check('12000', round2(actual.eligible + actual.other), fed.total);
      else make('12000', 'T5', { ...(actual.eligible ? { '24': actual.eligible } : {}), ...(actual.other ? { '10': actual.other } : {}) });
    }

    // Capital gains dividends (T3 box 21, T5 box 18) are on line 12700 at the 50% inclusion rate; they need no sale.
    const capDist = sumBoxes(real, owner, [['T3', '21'], ['T5', '18']]).total;
    if (t1.boxes['12700'] && Math.abs(t1.boxes['12700'] - capDist / 2) > 1 && !(state.sales ?? []).some((x) => x.owner === owner)) {
      flags.push({
        id: `t1-12700-${t1.id}`, severity: 'block', title: 'Add the sales behind your capital gains',
        detail: `Your T1 shows taxable capital gains of ${fmt(t1.boxes['12700'])} (line 12700). The US taxes the full gain, worked out at the exchange rate on each purchase and sale date, so Lou needs each sale. Add them under "Sales of investments" (your Schedule 3 lists them). Capital gains from a T3 slip need the T3.`,
      });
    }
    const se = SELF_EMPLOYMENT.filter((l) => t1.boxes[l]);
    if (se.length && !(state.businesses ?? []).some((b) => b.owner === owner)) {
      flags.push({
        id: `t1-se-${t1.id}`, severity: 'block', title: 'Add your self-employment income',
        detail: `Your T1 shows self-employment income on line ${se.join(', ')}. Add the business under "Self-employment" using your T2125, so Lou can fill Schedule C.`,
      });
    }
    for (const [line, advice] of Object.entries(NOT_TAKEN)) {
      if (!t1.boxes[line]) continue;
      if ((line === '12905' || line === '12906') && state.accounts.some((a) => a.kind === 'fhsa' && a.owner === owner)) continue;
      if (line === '13000' && sumBoxes(real, owner, [['T4A', '028'], ['T4A', '018'], ['T4RIF', '16'], ['T3', '26']]).found) continue;
      flags.push({ id: `t1-${line}-${t1.id}`, severity: 'warn', title: `Not taken from your T1: ${label(line).toLowerCase()} (line ${line})`, detail: `${fmt(t1.boxes[line])}. ${advice}` });
    }
  }
  return { slips, flags };
}

/** Every slip the return uses: the uploaded ones plus those made from a T1. */
export function incomeSlips(state: Pick<AppState, 'slips' | 'year' | 'businesses' | 'sales' | 'accounts'>): SlipRecord[] {
  return [...state.slips, ...deriveFromT1(state).slips];
}

/** Saves an answer for a slip, including one made from a T1 (stored on the T1 record by line). */
export function withSlipAnswer(state: AppState, slip: SlipRecord, patch: Partial<SlipAnswers>): AppState {
  if (slip.fromT1Line) {
    const t1Id = slip.id.split(':')[1];
    return { ...state, slips: state.slips.map((x) => (x.id === t1Id
      ? { ...x, derivedAnswers: { ...x.derivedAnswers, [slip.fromT1Line!]: { ...x.derivedAnswers?.[slip.fromT1Line!], ...patch } } } : x)) };
  }
  return { ...state, slips: state.slips.map((x) => (x.id === slip.id ? { ...x, answers: { ...x.answers, ...patch } } : x)) };
}
