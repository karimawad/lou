// Automatic saving to a folder the user picks (Chrome and Edge on a computer: File System Access API).
// Lou keeps the folder handle in this browser's IndexedDB and, after each change, writes
// "Lou-autosave.lou" (overwritten every time) plus one dated copy per day ("Lou-backup-YYYY-MM-DD.lou", overwritten
// all day). Only the newest KEEP_DATED dated copies stay; older ones Lou made are deleted so the folder never fills up.
// Same format as a backup file, so either can be restored anywhere. Nothing is sent anywhere.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { backupFileName, createBackup } from './backup';
import { getBlob, getValue, putValue, type AppState } from './store';

type Perm = 'granted' | 'denied' | 'prompt';
interface DirHandle {
  name: string;
  queryPermission(o: { mode: 'readwrite' }): Promise<Perm>;
  requestPermission(o: { mode: 'readwrite' }): Promise<Perm>;
  entries(): AsyncIterable<[string, { kind: 'file' | 'directory' }]>;
  removeEntry(name: string): Promise<void>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }> }>;
}

export const AUTOSAVE_NAME = 'Lou-autosave.lou';
const HANDLE_KEY = '__folder';
const KEEP_DATED = 2;
const DATED = /^Lou-backup-\d{4}-\d{2}-\d{2}\.lou$/;

/** Deletes the oldest dated copies Lou wrote (only names Lou itself makes), keeping the newest few. A failure here never blocks a save. */
async function pruneDated(h: DirHandle) {
  try {
    const names: string[] = [];
    for await (const [name, e] of h.entries()) if (e.kind === 'file' && DATED.test(name)) names.push(name);
    names.sort(); // the date in the name sorts oldest first
    for (const name of names.slice(0, Math.max(0, names.length - KEEP_DATED))) await h.removeEntry(name);
  } catch { /* leave the files alone */ }
}

export type FolderStatus =
  | { kind: 'unsupported' }
  | { kind: 'none' }
  | { kind: 'needs-permission'; folder: string }
  | { kind: 'connected'; folder: string; savedAt?: number; saving?: boolean }
  | { kind: 'error'; folder: string; message: string };

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

let status: FolderStatus = folderSupported() ? { kind: 'none' } : { kind: 'unsupported' };
let handle: DirHandle | null = null;
const listeners = new Set<() => void>();
const set = (s: FolderStatus) => { status = s; listeners.forEach((l) => l()); };

/** Looks for a folder chosen in an earlier visit. Writing again may need one click (browser rule). */
export async function loadFolder() {
  if (!folderSupported()) return;
  const h = await getValue<DirHandle>(HANDLE_KEY);
  if (!h) return set({ kind: 'none' });
  handle = h;
  const p = await h.queryPermission({ mode: 'readwrite' });
  set(p === 'granted' ? { kind: 'connected', folder: h.name } : { kind: 'needs-permission', folder: h.name });
}

export async function chooseFolder(): Promise<boolean> {
  try {
    const h = await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker({ id: 'lou', mode: 'readwrite', startIn: 'documents' });
    handle = h;
    await putValue(HANDLE_KEY, h);
    set({ kind: 'connected', folder: h.name });
    return true;
  } catch { return false; } // the user closed the picker
}

/** Must be called from a click: the browser asks the user to allow Lou to keep saving there. */
export async function reconnectFolder() {
  if (!handle) return;
  const p = await handle.requestPermission({ mode: 'readwrite' });
  set(p === 'granted' ? { kind: 'connected', folder: handle.name } : { kind: 'needs-permission', folder: handle.name });
}

export async function forgetFolder() {
  handle = null;
  await putValue(HANDLE_KEY, undefined);
  set({ kind: 'none' });
}

export async function writeToFolder(state: AppState) {
  if (!handle || status.kind !== 'connected') return;
  const folder = handle.name;
  set({ ...status, saving: true });
  try {
    const text = await createBackup(state, getBlob);
    for (const name of [AUTOSAVE_NAME, backupFileName()]) {
      const w = await (await handle.getFileHandle(name, { create: true })).createWritable();
      await w.write(text);
      await w.close();
    }
    await pruneDated(handle);
    set({ kind: 'connected', folder, savedAt: Date.now() });
  } catch (e) {
    const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    set(denied ? { kind: 'needs-permission', folder } : { kind: 'error', folder, message: "Lou couldn't write to that folder. Check it still exists, or choose another." });
  }
}

export function useFolderStatus(): FolderStatus {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status, () => status);
}

/** Saves to the folder a few seconds after the user stops changing things (and catches up on changes made mid-save). */
export function useFolderAutosave(state: AppState) {
  const timer = useRef<number | undefined>(undefined);
  const written = useRef<AppState | null>(null);
  const s = useFolderStatus();
  const saving = s.kind === 'connected' && !!s.saving;
  useEffect(() => { void loadFolder(); }, []);
  useEffect(() => {
    if (s.kind !== 'connected' || saving || written.current === state) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { written.current = state; void writeToFolder(state); }, 2500);
    return () => window.clearTimeout(timer.current);
  }, [state, s.kind, saving]);
}
