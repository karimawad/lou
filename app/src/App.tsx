import { useState } from 'react';
import './app.css';
import { AppProvider, useApp } from './state/context';
import { BackupPanel, FolderSync } from './screens/Backup';
import { InstallLou, PwaBanners } from './screens/Install';
import { STEPS, type AppState, type StepId } from './state/store';
import { Lock, Mark, Check } from './ui/icons';
import { Start } from './screens/Start';
import { You } from './screens/You';
import { Slips } from './screens/Slips';
import { Review } from './screens/Review';
import { Questions } from './screens/Questions';
import { Results } from './screens/Results';
import { YearSwitcher } from './YearSwitcher';
import { Footer } from './ui/Footer';
import { TAX_YEARS, type TaxYear } from './tax/years';

/** Furthest step the user can open, so nobody lands on results with nothing filled in. */
export function reachable(s: AppState): Record<StepId, boolean> {
  const youDone = !!s.year && !!s.filingStatus && !!s.taxpayer.firstName && !!s.taxpayer.lastName;
  const hasSlips = s.slips.length > 0;
  const allConfirmed = hasSlips && s.slips.every((x) => x.confirmed);
  return {
    start: true,
    you: !!s.year,
    slips: youDone,
    review: youDone && hasSlips,
    questions: youDone && allConfirmed,
    results: youDone && allConfirmed,
  };
}

function Shell() {
  const { state, go, openYear, reset } = useApp();
  const can = reachable(state);
  const idx = STEPS.findIndex((x) => x.id === state.step);
  const [confirmClear, setConfirmClear] = useState(false);

  const Screen = { start: Start, you: You, slips: Slips, review: Review, questions: Questions, results: Results }[state.step];

  return (
    <div className="shell">
      <aside className="rail" aria-label="Progress">
        <div className="brand">
          <div className="brand-mark"><Mark size={20} /></div>
          <div>
            <div className="brand-name">Lou</div>
            <div className="brand-sub">Canadian slips to US tax forms</div>
          </div>
        </div>

        <YearSwitcher />

        <nav aria-label="Steps">
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button className="step-link" type="button" disabled={!can[s.id]} onClick={() => go(s.id)}
                  aria-current={state.step === s.id ? 'step' : undefined}>
                  <span className={`step-dot${i < idx && can[s.id] ? ' done' : ''}`}>
                    {i < idx && can[s.id] ? <Check size={12} strokeWidth={2.6} /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="privacy">
          <div className="privacy-title"><Lock size={16} /> Stays on this device</div>
          <p>Lou reads your slips and fills your forms right here in your browser. Nothing is uploaded, and there is no account.</p>
          <p>Your progress is saved in this browser so you can come back. Save a backup file to keep it on your computer, or to move to another browser.</p>
          <BackupPanel compact />
          <FolderSync compact />
          <InstallLou compact />
          {confirmClear ? (
            <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center' }}>
              <button type="button" className="linkish danger" onClick={async () => { await reset(); setConfirmClear(false); }}>Yes, clear everything</button>
              <button type="button" className="linkish" onClick={() => setConfirmClear(false)}>Keep it</button>
            </div>
          ) : (
            <button type="button" className="linkish" onClick={() => setConfirmClear(true)}>Clear my data from this device</button>
          )}
        </div>
      </aside>

      <div>
        <header className="topbar">
          <div className="topbar-row">
            <strong>Lou</strong>
            {state.year && (
              <select aria-label="Tax year" className="input" style={{ minHeight: 32, padding: '2px 8px', width: 'auto' }}
                value={state.year} onChange={(e) => openYear(Number(e.target.value) as TaxYear)}>
                {TAX_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <span className="muted">Step {idx + 1} of {STEPS.length} · {STEPS[idx].label}</span>
          </div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        </header>
        <main className="main">
          <PwaBanners />
          <Screen />
          <Footer />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
