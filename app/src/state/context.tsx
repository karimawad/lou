import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { checkKey, cleanKey, problemText, yearsCovered } from '../license/key';
import { clearAllData, initialState, loadState, putBlob, saveState, switchYear, type AppState, type StepId } from './store';
import type { TaxYear } from '../tax/years';
import { yearCard } from './dashboard';
import { loadFolder, useFolderAutosave } from './folderSync';

interface Ctx {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  go: (step: StepId) => void;
  /** Switch the active tax year (the other year's data is kept). */
  openYear: (year: TaxYear) => void;
  reset: () => Promise<void>;
  /** Replaces everything with a restored backup (page images first, then the state). */
  restore: (state: AppState, blobs: { key: string; blob: Blob }[]) => Promise<void>;
  /** Tax years the saved keys unlock, or null while they are being checked. */
  entitled: number[] | null;
  /** When the work was last saved in this browser (null until the first save of this visit). */
  savedAt: number | null;
  /** Adds a pasted or emailed key. Resolves with the years it unlocks, or what is wrong with it. */
  addKey: (text: string) => Promise<{ ok: true; years: number[] } | { ok: false; message: string }>;
  /** A message about a key that arrived with the page address (from the thank-you page or an email link). */
  licenseNotice: { ok: boolean; text: string } | null;
  dismissLicenseNotice: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => { return { ...loadState(), step: 'home' as const }; });
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(state);
  latest.current = state;
  const [entitled, setEntitled] = useState<number[] | null>(() => (state.licenses.length ? null : []));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [licenseNotice, setLicenseNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Check the saved keys on this device (no network).
  const licenseList = JSON.stringify(state.licenses);
  useEffect(() => {
    let live = true;
    void yearsCovered(JSON.parse(licenseList) as string[]).then((y) => { if (live) setEntitled(y); });
    return () => { live = false; };
  }, [licenseList]);

  // Auto-save shortly after each change.
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveState(state); setSavedAt(Date.now()); }, 300);
    return () => window.clearTimeout(timer.current);
  }, [state]);

  // Chrome/Edge: also save to the folder the user chose, if any.
  useFolderAutosave(state);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const go = useCallback((step: StepId) => {
    setState((s) => ({ ...s, step }));
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => document.getElementById('main-heading')?.focus());
  }, []);
  const openYear = useCallback((year: TaxYear) => {
    // From Home or Catch-up a year link opens that year's own page, at the first thing still to do.
    setState((s) => {
      const next = switchYear(s, year);
      return s.step === 'home' || s.step === 'catchup' ? { ...next, step: yearCard(next, year, new Set()).next } : next;
    });
    window.scrollTo({ top: 0 });
  }, []);
  const reset = useCallback(async () => {
    const keys = latest.current.licenses; // a paid key is not tax data: clearing your data keeps it
    await clearAllData();
    setState({ ...initialState(), licenses: keys });
    void loadFolder();
  }, []);

  const addKey = useCallback(async (text: string) => {
    const r = await checkKey(text);
    if (!r.ok) return { ok: false as const, message: problemText(r.problem) };
    const key = cleanKey(text);
    setState((s) => (s.licenses.includes(key) ? s : { ...s, licenses: [...s.licenses, key] }));
    return { ok: true as const, years: r.payload.y };
  }, []);

  // A key arrives in the address after "#key=" (from the thank-you page or the email link). Take it, then tidy the address.
  useEffect(() => {
    if (!location.hash.startsWith('#key=')) return;
    let raw = '';
    try { raw = decodeURIComponent(location.hash.slice(5)); } catch { /* a damaged link: treated as an empty key below */ }
    history.replaceState(null, '', location.pathname + location.search);
    void addKey(raw).then((r) => setLicenseNotice(r.ok
      ? { ok: true, text: `Key added. Your ${r.years.length > 1 ? `${r.years[0]} to ${r.years[r.years.length - 1]}` : r.years[0]} returns are unlocked.` }
      : { ok: false, text: r.message }));
  }, [addKey]);

  const restore = useCallback(async (next: AppState, blobs: { key: string; blob: Blob }[]) => {
    await clearAllData();
    for (const b of blobs) await putBlob(b.key, b.blob);
    // Keep any key bought since the backup was made.
    const merged = { ...next, licenses: [...new Set([...(next.licenses ?? []), ...latest.current.licenses])] };
    saveState(merged);
    setState(merged);
    window.scrollTo({ top: 0 });
  }, []);

  return <AppCtx.Provider value={{ state, update, go, openYear, reset, restore, entitled, savedAt, addKey, licenseNotice, dismissLicenseNotice: () => setLicenseNotice(null) }}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}
