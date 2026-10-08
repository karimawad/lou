import { useApp } from '../state/context';
import { switchYear } from '../state/store';
import { Choices } from '../ui/kit';
import { Arrow } from '../ui/icons';
import type { TaxYear } from '../tax/years';

export function Start() {
  const { state, update, go } = useApp();
  const year = state.year;

  return (
    <div className="page">
      <div className="head">
        <p className="eyebrow">Step 1</p>
        <h1 id="main-heading" tabIndex={-1}>Choose your tax year</h1>
        <p className="lede">Lou does one year at a time. You can add more years later and switch between them.</p>
      </div>

      <section className="section">
        <Choices<string>
          legend="Which tax year are you filing?"
          value={year ? String(year) : null}
          onChange={(v) => update((s) => ({ ...switchYear(s, Number(v) as TaxYear), step: 'start' }))}
          options={[
            { value: '2025', title: '2025', desc: 'Filed in 2026. With an extension, the last day is October 15, 2026.' },
            { value: '2024', title: '2024', desc: 'A past year, using 2024 rules and exchange rates.' },
            { value: '2023', title: '2023', desc: 'A past year, using 2023 rules and exchange rates.' },
          ]}
        />
      </section>

      <div className="actions">
        <p className="small muted" style={{ maxWidth: '46ch', margin: 0 }}>
          By continuing you agree to the{' '}
          <a href="/legal/terms.html" target="_blank" rel="noopener">terms</a> and{' '}
          <a href="/legal/privacy.html" target="_blank" rel="noopener">privacy policy</a>.
        </p>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" disabled={!year} onClick={() => go('you')}>
          Continue <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}
