// Self-employment in Canada -> Schedule C (and Form 4562 when property is placed in service).
// Sources: Instructions for Schedule C (2023-2025); Pub 946 (ADS, conventions); Reg. 1.263(a)-1(f)
// (de minimis safe harbor); IRC 168(g)(1)(A) (property used predominantly outside the US must use
// ADS); IRC 179(d)(1) and 50(b)(1) (no section 179 for that property); IRC 199A(c)(3)(A)(i)
// (no QBI deduction for a business that isn't a US trade or business); IRC 274(a) and (n)
// (no entertainment; meals 50%); Instructions for Schedule SE and the US-Canada Agreement on
// Social Security, Art. V (self-employed people who live in Canada pay only CPP/QPP).

import { dollars } from './taxComputation';
import { dailyRate } from './fx';
import { YEARS, type TaxYear } from './years';
import type { Flag } from './model';

/** Schedule C expense lines Lou takes as typed-in amounts (2025 numbering; '27b' is "Other expenses"). */
export const SCHC_EXPENSE_LINES = ['8', '10', '11', '14', '15', '16a', '16b', '17', '18', '19', '20a', '20b', '21', '22', '23', '24a', '25', '26', '27b'] as const;
export type SchCExpenseLine = (typeof SCHC_EXPENSE_LINES)[number];

/** Business standard mileage rate, cents per mile (Schedule C instructions, line 9, each year). */
export const MILEAGE_RATE: Record<TaxYear, number> = { 2025: 0.70, 2024: 0.67, 2023: 0.655 };
/** Simplified home office: $5 per square foot, up to 300 square feet (Rev. Proc. 2013-13; Schedule C line 30). */
export const HOME_OFFICE = { perSqFt: 5, maxSqFt: 300 };
/** De minimis safe harbor limit per item or invoice without an applicable financial statement (Reg. 1.263(a)-1(f)(1)(ii)(D); Notice 2015-82). */
export const DE_MINIMIS_USD = 2500;

export const KM_PER_MILE = 1.609344;
export const SQFT_PER_SQM = 10.7639104;

/** ADS recovery periods (Pub 946, Table B-1) for the asset kinds Lou offers. */
export const ADS_YEARS = { computer: 5, furniture: 10, equipment: 10 } as const;

export interface BusinessAsset {
  description: string;
  kind: keyof typeof ADS_YEARS | 'other';
  /** ADS recovery period in years, for kind 'other' (Pub 946, Table B-1/B-2). */
  recoveryYears?: number;
  costCad: number;
  /** ISO date placed in service. */
  placedInService: string;
  /** CAD per USD on the purchase date, when the date is outside Lou's bundled rates. */
  rateOverride?: number;
  businessUsePct: number;
}

export interface Business {
  id: string;
  /** Copied from this tax year: this year's income and expenses still need entering or confirming. */
  carried?: number;
  owner: 'taxpayer' | 'spouse';
  name: string;
  /** Principal business or profession (line A). */
  activity: string;
  /** 6-digit business code (line B; NAICS-based, like the T2125 industry code). */
  code: string;
  accounting: 'cash' | 'accrual';
  grossCad: number;
  returnsCad: number;
  cogsCad: number;
  otherIncomeCad: number;
  expensesCad: Partial<Record<SchCExpenseLine, number>>;
  /** Descriptions for "Other expenses" (Part V). */
  otherDescription?: string;
  /** Business meals (100% of the amount paid). Entertainment is not deductible at all. */
  mealsCad: number;
  vehicle?: {
    businessKm: number; commutingKm: number; totalKm: number; parkingTollsCad: number;
    placedInService: string; personalUseAvailable: boolean; anotherVehicle: boolean; evidence: boolean; writtenEvidence: boolean;
  };
  homeOffice?: { homeSqM: number; officeSqM: number; regularExclusive: boolean };
  assets: BusinessAsset[];
  /** Expense items costing US$2,500 or less (de minimis safe harbor election, statement attached). */
  deMinimis: boolean;
  /** Capital (equipment, inventory) is a material income-producing factor: Form 2555 limits earned income to 30% of profit. */
  capitalMaterial: boolean;
  materiallyParticipated: boolean;
  /** T2125 net income (CAD), used only to split Canadian tax between Form 1116 categories. */
  canadianNetCad?: number;
}

