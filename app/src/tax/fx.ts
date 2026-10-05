// Daily exchange rates for amounts tied to a date (purchases and sales of property).
// The IRS has no official rate and "generally accepts any posted exchange rate that is
// used consistently" (irs.gov, Foreign currency and currency exchange rates); Lou uses the
// Bank of Canada's posted rates, bundled with the app so nothing is fetched.
// Income for the year keeps using the IRS yearly average (years.ts).

import data from './data/boc-usdcad.json';

const RATES = data.rates as Record<string, number>;
export const FX_SOURCE = data.source;
export const FX_FIRST = data.first;
export const FX_LAST = data.last;

export interface DailyRate { rate: number; /** The business day the rate is from (the date itself, or the last one before it). */ on: string }

/**
 * CAD per 1 USD on `isoDate`. Weekends and holidays use the last business day before.
 * Returns null outside the bundled range (the user enters a rate instead).
 */
export function dailyRate(isoDate: string): DailyRate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || isoDate < FX_FIRST || isoDate > FX_LAST) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  for (let i = 0; i < 10; i++) {
    const key = d.toISOString().slice(0, 10);
    if (RATES[key]) return { rate: RATES[key], on: key };
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return null;
}
