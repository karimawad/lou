// Home: one card per tax year, what is missing, and a way into each year. The landing screen for anyone with saved work.

import { useMemo, useState } from 'react';
import { yearsLabel } from '../license/key';
import { useApp } from '../state/context';
import { yearCards, resultLine, type YearCard } from '../state/dashboard';
import { patchYear, switchYear, type FiledInfo, type StepId } from '../state/store';
import { staleReasons, staleYears } from '../state/staleness';
import { useFolderStatus } from '../state/folderSync';
import { Arrow, Check, Chevron, Lock, Plus } from '../ui/icons';
import { Callout } from '../ui/kit';
import { BackupPanel } from './Backup';
import { InstallLou } from './Install';
import { installHint, usePwa } from '../pwa';
import type { TaxYear } from '../tax/years';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

export function Home({ onOpenData }: { onOpenData: () => void }) {
  const { state, update, entitled, savedAt } = useApp();
  const cards = useMemo(() => yearCards(state), [state]);
  const stale = useMemo(() => staleYears(state), [state]);
  const folder = useFolderStatus();
  const [filing, setFiling] = useState<TaxYear | null>(null);
  const pwa = usePwa();
  const showInstall = !pwa.installed && (pwa.canInstall || installHint() !== null);

  /** Opens a year at a step, then (optionally) scrolls to and opens a section of that screen. */
  const open = (year: TaxYear, step: StepId, section?: string) => {
    update((s) => ({ ...switchYear(s, year), step }));
    window.scrollTo({ top: 0 });
    window.setTimeout(() => {
      const el = section ? document.getElementById(section) : null;
      if (el instanceof HTMLDetailsElement) { el.open = true; el.scrollIntoView({ block: 'start' }); } else document.getElementById('main-heading')?.focus();
    }, 150);
  };
  const setFiled = (year: TaxYear, filed: FiledInfo | null) => update((s) => patchYear(s, year, { filed }));

  const started = cards.filter((c) => c.status !== 'not-started');
  const firstVisit = started.length === 0;
  const locked = (year: TaxYear) => entitled !== null && !entitled.includes(year);

  return (
    <div className="page wide">
      <div className="head">
        <p className="eyebrow">Home</p>
        <h1 id="main-heading" tabIndex={-1}>Your tax years</h1>
        <p className="lede">
          {started.length ? 'Pick up a year where you left it, or start another one.' : 'Pick a year to start. You can do the years in any order.'}
        </p>
      </div>

      {stale.length > 0 && (
        <section className="section" aria-label="Needs your attention">
          {stale.map((st) => (
            <Callout key={st.year} tone="warn" title={`Review your ${st.year} return again`}>
              <p>{staleReasons(st)[0]}</p>
              <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => open(st.year, 'results')}>Open {st.year}</button></div>
            </Callout>
          ))}
        </section>
      )}

      <section className="section" aria-label="Tax years">
        <ul className="year-cards">
          {cards.map((c) => (
            <li key={c.year} className={`year-card ${c.status}`}>
              <YearCardView c={c} locked={locked(c.year)} filing={filing === c.year}
                onOpen={(step, section) => open(c.year, step, section)}
                onFile={() => setFiling(c.year)} onCancelFile={() => setFiling(null)}
                onSaveFiled={(f) => { setFiled(c.year, f); setFiling(null); }} onUndoFiled={() => setFiled(c.year, null)} />
            </li>
          ))}
        </ul>
      </section>

      <GuideBlock open={firstVisit} />

      <section className="section" aria-label="More">
        <ul className="home-side">
          <li className="side-card">
            <h2>Behind on US returns?</h2>
            <p>The IRS catch-up procedure for people abroad: three years of returns and six years of FBARs, with no penalties.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => update((s) => ({ ...s, step: 'catchup' }))}>
              {state.catchup.started ? 'Continue catch-up filing' : 'Catch up on missed years'} <Arrow size={16} />
            </button>
          </li>
          <li className="side-card">
            <h2>Your data</h2>
            <p>
              {savedAt ? `Saved in this browser at ${new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Saves in this browser as you go.'}
              {folder.kind === 'connected' ? ` Also saving to ${folder.folder}.` : folder.kind === 'needs-permission' ? ` Saving to ${folder.folder} is paused.` : ' No backup file yet.'}
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenData}>Back up and restore</button>
          </li>
          <li className="side-card">
            <h2>Your key</h2>
            {entitled === null ? <p>Checking…</p>
              : entitled.length > 0 ? <p><Check size={14} /> Unlocks {yearsLabel(entitled)}. Works offline.</p>
                : <p><Lock size={14} /> No key yet. Everything is free until the last step, where a key unlocks the filled forms.</p>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenData}>{entitled && entitled.length ? 'Manage' : 'Add a key'}</button>
          </li>
        </ul>
      </section>

      {showInstall && (
        <section className="section">
          <div className="section-head"><h2>Use Lou like an app</h2></div>
          <InstallLou />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Already started?</h2>
          <p>Open a Lou backup file to pick up where you left off, on this or another computer.</p>
        </div>
        <BackupPanel restoreOnly />
      </section>
    </div>
  );
}

/** Who Lou is for and what to have ready. Open for a first visit, a closed fold afterwards. */
function GuideBlock({ open }: { open: boolean }) {
  const body = (
    <>
      <div className="section-head">
        <h2>Who Lou is for</h2>
        <p>US citizens, dual citizens and green card holders who lived in Canada for the whole year. If you moved between the
          countries during the year, or you are Canadian with no US status, you need a different kind of return. Lou does not do Quebec returns yet.</p>
      </div>
      <div className="section-head">
        <h2>Have these ready</h2>
        <p>One document gets you most of the way.</p>
      </div>
      <ul className="checklist">
        <li><strong>Your final T1 General</strong>, the Canadian return you filed, as a PDF from your tax software or CRA My Account. It shows your income and the Canadian tax you paid, which is what your US return is built from. For most people it is the only tax document you need.</li>
        <li><strong>Your Canadian bank and investment account details</strong>, if your accounts held more than US$10,000 in total at any point in the year. For each account: the bank or broker's name and address, the account number, and the highest and year-end balance (your December statement and a look through the year's statements will do). The US asks for these on an FBAR and, for larger balances, Form 8938. If you are not sure whether you need them, Lou tells you once you have entered your accounts.</li>
        <li><strong>Social Security numbers</strong> for you, your spouse and any children you claim.</li>
      </ul>
      <p className="small muted" style={{ maxWidth: '62ch' }}>
        A T1 does not show everything. If you sold investments, ran a business, or have Canadian bank or investment accounts, Lou asks for those
        details as you go (for example a T5008, your T2125 figures, and your account balances). If CRA reassessed your return, add the Notice of Assessment too.
        No T1 PDF? Your slips (T4, T5, T3 and so on) plus the Notice of Assessment work just as well.
      </p>
    </>
  );
  if (open) return <section className="section">{body}</section>;
  return (
    <details className="section fold">
      <summary>
        <span><span className="fold-title">Who Lou is for and what to have ready</span></span>
        <Chevron />
      </summary>
      <div style={{ display: 'grid', gap: 'var(--s-4)' }}>{body}</div>
    </details>
  );
}

function YearCardView({ c, locked, filing, onOpen, onFile, onCancelFile, onSaveFiled, onUndoFiled }: {
  c: YearCard; locked: boolean; filing: boolean;
  onOpen: (step: StepId, section?: string) => void;
  onFile: () => void; onCancelFile: () => void; onSaveFiled: (f: FiledInfo) => void; onUndoFiled: () => void;
}) {
  const result = resultLine(c.refund);
  const done = c.milestones.filter((m) => m.done).length;
  const [draft, setDraft] = useState<FiledInfo>({ date: today(), method: 'mail', fbar: false });
  const canOutputs = c.refund !== null;
  const lockMark = locked ? <Lock size={12} /> : null;

  return (
    <>
      <div className="year-card-top">
        <h2 className="num">{c.year}</h2>
        <span className={`badge ${c.status === 'ready' || c.status === 'filed' ? 'ok' : c.status === 'review' ? 'warn' : c.status === 'progress' ? 'accent' : ''}`}>
          {c.status === 'filed' && <Check size={12} strokeWidth={2.6} />} {c.label}
        </span>
      </div>

      {c.status === 'not-started' ? (
        <p className="muted small">Nothing here yet. Start with your T1 return or your slips.</p>
      ) : (
        <>
          {result && <p className="year-result num">{result}</p>}
          {c.status === 'filed' && c.filed ? (
            <p className="small muted">
              Marked filed on {longDate(c.filed.date)}{c.filed.method === 'mail' ? ' by mail' : ''}{c.filed.fbar ? ', FBAR filed' : ''}.
              {' '}<button type="button" className="linkish" onClick={onUndoFiled}>Undo</button>
            </p>
          ) : (
            <>
              <div className="meter" role="img" aria-label={`${done} of ${c.milestones.length} steps done`}>
                {c.milestones.map((m) => <span key={m.label} className={m.done ? 'on' : ''} />)}
              </div>
              {c.todo.length > 0 && (
                <ul className="todo">
                  {c.todo.slice(0, 3).map((t) => <li key={t}>{t}</li>)}
                  {c.todo.length > 3 && <li className="muted">and {c.todo.length - 3} more</li>}
                </ul>
              )}
            </>
          )}
          {canOutputs && (
            <ul className="out-links" aria-label={`${c.year} outputs`}>
              <li><button type="button" className="linkish" onClick={() => onOpen('results')}>Filled forms {lockMark}</button></li>
              <li><button type="button" className="linkish" onClick={() => onOpen('results', 'mapping-guide')}>Mapping guide {lockMark}</button></li>
              {c.accounts > 0 && <li><button type="button" className="linkish" onClick={() => onOpen('results', 'fbar-worksheet')}>FBAR worksheet {lockMark}</button></li>}
            </ul>
          )}
        </>
      )}

      {filing && (
        <form className="file-form" onSubmit={(e) => { e.preventDefault(); if (draft.date) onSaveFiled(draft); }}>
          <label>Date sent <input type="date" className="input" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
          <label>How <select className="input" value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as FiledInfo['method'] })}>
            <option value="mail">Mailed to the IRS</option><option value="other">Another way</option></select></label>
          <label className="check-row"><input type="checkbox" checked={draft.fbar} onChange={(e) => setDraft({ ...draft, fbar: e.target.checked })} /> I also filed the FBAR for {c.year}</label>
          <p className="small muted">This is only your own record. Lou does not file anything for you.</p>
          <div className="file-actions">
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelFile}>Cancel</button>
          </div>
        </form>
      )}

      <div className="year-card-actions">
        <button type="button" className={c.status === 'not-started' || c.status === 'progress' || c.status === 'review' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => onOpen(c.next)}>
          {c.status === 'not-started' ? <Plus size={16} /> : null} {c.nextLabel} {c.status !== 'not-started' && <Arrow size={16} />}
        </button>
        {(c.status === 'ready' || c.status === 'review') && !filing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFile}>Mark as filed</button>
        )}
      </div>
    </>
  );
}
