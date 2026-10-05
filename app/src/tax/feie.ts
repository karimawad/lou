// Form 2555 qualification (bona fide residence or physical presence) and the housing
// exclusion/deduction. Sources: Instructions for Form 2555 (2023-2025), Parts II, III, VI,
// VII, IX and the Limit on Housing Expenses Worksheet; Notices 2023-26, 2024-31, 2025-16
// (Canadian locations); Pub 54 (full days; the 12-month period may start before arrival).

import type { TaxYear } from './years';

/** Base housing amount (line 32) and the default limit (line 29b) for unlisted locations. */
export const HOUSING = {
  2025: { basePerDay: 56.99, baseFull: 20800, limitFull: 39000, limitPerDay: 106.85 },
  2024: { basePerDay: 55.30, baseFull: 20240, limitFull: 37950, limitPerDay: 103.69 },
  2023: { basePerDay: 52.60, baseFull: 19200, limitFull: 36000, limitPerDay: 98.63 },
} as const;

/** Canadian locations with a higher limit: [full year, per day] (Notice 2025-16, 2024-31, 2023-26). */
export const HOUSING_LOCATIONS: Record<TaxYear, Record<string, [number, number]>> = {
  2025: { Calgary: [43400, 118.90], Montreal: [50100, 137.26], Ottawa: [46800, 128.22], Toronto: [57400, 157.26], Vancouver: [56600, 155.07], Victoria: [39200, 107.40] },
  2024: { Calgary: [39500, 107.92], Montreal: [54000, 147.54], Ottawa: [48100, 131.42], Toronto: [61900, 169.13], Vancouver: [61000, 166.67], Victoria: [42200, 115.30] },
  2023: { Calgary: [38600, 105.75], Montreal: [52600, 144.11], Ottawa: [46100, 126.30], Toronto: [59900, 164.11], Vancouver: [56800, 155.62], Victoria: [41300, 113.15] },
};

export const daysInYear = (year: number) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365);

const DAY = 86400000;
const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const toIso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const validIso = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Days from `a` through `b`, inclusive. */
export const daysBetween = (a: string, b: string) => toDay(b) - toDay(a) + 1;

export interface Trip { arrived: string; left: string; businessDays: number }

export interface PhysicalPresence {
  qualifies: boolean;
  /** The 12-month period (line 16). */
  start?: string;
  end?: string;
  /** Full days in a foreign country within the period. */
  fullDays: number;
  /** Days of the period that fall in the tax year (line 31/38). */
  daysInTaxYear: number;
}

/**
 * Physical presence test: 330 full days abroad in some 12 consecutive months that include part
 * of the tax year. Days on a trip to the US (from the day you leave Canada through the day you
 * come back) and the day you arrive are not full days, nor are days after today. Picks the 12-month period with the most
 * days in the tax year, which can start up to 35 days before you arrived (Pub 54).
 */
export function physicalPresence(year: number, arrivedInCanada: string, trips: Trip[], leftCanada?: string, today = new Date().toISOString().slice(0, 10)): PhysicalPresence {
  if (!validIso(arrivedInCanada)) return { qualifies: false, fullDays: 0, daysInTaxYear: 0 };
  const first = toDay(arrivedInCanada) + 1; // the arrival day isn't a full day
  // Days after today haven't happened yet, so they can't count toward the 330.
  const last = Math.min(validIso(leftCanada) ? toDay(leftCanada!) - 1 : Infinity, toDay(today));
  const away = new Set<number>();
  for (const t of trips) {
    if (!validIso(t.arrived) || !validIso(t.left)) continue;
    for (let d = toDay(t.arrived); d <= toDay(t.left); d++) away.add(d);
  }
  const abroad = (d: number) => d >= first && d <= last && !away.has(d);
  const y0 = toDay(`${year}-01-01`);
  const y1 = toDay(`${year}-12-31`);
  let best: PhysicalPresence = { qualifies: false, fullDays: 0, daysInTaxYear: 0 };
  // Sliding 12-month window: [s, same date next year - 1 day]. Count incrementally.
  for (let s = y0 - 366; s <= y1; s++) {
    const startIso = toIso(s);
    const next = `${Number(startIso.slice(0, 4)) + 1}${startIso.slice(4)}`;
    const e = (validIso(next) ? toDay(next) : toDay(`${Number(startIso.slice(0, 4)) + 1}-03-01`)) - 1;
    if (e < y0) continue;
    let full = 0;
    for (let d = s; d <= e; d++) if (abroad(d)) full++;
    if (full < 330) continue;
    const overlap = Math.min(e, y1) - Math.max(s, y0) + 1;
    if (overlap > best.daysInTaxYear) best = { qualifies: true, start: startIso, end: toIso(e), fullDays: full, daysInTaxYear: overlap };
  }
  if (!best.qualifies) {
    // Report the best near-miss for the message.
    let most = 0;
    for (let s = y0 - 366; s <= y1; s += 7) {
      let full = 0;
      for (let d = s; d < s + 365; d++) if (abroad(d)) full++;
      most = Math.max(most, full);
    }
    best.fullDays = most;
  }
  return best;
}

