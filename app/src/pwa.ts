// Installable web app plumbing: the service worker (offline + updates), the browser's install prompt,
// and .lou files opened from the computer (an installed Lou is registered for them in the manifest).

import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface LaunchParams { files: { getFile: () => Promise<File> }[] }

interface PwaState {
  /** The browser offered to install Lou (Chrome, Edge). */
  canInstall: boolean;
  /** Running as an installed app. */
  installed: boolean;
  /** A new version of Lou is downloaded and waiting. */
  updateReady: boolean;
  /** A .lou file the user opened with Lou. */
  launchFile: File | null;
}

let snapshot: PwaState = {
  canInstall: false,
  installed: typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true),
  updateReady: false,
  launchFile: null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach((l) => l()); };

let deferred: InstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;
let switching = false;

/** Called once, before React renders, so no early browser event is missed. */
export function startPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => { deferred = null; set({ canInstall: false, installed: true }); });

  const lq = (window as { launchQueue?: { setConsumer: (fn: (p: LaunchParams) => void) => void } }).launchQueue;
  lq?.setConsumer(async (params) => {
    const file = await params.files[0]?.getFile();
    if (file) set({ launchFile: file });
  });

  // Dev mode serves source files that change on every edit: only the production build registers the worker.
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const offer = (w: ServiceWorker | null) => { if (w && navigator.serviceWorker.controller) { waiting = w; set({ updateReady: true }); } };
      offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
      });
      // Check for a new version when Lou comes back to the foreground, and hourly while open.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update(); });
      setInterval(() => void reg.update(), 60 * 60 * 1000);
      // Reload only when the user chose the new version (the first install also changes the controller).
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (switching) { switching = false; location.reload(); } });
    } catch { /* offline use is a convenience; Lou still works online without it */ }
  });
}

export async function installLou() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  set({ canInstall: false });
}

/** Switches to the waiting version (the page reloads; Lou's saved progress is untouched). */
export function applyUpdate() { switching = true; waiting?.postMessage('SKIP_WAITING'); }

export function clearLaunchFile() { set({ launchFile: null }); }

export function usePwa(): PwaState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snapshot, () => snapshot);
}

/** Which install instructions fit this browser when there is no install prompt. */
export function installHint(): 'safari-mac' | 'safari-ios' | 'other' | null {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS|CriOS/.test(ua);
  if (ios) return 'safari-ios';
  if (safari) return 'safari-mac';
  return /Firefox/.test(ua) ? 'other' : null;
}
