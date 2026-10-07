// "Your data": everything about where Lou keeps your information, in one place that works on every screen size.
// Replaces the long panel that used to sit at the bottom of the left rail (and the sections on the start page).

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/context';
import { chooseFolder, folderSupported, reconnectFolder, useFolderStatus } from '../state/folderSync';
import { installHint, usePwa } from '../pwa';
import { Lock } from '../ui/icons';
import { BackupPanel, FolderSync } from './Backup';
import { InstallLou } from './Install';
import { LicenseSection } from './Unlock';

/** Small status card for the rail: says where the data lives and opens the full panel. */
/** One line for the phone top bar (the rail is hidden there): what has been saved, and when. */
export function SaveLine() {
  const { savedAt } = useApp();
  const folder = useFolderStatus();
  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const paused = folder.kind === 'needs-permission' || folder.kind === 'error';
  return (
    <div className="save-line" role="status" aria-live="polite">
      <span className="sync-dot" aria-hidden="true" />
      <span>{savedAt ? `Saved in this browser at ${time(savedAt)}` : 'Saves in this browser as you go'}
        {folder.kind === 'connected' && folder.savedAt ? ` · and to ${folder.folder} at ${time(folder.savedAt)}` : ''}
        {paused ? ' · folder saving paused' : ''}</span>
      {folder.kind === 'none' && <button type="button" className="linkish" onClick={() => void chooseFolder()}>Save to a folder</button>}
      {paused && <button type="button" className="linkish" onClick={() => void (folder.kind === 'error' ? chooseFolder() : reconnectFolder())}>Fix</button>}
    </div>
  );
}

export function YourDataCard({ onOpen }: { onOpen: () => void }) {
  const { savedAt } = useApp();
  const folder = useFolderStatus();
  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="data-card">
      <div className="data-card-title"><Lock size={16} /> Saved on this device only</div>
      <p>No account, nothing uploaded.</p>
      {/* Peace of mind: always say what has been saved, and when. */}
      <div className="save-status" role="status" aria-live="polite">
        <p><span className="sync-dot" aria-hidden="true" /> {savedAt ? `Saved in this browser at ${time(savedAt)}` : 'Saves in this browser as you go'}</p>
        {folder.kind === 'connected' && (
          <p><span className="sync-dot" aria-hidden="true" /> {folder.saving ? 'Saving to ' : folder.savedAt ? `Saved to ${folder.folder} at ${time(folder.savedAt)}` : 'Saving automatically to '}{!folder.savedAt || folder.saving ? <strong>{folder.folder}</strong> : null}</p>
        )}
        {folder.kind === 'needs-permission' && <p className="save-warn">Your browser paused saving to {folder.folder}.</p>}
        {folder.kind === 'error' && <p className="save-warn">{folder.message}</p>}
      </div>
      {folder.kind === 'none' && (
        <>
          <p className="small">Also keep a copy on your computer?</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void chooseFolder()}>Save automatically…</button>
        </>
      )}
      {folder.kind === 'needs-permission' && <button type="button" className="btn btn-primary btn-sm" onClick={() => void reconnectFolder()}>Keep saving to {folder.folder}</button>}
      {folder.kind === 'error' && <button type="button" className="btn btn-primary btn-sm" onClick={() => void chooseFolder()}>Choose a folder…</button>}
      <button type="button" className="btn btn-secondary btn-sm" onClick={onOpen}>Your data</button>
    </div>
  );
}

export function YourDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { reset } = useApp();
  const pwa = usePwa();
  const [confirmClear, setConfirmClear] = useState(false);
  const canInstallOrHint = !pwa.installed && (pwa.canInstall || installHint() !== null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) setConfirmClear(false);
  }, [open]);

  return (
    <dialog ref={ref} className="data-dialog" aria-labelledby="data-title" onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="data-dialog-body">
        <div className="data-dialog-head">
          <h2 id="data-title">Your data</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <p className="muted">
          What you enter and the slips you add are kept in this browser, on this device. Lou has no account and uploads nothing.
          {' '}<a href="/legal/privacy.html" target="_blank" rel="noopener">Privacy policy</a>
        </p>

        <LicenseSection />

        <section className="data-section">
          <h3>Back up and restore</h3>
          <p className="small muted">A backup file holds everything for all years. Use it to move to another browser or computer, or as a safety copy.</p>
          <BackupPanel onDone={onClose} />
        </section>

        {folderSupported() && (
          <section className="data-section">
            <h3>Save automatically</h3>
            <FolderSync />
          </section>
        )}

        {canInstallOrHint && (
          <section className="data-section">
            <h3>Install Lou</h3>
            <InstallLou />
          </section>
        )}

        <section className="data-section">
          <h3>Clear this device</h3>
          <p className="small muted">Removes everything Lou saved in this browser, except your key. Save a backup first if you want to keep your work.</p>
          {confirmClear ? (
            <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center' }}>
              <button type="button" className="linkish danger" onClick={async () => { await reset(); setConfirmClear(false); onClose(); }}>Yes, clear everything</button>
              <button type="button" className="linkish" onClick={() => setConfirmClear(false)}>Keep it</button>
            </div>
          ) : (
            <button type="button" className="linkish danger" onClick={() => setConfirmClear(true)}>Clear my data from this device</button>
          )}
        </section>
      </div>
    </dialog>
  );
}