export interface BonaFide {
  qualifies: boolean;
  daysInTaxYear: number;
  /** Residence began during the year and the next full year hasn't ended yet, so the test can't be met yet. */
  waitForNextYear?: boolean;
}

/**
 * Bona fide residence: an uninterrupted period that includes an entire tax year. If residence
 * began during `year`, the year still qualifies (from the start date) once residence has
 * continued through all of the next year (i2555 line 31 example; Pub 54).
 */
export function bonaFide(year: number, residenceStart: string, today = new Date().toISOString().slice(0, 10)): BonaFide {
  const total = daysInYear(year);
  if (!validIso(residenceStart) || residenceStart <= `${year}-01-01`) return { qualifies: validIso(residenceStart), daysInTaxYear: validIso(residenceStart) ? total : 0 };
  if (residenceStart > `${year}-12-31`) return { qualifies: false, daysInTaxYear: 0 };
  const days = daysBetween(residenceStart, `${year}-12-31`);
  if (today <= `${year + 1}-12-31`) return { qualifies: false, daysInTaxYear: days, waitForNextYear: true };
  return { qualifies: true, daysInTaxYear: days };
}

export interface HousingInput {
  expensesUsd: number;
  location: string; // a key of HOUSING_LOCATIONS[year], or '' for elsewhere in Canada
}

/** Form 2555 lines 28-36 (Part VI). `line27` is total foreign earned income; `employerAmounts` is line 34. */
export function housingPart6(year: TaxYear, h: HousingInput, qualifyingDays: number, line27: number, employerAmounts: number): Record<string, number> {
  const C = HOUSING[year];
  const full = qualifyingDays >= daysInYear(year);
  const loc = HOUSING_LOCATIONS[year][h.location];
  const L: Record<string, number> = {};
  L['28'] = Math.round(h.expensesUsd);
  // Limit on Housing Expenses Worksheet, line 29b.
  L['29b'] = full ? (loc ? loc[0] : C.limitFull) : Math.round(qualifyingDays * (loc ? loc[1] : C.limitPerDay));
  L['30'] = Math.min(L['28'], L['29b']);
  L['31'] = qualifyingDays;
  L['32'] = full ? C.baseFull : Math.round(C.basePerDay * qualifyingDays);
  L['33'] = Math.max(0, L['30'] - L['32']);
  if (L['33'] === 0) return L;
  L['34'] = employerAmounts;
  L['35'] = line27 > 0 ? Math.min(1, Math.round((employerAmounts / line27) * 1000) / 1000) : 0;
  L['36'] = Math.min(Math.round(L['33'] * L['35']), L['34']);
  return L;
}

export interface TravelRow { country: string; arrived: string; left: string; fullDays: number; businessDays: number }

/**
 * Form 2555 line 18: stays during the 12-month period, alternating Canada and US trips.
 * The arrival and departure days of each stay are not full days.
 */
export function travelRows(start: string, end: string, arrivedInCanada: string, trips: Trip[]): TravelRow[] {
  const s = toDay(start);
  const e = toDay(end);
  const inWindow = trips.filter((t) => validIso(t.arrived) && validIso(t.left) && toDay(t.left) >= s && toDay(t.arrived) <= e)
    .sort((a, b) => a.arrived.localeCompare(b.arrived));
  const rows: TravelRow[] = [];
  const clamp = (d: number) => Math.max(s, Math.min(e, d));
  let canadaFrom = Math.max(s, toDay(arrivedInCanada));
  let fromIsArrival = toDay(arrivedInCanada) >= s;
  for (const t of inWindow) {
    const leave = clamp(toDay(t.arrived));
    rows.push({ country: 'Canada', arrived: toIso(canadaFrom), left: toIso(leave), fullDays: Math.max(0, leave - canadaFrom - (fromIsArrival ? 1 : 0)), businessDays: 0 });
    const back = clamp(toDay(t.left));
    rows.push({ country: 'United States', arrived: toIso(leave), left: toIso(back), fullDays: Math.max(0, back - leave - 1), businessDays: t.businessDays });
    canadaFrom = back;
    fromIsArrival = true;
  }
  rows.push({ country: 'Canada', arrived: toIso(canadaFrom), left: toIso(e), fullDays: e - canadaFrom + (fromIsArrival ? 0 : 1), businessDays: 0 });
  return rows;
}
