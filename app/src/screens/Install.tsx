// "Install Lou" (its own window and icon, works offline) and the banners an installed Lou needs:
// a new version is ready, or a .lou file was opened with Lou.

import { useState } from 'react';
import { applyUpdate, clearLaunchFile, installHint, installLou, usePwa } from '../pwa';
import { Callout } from '../ui/kit';
import { BackupPanel } from './Backup';

export function InstallLou({ compact = false }: { compact?: boolean }) {
  const { canInstall, installed } = usePwa();
  const [steps, setSteps] = useState(false);
  if (installed) return null;
  const hint = installHint();
  if (canInstall) {
    return compact
      ? <button type="button" className="linkish" onClick={() => void installLou()}>Install Lou on this computer</button>
      : (
        <div style={{ display: 'grid', gap: 'var(--s-2)', justifyItems: 'start' }}>
          <button type="button" className="btn btn-secondary" onClick={() => void installLou()}>Install Lou</button>
          <p className="small muted">Lou gets its own window and icon, and works without an internet connection. Your data stays on this computer.</p>
        </div>
      );
  }
  if (compact || !hint) return null;
  const note: Record<typeof hint, string> = {
    'safari-ios': 'To install Lou, tap the Share button, then "Add to Home Screen". It then opens like an app and works offline.',
    'safari-mac': 'To install Lou, choose File > Add to Dock in Safari. It then opens in its own window and works offline.',
    'android-menu': 'To install Lou, open your browser menu and choose "Install app" or "Add to Home screen".',
    'no-install': "Your browser can't install web apps on a computer, so Lou stays in a browser tab. It still works, and it can open offline after your first visit. To get the installed app, open Lou in Chrome or Edge. Either way, save a backup file to keep your work.",
    chromium: 'Your browser did not offer an install window. Look for the install icon at the right end of the address bar, or open the browser menu and choose "Install Lou" (in Chrome: Cast, save and share). If you already installed Lou, open it from your apps instead.',
    'maybe-menu': 'Your browser may offer "Install Lou" or "Add to Home screen" in its menu. If it does not, Lou still works in a normal tab, and a backup file keeps your work safe.',
  };
  // The browser gave no install prompt: a page cannot force one, so the button shows that browser's own steps.
  if (hint === 'no-install') return <p className="small muted">{note[hint]}</p>;
  return (
    <div style={{ display: 'grid', gap: 'var(--s-2)', justifyItems: 'start' }}>
      <button type="button" className="btn btn-secondary" aria-expanded={steps} onClick={() => setSteps((v) => !v)}>Install Lou</button>
      <p className="small muted" hidden={!steps} role="status">{note[hint]}</p>
      {!steps && <p className="small muted">Lou gets its own window and icon, and works without an internet connection. Your data stays on this computer.</p>}
    </div>
  );
}

export function PwaBanners() {
  const { updateReady, launchFile } = usePwa();
  return (
    <>
      {updateReady && (
        <div className="no-print" style={{ marginBottom: 'var(--s-5)' }}>
          <Callout tone="info" title="A new version of Lou is ready">
            <p>It may include fixes to tax rules or forms. Your progress is saved and stays as it is.</p>
            <div><button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>Use the new version</button></div>
          </Callout>
        </div>
      )}
      {launchFile && (
        <section className="section no-print" style={{ marginBottom: 'var(--s-6)' }}>
          <div className="section-head"><h2>Open this backup?</h2></div>
          <BackupPanel initialFile={launchFile} onDone={clearLaunchFile} />
        </section>
      )}
    </>
  );
}
