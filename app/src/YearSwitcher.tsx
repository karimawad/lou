// Side-rail list of tax years with their status. One household, up to three years.

import { useMemo } from 'react';
import { useApp } from './state/context';
import { stateForYear, type AppState } from './state/store';
import { toReturnInput } from './state/toInput';
import { computeReturn } from './tax/compute';
import { TAX_YEARS, type TaxYear } from './tax/years';
import { fmtUsd } from './ui/kit';
import { staleYears } from './state/staleness';

function yearStatus(state: AppState, year: TaxYear): { label: string; tone: 'muted' | 'progress' | 'ready' } {
  const s = stateForYear(state, year);
  if (!s || (!s.slips.length && !s.filingStatus)) return { label: 'Not started', tone: 'muted' };
  const ready = s.slips.length > 0 && s.slips.every((x) => x.confirmed) && s.slips.some((x) => x.type === 'NOA');
  if (!ready) return { label: `${s.slips.length} slip${s.slips.length === 1 ? '' : 's'}, in progress`, tone: 'progress' };
  const input = toReturnInput(s);
  if (!input) return { label: 'In progress', tone: 'progress' };
  const r = computeReturn(input).best;
  return { label: r.refund > 0 ? `Refund ${fmtUsd(r.refund)}` : r.refund < 0 ? `Owes ${fmtUsd(-r.refund)}` : 'Ready, $0 owed', tone: 'ready' };
}

export function YearSwitcher() {
  const { state, openYear } = useApp();
  const statuses = useMemo(() => {
    const stale = new Set(staleYears(state).map((x) => x.year));
    return TAX_YEARS.map((y) => {
      const st = yearStatus(state, y);
      return stale.has(y) ? { year: y, label: `Review again, ${st.label.toLowerCase()}`, tone: 'progress' as const } : { year: y, ...st };
    });
  }, [state]);
  if (!state.year) return null;
  return (
    <nav aria-label="Tax years" className="years">
      <div className="years-title">Tax years</div>
      <ul>
        {statuses.map((y) => (
          <li key={y.year}>
            <button type="button" className="year-link" aria-current={state.year === y.year && state.step !== 'home' && state.step !== 'catchup' ? 'true' : undefined} onClick={() => openYear(y.year)}>
              <span className="num">{y.year}</span>
              <span className={`year-status ${y.tone}`}>{y.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
