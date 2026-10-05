// "Install Lou" (its own window and icon, works offline) and the banners an installed Lou needs:
// a new version is ready, or a .lou file was opened with Lou.

import { applyUpdate, clearLaunchFile, installHint, installLou, usePwa } from '../pwa';
import { Callout } from '../ui/kit';
import { BackupPanel } from './Backup';

export function InstallLou({ compact = false }: { compact?: boolean }) {
  const { canInstall, installed } = usePwa();
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
  if (compact || !hint || hint === 'other') return null;
  return (
    <p className="small muted">
      {hint === 'safari-ios'
        ? 'To install Lou, tap the Share button, then "Add to Home Screen". It then opens like an app and works offline.'
        : 'To install Lou, choose File > Add to Dock in Safari. It then opens in its own window and works offline.'}
    </p>
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
