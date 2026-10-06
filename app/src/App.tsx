import { useState } from 'react';
import './app.css';
import './brand.css';
import { AppProvider, useApp } from './state/context';
import { PwaBanners } from './screens/Install';
import { LicenseNotice } from './screens/Unlock';
import { YourDataCard, YourDataDialog } from './screens/YourData';
import { STEPS, type AppState, type StepId } from './state/store';
import { Mark, Check } from './ui/icons';
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
  const { state, go, openYear } = useApp();
  const can = reachable(state);
  const idx = STEPS.findIndex((x) => x.id === state.step);
  const [dataOpen, setDataOpen] = useState(false);

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

        <YourDataCard onOpen={() => setDataOpen(true)} />
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
            <button type="button" className="linkish" onClick={() => setDataOpen(true)}>Your data</button>
          </div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        </header>
        <main className="main">
          <PwaBanners />
          <LicenseNotice />
          <Screen />
          <Footer />
        </main>
      </div>
      <YourDataDialog open={dataOpen} onClose={() => setDataOpen(false)} />
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
