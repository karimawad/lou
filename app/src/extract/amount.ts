// Parses money as it appears on Canadian slips: "100,000.00", "100 000,00"
// (French formatting), "$1,234.56", "1234.5", "(12.00)". Returns null for
// anything that isn't clearly an amount.

const NBSP = /[   ]/g;

export function parseAmount(input: string): number | null {
  let s = input.replace(NBSP, ' ').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/^-\s*/, () => { negative = true; return ''; });
  s = s.replace(/\$|CAD|\$CA/gi, '').trim();
  if (!/^[\d\s.,]+$/.test(s) || !/\d/.test(s)) return null;

  const compact = s.replace(/\s+/g, ' ');
  let normalized: string;
  // French: space or dot thousands, comma decimals ("100 000,00", "1.234,56").
  if (/^\d{1,3}([ .]\d{3})*,\d{1,2}$/.test(compact) || /^\d+,\d{1,2}$/.test(compact)) {
    normalized = compact.replace(/[ .]/g, '').replace(',', '.');
  // English: comma or space thousands, dot decimals ("100,000.00", "100 000.00", "1234.5").
  } else if (/^\d{1,3}([, ]\d{3})*(\.\d{1,2})?$/.test(compact) || /^\d+(\.\d{1,2})?$/.test(compact)) {
    normalized = compact.replace(/[, ]/g, '');
  } else {
    return null;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Splits CRA "dollars | cents" pairs that some slips print in two cells ("100000" "00"). */
export function joinDollarsCents(dollars: string, cents: string): number | null {
  if (!/^\d{2}$/.test(cents.trim())) return null;
  const d = parseAmount(dollars);
  return d === null ? null : d + Number(cents) / 100;
}
