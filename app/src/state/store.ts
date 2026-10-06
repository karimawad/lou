// App state. Auto-saves on this device (Karim's decision, 2026-10-03): JSON in
// localStorage, page images in IndexedDB. "Clear my data" removes both.

import type { BoxRead } from '../extract/types';
import type { Dependent, Elections, Feie2555Details, FeieFacts, PriorFtcCarryover, Person, SlipAnswers } from '../tax/model';
import type { ForeignAccount } from '../tax/accounts';
import type { Business } from '../tax/business';
import type { CapitalLossCarryover, CapitalSale } from '../tax/capital';
import type { PficFund } from '../tax/pfic';
import type { SlipType } from '../tax/slips';
import type { FilingStatus, TaxYear } from '../tax/years';
import { seedYear } from './carry';

export type StepId = 'start' | 'you' | 'slips' | 'review' | 'questions' | 'results';
export const STEPS: { id: StepId; label: string }[] = [
  { id: 'start', label: 'Tax year' },
  { id: 'you', label: 'About you' },
  { id: 'slips', label: 'Your slips' },
  { id: 'review', label: 'Check the numbers' },
  { id: 'questions', label: 'A few questions' },
  { id: 'results', label: 'Your US return' },
];

export interface DocRecord {
  id: string;
  name: string;
  kind: 'pdf' | 'image' | 'csv';
  method: 'fields' | 'text' | 'ocr' | 'csv' | 'none';
  addedAt: number;
  /** IndexedDB keys for page preview images. */
  previewKeys: string[];
  previewScale: number[];
  errors: string[];
}

export interface SlipRecord {
  id: string;
  type: SlipType;
  owner: 'taxpayer' | 'spouse';
  payer: string;
  year?: number;
  docId?: string;
  /** Current values (CAD). Edited values replace reads. */
  boxes: Record<string, number>;
  /** What Lou read from the document, kept for the "show the work" view. */
  reads: Record<string, BoxRead>;
  /** Boxes the user changed by hand. */
  edited: string[];
  confirmed: boolean;
  answers?: SlipAnswers;
  /** T1 return only: answers for the slips Lou derives from its income lines, keyed by line (see state/t1.ts). */
  derivedAnswers?: Record<string, SlipAnswers>;
  /** A slip Lou made from a T1 income line (never saved; rebuilt from the T1 each time). */
  fromT1Line?: string;
}

export interface AppState {
  version: 1;
  step: StepId;
  year: TaxYear | null;
  filingStatus: FilingStatus | null;
  /** For married filers: is the spouse a US citizen or green card holder? */
  spouseIsUsPerson: boolean | null;
  taxpayer: Person;
  spouse: Person;
  dependents: Dependent[];
  address: { street: string; city: string; province: string; postalCode: string; country: string };
  livedInCanadaAllYear: boolean | null;
  digitalAssets: boolean | null;
  /** Aggregate Canadian accounts over US$10,000 at any time (FBAR). */
  accountsOver10k: boolean | null;
  docs: DocRecord[];
  slips: SlipRecord[];
  elections: Elections;
  carryover: PriorFtcCarryover;
  feieFacts: FeieFacts;
  feie2555: Partial<Record<'taxpayer' | 'spouse', Feie2555Details>>;
  /** Canadian accounts for FBAR and Form 8938. */
  accounts: ForeignAccount[];
  /** User confirmed they have no Canadian financial accounts. */
  noAccounts: boolean;
  /** Self-employment businesses (T2125). */
  businesses: Business[];
  /** Sales of shares and fund units (T5008 and broker reports). */
  sales: CapitalSale[];
  /** Canadian mutual funds and ETFs (PFICs). */
  pficFunds: PficFund[];
  /** Capital loss carryover typed in from last year's return (USD); empty means none or automatic. */
  capitalLossCarryover: CapitalLossCarryover | null;
  /** The year this one was started from (accounts, businesses, ... were copied from it), if any. */
  carryFrom: TaxYear | null;
  /** "Bring in from another year" offers the user turned down, by section. */
  carryDismissed: string[];
  /** Other tax years' data, put away while this year is active (multi-year workspace). */
  years: Partial<Record<TaxYear, YearData>>;
  /** Lou keys bought with Stripe (see license/key.ts). Shared by all years, kept in backups, survive "Clear my data". */
  licenses: string[];
  savedAt?: number;
}

/**
 * Fields that belong to one tax year. Everything else (you, your spouse, the address) is shared.
 * Dependents are per year (a child can be born, turn 17, or move out); a new year starts with a copy.
 */
