import { useApp } from '../state/context';
import { switchYear } from '../state/store';
import { Choices, Callout } from '../ui/kit';
import { Arrow } from '../ui/icons';
import { BackupPanel } from './Backup';
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
        {year && year !== 2025 && (
          <Callout tone="info" title="Catching up on past years">
            <p>Most people who are behind can use the IRS Streamlined Foreign Offshore procedure: three years of returns (2023, 2024 and 2025)
              and six years of FBARs, with no penalties. Do one year at a time here. The results page explains the extra certification form it needs.</p>
          </Callout>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Who Lou is for</h2>
          <p>US citizens, dual citizens and green card holders who lived in Canada for the whole year. If you moved between the
            countries during the year, or you are Canadian with no US status, you need a different kind of return.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Have these ready</h2>
          <p>Phone photos are fine.</p>
        </div>
        <ul className="checklist">
          <li><strong>Your Canadian slips</strong> for the year: T4, T5, T3, T4RSP, T4A(P) and so on.</li>
          <li><strong>Your Notice of Assessment</strong> from CRA. The US foreign tax credit is based on the Canadian tax it shows.</li>
          <li><strong>Social Security numbers</strong> for you, your spouse and any children you claim.</li>
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Already started?</h2>
          <p>Open a Lou backup file to pick up where you left off, on this or another computer.</p>
        </div>
        <BackupPanel restoreOnly />
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