export interface AssetDepreciation {
  asset: BusinessAsset;
  basisUsd: number;
  rate: number;
  rateDate?: string;
  convention: 'HY' | 'MQ';
  recoveryYears: number;
  deduction: number;
  /** Expensed this year under the de minimis safe harbor instead of depreciated. */
  expensed: boolean;
  /** Placed in service this tax year (Form 4562 line 20). */
  current: boolean;
}

export interface ScheduleCResult {
  business: Business;
  lines: Record<string, number>;
  depreciation: AssetDepreciation[];
  /** Form 4562 is required (property placed in service this year and depreciated). */
  needs4562: boolean;
  /** Miles for Part IV. */
  miles?: { business: number; commuting: number; other: number };
  homeOfficeSqFt?: { home: number; office: number };
  flags: Flag[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Quarter (1-4) of an ISO date. */
const quarter = (iso: string) => Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;

/**
 * ADS straight-line deduction for `year`, as a fraction of basis (Pub 946, Appendix A tables
 * A-8 to A-12 are these fractions). Half-year: 1/2 year first and last. Mid-quarter: the
 * first year counts from the middle of the quarter (10.5, 7.5, 4.5 or 1.5 months).
 */
export function adsFraction(recoveryYears: number, placedYear: number, q: number, convention: 'HY' | 'MQ', year: number): number {
  const first = convention === 'HY' ? 0.5 : (12 - (3 * q - 1.5)) / 12;
  const k = year - placedYear; // 0 = year placed in service
  if (k < 0) return 0;
  const used = (n: number) => (n === 0 ? 0 : Math.min(recoveryYears, first + (n - 1))); // years of recovery used before year k
  const before = k === 0 ? 0 : used(k);
  const through = Math.min(recoveryYears, k === 0 ? first : first + k);
  return Math.max(0, through - before) / recoveryYears;
}

export function computeScheduleC(year: TaxYear, b: Business): ScheduleCResult {
  const rate = YEARS[year].irsAvgCadPerUsd;
  const usd = (cad: number | undefined) => dollars((cad ?? 0) / rate);
  const flags: Flag[] = [];
  const L: Record<string, number> = {};

  L['1'] = usd(b.grossCad);
  L['2'] = usd(b.returnsCad);
  L['3'] = L['1'] - L['2'];
  L['4'] = usd(b.cogsCad);
  L['5'] = L['3'] - L['4'];
  L['6'] = usd(b.otherIncomeCad);
  L['7'] = L['5'] + L['6'];

  for (const line of SCHC_EXPENSE_LINES) L[line] = usd(b.expensesCad[line]);
  L['24b'] = usd((b.mealsCad ?? 0) * 0.5);

  // Line 9: standard mileage rate (business miles x rate) plus business parking and tolls.
  let miles: ScheduleCResult['miles'];
  if (b.vehicle && b.vehicle.businessKm > 0) {
    const toMiles = (km: number) => Math.round(km / KM_PER_MILE);
    const business = toMiles(b.vehicle.businessKm);
    const commuting = toMiles(b.vehicle.commutingKm);
    const other = Math.max(0, toMiles(b.vehicle.totalKm) - business - commuting);
    miles = { business, commuting, other };
    L['9'] = dollars(business * MILEAGE_RATE[year]) + usd(b.vehicle.parkingTollsCad);
  } else L['9'] = 0;

  // ---- Depreciation (ADS) and de minimis items ----
  const depreciation: AssetDepreciation[] = [];
  const conventionFor = new Map<number, 'HY' | 'MQ'>();
  const rated = b.assets.map((asset) => {
    const r = asset.rateOverride ? { rate: asset.rateOverride, on: undefined } : dailyRate(asset.placedInService);
    const basisUsd = r ? dollars((asset.costCad * Math.min(100, Math.max(0, asset.businessUsePct)) / 100) / r.rate) : 0;
    const unitUsd = r ? asset.costCad / r.rate : 0;
    const expensed = b.deMinimis && !!r && unitUsd <= DE_MINIMIS_USD && Number(asset.placedInService.slice(0, 4)) === year;
    if (!r) flags.push({ id: `fx-${b.id}-${asset.description}`, severity: 'block',
      title: `Exchange rate needed for ${asset.description || 'an asset'}`,
      detail: `Lou has Bank of Canada rates from 2007-05-01. Enter the CAD per USD rate for ${asset.placedInService || 'the purchase date'}.` });
    return { asset, r, basisUsd, expensed };
  });
  // Mid-quarter convention: more than 40% of the year's depreciable basis placed in service in Q4 (Pub 946, ch. 4).
  const byYear = new Map<number, typeof rated>();
  for (const x of rated) {
    if (x.expensed || !x.r) continue;
    const y = Number(x.asset.placedInService.slice(0, 4));
    byYear.set(y, [...(byYear.get(y) ?? []), x]);
  }
  for (const [y, xs] of byYear) {
    const total = sum(xs.map((x) => x.basisUsd));
    const q4 = sum(xs.filter((x) => quarter(x.asset.placedInService) === 4).map((x) => x.basisUsd));
    conventionFor.set(y, total > 0 && q4 > 0.4 * total ? 'MQ' : 'HY');
  }
  for (const x of rated) {
    const placedYear = Number(x.asset.placedInService.slice(0, 4));
    if (placedYear > year || !x.r) continue;
    const recoveryYears = x.asset.kind === 'other' ? x.asset.recoveryYears ?? 0 : ADS_YEARS[x.asset.kind];
    if (!x.expensed && !(recoveryYears > 0)) {
      flags.push({ id: `ads-${b.id}-${x.asset.description}`, severity: 'block', title: `Recovery period needed for ${x.asset.description || 'an asset'}`,
        detail: 'Enter the ADS recovery period from IRS Pub 946, Table B-1 or B-2.' });
      continue;
    }
    const convention = conventionFor.get(placedYear) ?? 'HY';
    const deduction = x.expensed ? x.basisUsd
      : dollars(x.basisUsd * adsFraction(recoveryYears, placedYear, quarter(x.asset.placedInService), convention, year));
    depreciation.push({ asset: x.asset, basisUsd: x.basisUsd, rate: x.r.rate, rateDate: x.r.on, convention, recoveryYears,
      deduction, expensed: x.expensed, current: placedYear === year });
  }
  const deMinimisTotal = sum(depreciation.filter((d) => d.expensed).map((d) => d.deduction));
  L['22'] += deMinimisTotal; // de minimis items are deducted as supplies
  L['13'] = sum(depreciation.filter((d) => !d.expensed).map((d) => d.deduction));
  const needs4562 = depreciation.some((d) => d.current && !d.expensed && d.deduction > 0);

  L['28'] = sum(['8', '9', '10', '11', '12', '13', '14', '15', '16a', '16b', '17', '18', '19', '20a', '20b', '21', '22', '23', '24a', '24b', '25', '26', '27a', '27b'].map((k) => L[k] ?? 0));
  L['29'] = L['7'] - L['28'];

  // Line 30: simplified method, limited to the tentative profit (gross income limit).
  let homeOfficeSqFt: ScheduleCResult['homeOfficeSqFt'];
  L['30'] = 0;
  if (b.homeOffice && b.homeOffice.officeSqM > 0) {
    homeOfficeSqFt = { home: Math.round(b.homeOffice.homeSqM * SQFT_PER_SQM), office: Math.round(b.homeOffice.officeSqM * SQFT_PER_SQM) };
    if (b.homeOffice.regularExclusive) {
      L['30'] = Math.max(0, Math.min(L['29'], Math.min(HOME_OFFICE.maxSqFt, homeOfficeSqFt.office) * HOME_OFFICE.perSqFt));
    } else flags.push({ id: `home-${b.id}`, severity: 'info', title: 'No home office deduction',
      detail: 'The US home office deduction needs a part of your home used regularly and only for the business.' });
  }
  L['31'] = L['29'] - L['30'];

  if (L['31'] < 0 && !b.materiallyParticipated) flags.push({ id: `passive-${b.id}`, severity: 'warn',
    title: 'A business loss without material participation is a passive loss',
    detail: 'Form 8582 limits passive losses. Lou deducts the full loss; review Form 8582 before filing.' });
  if (b.capitalMaterial) flags.push({ id: `capital-${b.id}`, severity: 'info',
    title: 'Capital is a material part of your business',
    detail: 'For Form 2555 only 30% of the business profit can count as earned income. Lou applies that limit if you use the exclusion.' });

  return { business: b, lines: L, depreciation, needs4562, miles, homeOfficeSqFt, flags };
}
