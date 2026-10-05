import { useApp } from '../state/context';
import { switchYear } from '../state/store';
import { Choices, Callout } from '../ui/kit';
import { Arrow } from '../ui/icons';
import { BackupPanel, FolderSync } from './Backup';
import { InstallLou } from './Install';
import { installHint, usePwa } from '../pwa';
import { folderSupported } from '../state/folderSync';
import type { TaxYear } from '../tax/years';

export function Start() {
  const { state, update, go } = useApp();
  const year = state.year;

  const pwa = usePwa();
  const hint = installHint();
  // Shown when this browser can install Lou, has install steps to show, or can save to a folder.
  const appSection = (!pwa.installed && (pwa.canInstall || hint !== null)) || folderSupported();

  return (
    <div className="page">
      <div className="head">
        <p className="eyebrow">For Americans living in Canada</p>
        <h1 id="main-heading" tabIndex={-1}>Your Canadian slips, turned into a US tax return.</h1>
        <p className="lede">
          Lou reads your T4, T5 and other CRA slips, converts them to US dollars, works out the foreign tax
          credit, and fills the IRS forms you need. It all happens in this browser.
        </p>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Before you start</h2>
          <p>Have these nearby. Photos from your phone are fine.</p>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.2em', display: 'grid', gap: 'var(--s-2)', color: 'var(--ink-2)' }}>
          <li><span style={{ color: 'var(--ink)' }}>Your Canadian slips</span> for the year: T4, T5, T3, T4RSP, T4A(P) and so on.</li>
          <li><span style={{ color: 'var(--ink)' }}>Your Notice of Assessment</span> from CRA. Your US foreign tax credit is based on the Canadian tax it shows.</li>
          <li><span style={{ color: 'var(--ink)' }}>Social Security numbers</span> for you, your spouse and any children you claim.</li>
        </ul>
      </section>


      <section className="section">
        <Choices<string>
          legend="Which tax year are you filing?"
          value={year ? String(year) : null}
          onChange={(v) => update((s) => ({ ...switchYear(s, Number(v) as TaxYear), step: 'start' }))}
          options={[
            { value: '2025', title: '2025', desc: 'Filed in 2026. With an extension, the last day is October 15, 2026.' },
            { value: '2024', title: '2024', desc: 'Catching up on a past year. Same filled forms, using 2024 rules and exchange rates.' },
            { value: '2023', title: '2023', desc: 'Catching up on a past year. Same filled forms, using 2023 rules and exchange rates.' },
          ]}
        />
        {year && year !== 2025 && (
          <Callout tone="info" title="Catching up on past years">
            <p>If you are behind on several years, the IRS Streamlined Foreign Offshore procedure lets most people catch up with
              the last three years of returns (2023, 2024 and 2025) and six years of FBARs, with no penalties. Do one year at a time
              in Lou; the results page explains the extra certification form the procedure needs.</p>
          </Callout>
        )}
      </section>

      <Callout tone="info" title="Is Lou right for you?">
        <p>Lou is for US citizens, dual citizens and green card holders who lived in Canada for the whole year. If you moved
          between the countries during the year, or you are Canadian with no US status, you need a different kind of return.</p>
      </Callout>

      <section className="section">
        <div className="section-head">
          <h2>Started on another browser or computer?</h2>
          <p>If you saved a Lou backup file, restore it here and pick up where you left off.</p>
        </div>
        <BackupPanel />
      </section>

      {appSection && <section className="section">
        <div className="section-head">
          <h2>Use Lou like an app</h2>
          <p>Install Lou to open it from your desktop or dock, even with no internet connection. It's the same Lou: nothing is uploaded, ever.</p>
        </div>
        <InstallLou />
        <FolderSync />
      </section>}

      <p className="small muted" style={{ maxWidth: '62ch' }}>
        Lou is free software, not a tax preparer. It shows its work so you can check every number, and you sign your own return. By using Lou you agree to the{' '}
        <a href="/legal/terms.html" target="_blank" rel="noopener">terms</a> and{' '}
        <a href="/legal/privacy.html" target="_blank" rel="noopener">privacy policy</a>.
      </p>

      <div className="actions">
        <span className="spacer" />
        <button type="button" className="btn btn-primary" disabled={!year} onClick={() => go('you')}>
          Start <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}
