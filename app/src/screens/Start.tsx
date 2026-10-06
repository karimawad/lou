import { useApp } from '../state/context';
import { switchYear } from '../state/store';
import { Choices } from '../ui/kit';
import { Arrow } from '../ui/icons';
import { BackupPanel } from './Backup';
import { InstallLou } from './Install';
import { installHint, usePwa } from '../pwa';
import type { TaxYear } from '../tax/years';

export function Start() {
  const { state, update, go } = useApp();
  const year = state.year;
  const pwa = usePwa();
  const showInstall = !pwa.installed && (pwa.canInstall || installHint() !== null);

  return (
    <div className="page">
      <section className="section">
        <div className="section-head">
          <h2>Who Lou is for</h2>
          <p>US citizens, dual citizens and green card holders who lived in Canada for the whole year. If you moved between the
            countries during the year, or you are Canadian with no US status, you need a different kind of return. Lou does not do Quebec returns yet.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Have these ready</h2>
          <p>One document gets you most of the way.</p>
        </div>
        <ul className="checklist">
          <li><strong>Your final T1 General</strong>, the Canadian return you filed, as a PDF from your tax software or CRA My Account. It shows your income and the Canadian tax you paid, which is what your US return is built from. For most people it is the only tax document you need.</li>
          <li><strong>Social Security numbers</strong> for you, your spouse and any children you claim.</li>
        </ul>
        <p className="small muted" style={{ maxWidth: '62ch' }}>
          A T1 does not show everything. If you sold investments, ran a business, or have Canadian bank or investment accounts, Lou asks for those
          details as you go (for example a T5008, your T2125 figures, and your account balances). If CRA reassessed your return, add the Notice of Assessment too.
          No T1 PDF? Your slips (T4, T5, T3 and so on) plus the Notice of Assessment work just as well.
        </p>
      </section>

      {showInstall && <section className="section">
        <div className="section-head">
          <h2>Use Lou like an app</h2>
        </div>
        <InstallLou />
      </section>}

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

      <section className="section">
        <div className="section-head">
          <h2>Behind on your US returns?</h2>
          <p>If you missed filing for a few years because you did not know you had to, the IRS has a procedure for people living abroad: three years of
            returns and six years of FBARs, with no penalties, only the tax and interest. Lou walks you through it.</p>
        </div>
        <div><button type="button" className="btn btn-secondary" onClick={() => go('catchup')}>Catch up on missed years <Arrow size={18} /></button></div>
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
