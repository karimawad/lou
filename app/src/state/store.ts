// App state. Auto-saves on this device (Karim's decision, 2026-10-03): JSON in
// localStorage, page images in IndexedDB. "Clear my data" removes both.

import type { BoxRead } from '../extract/types';
import type { Dependent, Elections, Feie2555Details, FeieFacts, PriorFtcCarryover, Person, SlipAnswers } from '../tax/model';
import type { ForeignAccount } from '../tax/accounts';
import type { Business } from '../tax/business';
import type { CapitalLossCarryover, CapitalSale } from '../tax/capital';
import type { PficFund } from '../tax/pfic';
import { emptyCatchup, type CatchupState } from '../tax/catchup';
import type { SlipType } from '../tax/slips';
import type { FilingStatus, TaxYear } from '../tax/years';
import { seedYear } from './carry';
import type { ReviewSnap } from './staleness';

export type StepId = 'start' | 'you' | 'slips' | 'review' | 'questions' | 'accounts' | 'results' | 'catchup';
export const STEPS: { id: StepId; label: string }[] = [
  { id: 'start', label: 'Tax year' },
  { id: 'you', label: 'About you' },
  { id: 'slips', label: 'Your slips' },
  { id: 'review', label: 'Check the numbers' },
  { id: 'questions', label: 'A few questions' },
  { id: 'accounts', label: 'Your Canadian accounts' },
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
  /** Catch-up filing (IRS Streamlined Foreign Offshore Procedures): answers, the Form 14653 statement, and FBAR-only years. Shared by all years. */
  catchup: CatchupState;
  /** Lou keys bought with Stripe (see license/key.ts). Shared by all years, kept in backups, survive "Clear my data". */
  licenses: string[];
  /** What carried into each year when the user last reviewed or downloaded it (state/staleness.ts). Shared by all years. */
  reviewed: Partial<Record<TaxYear, ReviewSnap>>;
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
  if (!d) return null;
  // The active year's data lives flat on `state`; put it away in `years` so code that looks at a neighbouring year
  // from the returned state (autoCarryover: the year before, staleness: the year after) still finds it.
  const years = { ...state.years };
  if (state.year && state.year !== year) years[state.year] = yearData(state, state.year);
  delete years[year];
  return { ...state, ...d, year, years };
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
    catchup: emptyCatchup(),
    licenses: [],
    reviewed: {},
  };
}

export const KEY = 'lou:v1';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const LIST_KEYS = ['dependents', 'docs', 'slips', 'accounts', 'businesses', 'sales', 'pficFunds', 'carryDismissed'] as const;
const RECORD_KEYS = ['elections', 'carryover', 'feieFacts', 'feie2555'] as const;

/** Makes the shape of per-year data safe: lists are lists, records are records (anything else would crash a screen). */
function fixYearShape(o: Record<string, unknown>, base: Record<string, unknown>) {
  for (const k of LIST_KEYS) o[k] = Array.isArray(o[k]) ? (o[k] as unknown[]).filter(isObj) : base[k] ?? [];
  for (const k of RECORD_KEYS) o[k] = isObj(o[k]) ? { ...(base[k] as object), ...(o[k] as object) } : base[k];
}

/**
 * Turns anything read from storage or from a backup file into a state the screens can safely use. Saved data can be old,
 * from another version, damaged, or hand-edited; a wrong shape must never blank the app. Unknown values fall back to defaults.
 */
