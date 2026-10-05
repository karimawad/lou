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

export type InstallHint = 'safari-ios' | 'safari-mac' | 'android-menu' | 'no-install' | 'maybe-menu' | 'chromium';

/** Which install note fits this browser when it offered no install prompt. */
export function installHint(): InstallHint | null {
  const ua = navigator.userAgent;
  const android = /Android/.test(ua);
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  if (ios) return 'safari-ios';
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera|Firefox|FxiOS|CriOS/.test(ua)) return 'safari-mac';
  if (android) return 'android-menu';
  // Desktop Opera and Firefox do not install web apps at all.
  if (/OPR|Opera|Firefox/.test(ua)) return 'no-install';
  // Chrome and Edge normally offer install themselves. They stay quiet if Lou is already installed or the offer was dismissed.
  return /Edg|Chrome/.test(ua) && !/Brave|Vivaldi/.test(ua) ? 'chromium' : 'maybe-menu';
}
