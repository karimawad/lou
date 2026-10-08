// Save everything to a file on this computer, or bring it back (another browser, another computer).

import { useEffect, useRef, useState } from 'react';
import { BackupError, backupFileName, createBackup, inspectBackup, openBackup } from '../state/backup';
import { useApp } from '../state/context';
import { chooseFolder, folderSupported, forgetFolder, reconnectFolder, useFolderStatus } from '../state/folderSync';
import { getBlob } from '../state/store';
import { Download, Upload } from '../ui/icons';
import { Callout, TextInput } from '../ui/kit';

type Mode = { kind: 'idle' } | { kind: 'save' } | { kind: 'restore'; text: string; name: string; encrypted: boolean; createdAt: string };

/** `initialFile`: a .lou file the user opened with the installed Lou (goes straight to the restore step). */
export function BackupPanel({ compact = false, restoreOnly = false, initialFile, onDone }: { compact?: boolean; restoreOnly?: boolean; initialFile?: File; onDone?: () => void }) {
  const { state, restore } = useApp();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'block'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasData = state.slips.length > 0 || Object.keys(state.years).length > 0 || !!state.taxpayer.lastName;

  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      const text = await createBackup(state, getBlob, password || undefined);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      Object.assign(document.createElement('a'), { href: url, download: backupFileName() }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage({ tone: 'ok', text: `Saved ${backupFileName()}${password ? ', locked with your password' : ''}. Keep it somewhere safe: it has your tax information.` });
      setMode({ kind: 'idle' }); setPassword('');
    } catch {
      setMessage({ tone: 'block', text: "The backup couldn't be made. Try again." });
    } finally { setBusy(false); }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const text = await file.text();
    try {
      const info = inspectBackup(text);
      setPassword('');
      setMode({ kind: 'restore', text, name: file.name, ...info });
    } catch (e) {
      setMessage({ tone: 'block', text: e instanceof BackupError ? e.message : "This file couldn't be read." });
    }
  };

  const doRestore = async () => {
    if (mode.kind !== 'restore') return;
    setBusy(true); setMessage(null);
    try {
      const b = await openBackup(mode.text, password || undefined);
      await restore(b.state, b.blobs);
      setMode({ kind: 'idle' }); setPassword('');
      setMessage({ tone: 'ok', text: `Restored from ${mode.name}.` });
      onDone?.();
    } catch (e) {
      setMessage({ tone: 'block', text: e instanceof BackupError ? e.message : "This backup couldn't be restored." });
    } finally { setBusy(false); }
  };

  useEffect(() => { if (initialFile) void pick(initialFile); }, [initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkish = compact ? 'linkish' : 'btn btn-secondary btn-sm';
  return (
    <div className="backup" style={{ display: 'grid', gap: 'var(--s-3)' }}>
      {mode.kind === 'idle' && (
        <div style={{ display: 'flex', gap: compact ? 'var(--s-3)' : 'var(--s-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasData && !restoreOnly && <button type="button" className={linkish} onClick={() => { setMessage(null); setMode({ kind: 'save' }); }}>{!compact && <Download size={16} />} Save a backup file</button>}
          <button type="button" className={linkish} onClick={() => fileInput.current?.click()}>{!compact && <Upload size={16} />} Restore from a backup</button>
          <input ref={fileInput} type="file" accept=".lou,application/json" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      )}

      {mode.kind === 'save' && (
        <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
          <TextInput label="Password for the file (optional)" type="password" autoComplete="new-password" value={password} onChange={setPassword}
            hint="Recommended: the file holds your SSN and income. Without the password the backup can't be opened, and Lou can't recover it." />
          <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}><Download size={16} /> {busy ? 'Saving…' : 'Save backup file'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode({ kind: 'idle' }); setPassword(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {mode.kind === 'restore' && (
        <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
          <p className="small">{mode.name}, saved {new Date(mode.createdAt).toLocaleString()}.{hasData ? ' Restoring replaces everything Lou has in this browser now.' : ''}</p>
          {mode.encrypted && (
            <TextInput label="Backup password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
          )}
          <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || (mode.encrypted && !password)} onClick={doRestore}>
              <Upload size={16} /> {busy ? 'Restoring…' : hasData ? 'Replace with this backup' : 'Restore'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode({ kind: 'idle' }); setPassword(''); onDone?.(); }}>Cancel</button>
          </div>
        </div>
      )}

      {message && (compact
        ? <p className={`small ${message.tone === 'block' ? 'error-text' : 'muted'}`} role="status">{message.text}</p>
        : <Callout tone={message.tone}>{message.text}</Callout>)}
    </div>
  );
}

/** Chrome and Edge on a computer: keep saving to a folder the user picks. Elsewhere, nothing (backup files cover it). */
export function FolderSync({ compact = false }: { compact?: boolean }) {
  const st = useFolderStatus();
  if (!folderSupported() || st.kind === 'unsupported') {
    return compact ? null : <p className="small muted">Automatic saving to a folder works in Chrome and Edge on a computer. In this browser, use "Save a backup file" to keep a copy on your computer.</p>;
  }
  const btn = compact ? 'linkish' : 'btn btn-secondary btn-sm';
  const time = (t?: number) => (t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);
  return (
    <div className="folder-sync" style={{ display: 'grid', gap: 'var(--s-2)' }}>
      {st.kind === 'none' && (
        <>
          {!compact && <p className="small muted">Lou can also save automatically to a folder on this computer (for example Documents/Taxes) after every change: one
            file it keeps up to date, plus a dated copy for today and the day before (older copies are deleted so your folder does not fill up). Restore either one with "Restore from a backup".</p>}
          <div><button type="button" className={btn} onClick={() => void chooseFolder()}>{!compact && <FolderIcon />} Save automatically to a folder…</button></div>
        </>
      )}
      {st.kind === 'needs-permission' && (
        <>
          <p className="small">Lou saves to your folder <strong>{st.folder}</strong>. Your browser needs your OK again to keep saving there.</p>
          <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
            <button type="button" className={compact ? 'linkish' : 'btn btn-primary btn-sm'} onClick={() => void reconnectFolder()}>Keep saving to {st.folder}</button>
            <button type="button" className="linkish" onClick={() => void forgetFolder()}>Stop</button>
          </div>
        </>
      )}
      {st.kind === 'connected' && (
        <p className="small" role="status">
          <span className="sync-dot" aria-hidden="true" /> Saving automatically to <strong>{st.folder}</strong>
          {st.saving ? ' · saving…' : st.savedAt ? ` · last saved ${time(st.savedAt)}` : ''}
          {' '}<button type="button" className="linkish" onClick={() => void forgetFolder()}>Stop</button>
        </p>
      )}
      {st.kind === 'error' && (
        <>
          <p className="small error-text">{st.message}</p>
          <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
            <button type="button" className={btn} onClick={() => void chooseFolder()}>Choose a folder…</button>
            <button type="button" className="linkish" onClick={() => void forgetFolder()}>Stop</button>
          </div>
        </>
      )}
    </div>
  );
}

const FolderIcon = () => (
  <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 6a1.5 1.5 0 0 1 1.5-1.5h3.5l2 2H16a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5Z" />
  </svg>
);