export const YEAR_KEYS = [
  'step', 'filingStatus', 'dependents', 'spouseIsUsPerson', 'livedInCanadaAllYear', 'digitalAssets', 'accountsOver10k', 'docs', 'slips',
  'elections', 'carryover', 'feieFacts', 'feie2555', 'accounts', 'noAccounts', 'businesses', 'sales', 'pficFunds', 'capitalLossCarryover',
  'carryFrom', 'carryDismissed',
] as const;
export type YearData = Pick<AppState, (typeof YEAR_KEYS)[number]>;

/** A new year: what rarely changes comes from the nearest year already started (state/carry.ts). */
function freshYear(state: AppState, year: TaxYear): YearData {
  const init = initialState();
  return {
    ...(Object.fromEntries(YEAR_KEYS.map((k) => [k, init[k]])) as YearData),
    step: 'you',
    // The very first year: keep anything typed before a year was chosen.
    filingStatus: state.filingStatus, spouseIsUsPerson: state.spouseIsUsPerson, livedInCanadaAllYear: state.livedInCanadaAllYear,
    ...seedYear(state, year),
  };
}

/** The data for a tax year, whether it is the active year or put away. */
export function yearData(state: AppState, year: TaxYear): YearData | undefined {
  if (state.year === year) return Object.fromEntries(YEAR_KEYS.map((k) => [k, state[k]])) as YearData;
  return state.years[year];
}

/** A full state with `year` active (used to compute other years without switching the UI). */
export function stateForYear(state: AppState, year: TaxYear): AppState | null {
  const d = yearData(state, year);
  return d ? { ...state, ...d, year } : null;
}

/** Puts the active year's data away and loads (or starts) another year. */
export function switchYear(state: AppState, year: TaxYear): AppState {
  if (state.year === year) return state;
  const years = { ...state.years };
  if (state.year) years[state.year] = yearData(state, state.year);
  // Years saved by an older version may lack newer per-year keys: fill them so nothing leaks from the active year.
  const init = initialState();
  const filled = years[year] && { ...(Object.fromEntries(YEAR_KEYS.map((k) => [k, init[k]])) as YearData), dependents: state.dependents, ...(years[year] as Partial<YearData>) };
  const next = filled ?? freshYear({ ...state, years }, year);
  delete years[year];
  return { ...state, ...next, year, years };
}

/** Adds slips/docs to another year's workspace without switching to it. */
export function addToYear(state: AppState, year: TaxYear, docs: DocRecord[], slips: SlipRecord[]): AppState {
  if (state.year === year) return { ...state, docs: [...state.docs, ...docs], slips: [...state.slips, ...slips] };
  const d = state.years[year] ?? freshYear(state, year);
  return { ...state, years: { ...state.years, [year]: { ...d, docs: [...d.docs, ...docs], slips: [...d.slips, ...slips] } } };
}

const emptyPerson = (): Person => ({ firstName: '', lastName: '', ssn: '', dateOfBirth: '', occupation: '' });

export function initialState(): AppState {
  return {
    version: 1,
    step: 'start',
    year: null,
    filingStatus: null,
    spouseIsUsPerson: null,
    taxpayer: emptyPerson(),
    spouse: emptyPerson(),
    dependents: [],
    address: { street: '', city: '', province: '', postalCode: '', country: 'Canada' },
    livedInCanadaAllYear: null,
    digitalAssets: null,
    accountsOver10k: null,
    docs: [],
    slips: [],
    elections: { feie: 'auto', canadianSocialSecurityExempt: true, useAdjustmentException: true },
    carryover: { general: 0, passive: 0 },
    feieFacts: { bonaFideResident: true, residenceStart: '', daysInUs: 0 },
    feie2555: {},
    accounts: [],
    noAccounts: false,
    businesses: [],
    sales: [],
    pficFunds: [],
    capitalLossCarryover: null,
    carryFrom: null,
    carryDismissed: [],
    years: {},
    licenses: [],
  };
}

const KEY = 'lou:v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) return initialState();
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked (private mode): keep working in memory.
  }
}

// ---- Page images in IndexedDB ----

const DB = 'lou';
const STORE = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(key: string, blob: Blob) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* previews are a convenience; the return doesn't depend on them */ }
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch { return undefined; }
}

/** Any structured-cloneable value in the same store (used for the auto-save folder handle). `undefined` deletes. */
export async function putValue(key: string, value: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      if (value === undefined) tx.objectStore(STORE).delete(key); else tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* not available (private mode): auto-save to a folder just stays off */ }
}

export async function getValue<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch { return undefined; }
}

/** Removes everything Lou stored on this device. */
export async function clearAllData() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch { resolve(); }
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
