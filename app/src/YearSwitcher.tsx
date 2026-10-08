// Side-rail list of tax years with their status. One household, up to three years.

import { useMemo } from 'react';
import { useApp } from './state/context';
import { resultLine, yearCards } from './state/dashboard';

export function YearSwitcher() {
  const { state, openYear } = useApp();
  const statuses = useMemo(() => {
    // Same words as the Home cards (state/dashboard.ts), so the two never disagree.
    return yearCards(state).map((c) => {
      const result = resultLine(c.refund);
      const label = c.status === 'ready' && result ? `Ready, ${result.toLowerCase()}` : c.label;
      const tone = c.status === 'not-started' ? 'muted' as const : c.status === 'ready' || c.status === 'filed' ? 'ready' as const : 'progress' as const;
      return { year: c.year, label, tone };
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