export function sanitizeState(raw: unknown): AppState {
  const base = initialState();
  if (!isObj(raw) || raw.version !== 1) return base;
  const out: Record<string, unknown> = { ...base, ...raw };
  fixYearShape(out, base as unknown as Record<string, unknown>);
  for (const k of ['taxpayer', 'spouse', 'address'] as const) out[k] = isObj(out[k]) ? { ...base[k], ...(out[k] as object) } : base[k];
  out.licenses = Array.isArray(out.licenses) ? out.licenses.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 4000) : [];
  if (!STEPS.some((s) => s.id === out.step) && out.step !== 'catchup') out.step = 'start';
  out.catchup = sanitizeCatchup(out.catchup);
  const fin = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  out.reviewed = Object.fromEntries(Object.entries(isObj(out.reviewed) ? out.reviewed : {})
    .filter(([y, v]) => [2023, 2024, 2025].includes(Number(y)) && isObj(v) && typeof v.sig === 'string' && v.sig.length < 20000)
    .map(([y, v]) => { const o = v as Record<string, unknown>; return [y, { sig: o.sig as string, ftc: fin(o.ftc), amt: fin(o.amt), loss: fin(o.loss), back: fin(o.back), refund: fin(o.refund) }]; }));
  if (!(out.year === null || [2023, 2024, 2025].includes(out.year as number))) out.year = null;
  const years: Record<string, unknown> = {};
  if (isObj(out.years)) {
    for (const [y, v] of Object.entries(out.years)) {
      if (!isObj(v) || ![2023, 2024, 2025].includes(Number(y))) continue;
      const d = { ...v };
      fixYearShape(d, base as unknown as Record<string, unknown>);
      years[y] = d;
    }
  }
  out.years = years;
  return out as unknown as AppState;
}

const str = (x: unknown) => (typeof x === 'string' ? x.slice(0, 300) : '');
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
const KINDS = ['bank', 'investment', 'rrsp', 'rrif', 'tfsa', 'resp', 'fhsa', 'pension'];
/** An FBAR-only account typed in during catch-up: strings are strings and amounts are numbers. */
function fbarAccount(o: Record<string, unknown>): ForeignAccount {
  return {
    id: str(o.id) || uid(), owner: o.owner === 'spouse' || o.owner === 'joint' ? o.owner : 'taxpayer',
    kind: (KINDS.includes(o.kind as string) ? o.kind : 'bank') as ForeignAccount['kind'],
    institution: str(o.institution), street: str(o.street), city: str(o.city), province: str(o.province), postalCode: str(o.postalCode),
    accountNumber: str(o.accountNumber), maxValueCad: num(o.maxValueCad), yearEndValueCad: num(o.yearEndValueCad),
    opened: o.opened === true, closed: o.closed === true, ...(typeof o.carried === 'number' ? { carried: o.carried } : {}),
  };
}

const yearRecord = (v: unknown, ok: (x: unknown) => boolean) => Object.fromEntries(
  Object.entries(isObj(v) ? v : {}).filter(([k, x]) => /^\d{4}$/.test(k) && ok(x)));

/** Catch-up answers from storage or a backup: every field gets a safe shape so a damaged save can't blank the screen. */
export function sanitizeCatchup(raw: unknown): CatchupState {
  const base = emptyCatchup();
  if (!isObj(raw)) return base;
  const bool = (x: unknown) => typeof x === 'boolean';
  return {
    started: raw.started === true,
    screen: Object.fromEntries(Object.entries(isObj(raw.screen) ? raw.screen : {}).filter(([k, x]) => /^[a-zA-Z]{2,20}$/.test(k) && bool(x))),
    alreadyFiled: yearRecord(raw.alreadyFiled, bool),
    extension: yearRecord(raw.extension, bool),
    daysInUs: yearRecord(raw.daysInUs, (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 366),
    professionalAck: raw.professionalAck === true,
    mailDate: typeof raw.mailDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.mailDate) ? raw.mailDate : '',
    statement: Object.fromEntries(Object.entries(isObj(raw.statement) ? raw.statement : {})
      .filter((e): e is [string, string] => typeof e[1] === 'string').map(([k, v]) => [k.slice(0, 200), v.slice(0, 20000)])),
    fbar: Object.fromEntries(Object.entries(isObj(raw.fbar) ? raw.fbar : {})
      .filter(([k, v]) => /^\d{4}$/.test(k) && isObj(v))
      .map(([k, v]) => [k, { accounts: Array.isArray((v as Record<string, unknown>).accounts) ? ((v as Record<string, unknown>).accounts as unknown[]).filter(isObj).map(fbarAccount) : [], noAccounts: (v as Record<string, unknown>).noAccounts === true }])),
  } as CatchupState;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : initialState();
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
