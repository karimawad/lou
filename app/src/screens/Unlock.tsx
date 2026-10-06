// The paywall, at the end: everything up to the numbers is free. A key unlocks the filled forms and guides.
// The key is checked on this device (license/key.ts), so an unlocked Lou keeps working offline.
import { useState } from 'react';
import { useApp } from '../state/context';
import { yearsLabel } from '../license/key';
import { COVERS_TEXT, PAYMENT_LINK, PRICE_TEXT } from '../license/config';
import { Lock } from '../ui/icons';
import { Callout } from '../ui/kit';

/** Is this tax year unlocked? `checking` is true for a moment while saved keys are checked. */
export function useUnlocked(year: number) {
  const { entitled } = useApp();
  return { unlocked: entitled?.includes(year) === true, checking: entitled === null };
}

export function UnlockPanel({ year }: { year: number }) {
  const { entitled, addKey } = useApp();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  if (entitled === null) return <section className="section no-print"><p className="muted" role="status">Checking your key…</p></section>;

  const submit = async () => {
    setBusy(true);
    const r = await addKey(text);
    setBusy(false);
    if (!r.ok) { setProblem(r.message); return; }
    setText('');
    setProblem(r.years.includes(year) ? undefined : `That key covers ${yearsLabel(r.years)}, not ${year}.`);
  };

  return (
    <section className="section no-print unlock" aria-labelledby="unlock-title">
      <div className="unlock-card">
        <div className="unlock-head">
          <span className="unlock-icon" aria-hidden="true"><Lock size={20} /></span>
          <div>
            <h2 id="unlock-title">Unlock your {year} return</h2>
            <p className="muted">Everything above is yours to see for free. A key lets you download the filled IRS forms, the review package, the mapping guide and the FBAR worksheet.</p>
          </div>
        </div>

        <div className="unlock-buy">
          <div>
            <div className="unlock-price"><span className="num">{PRICE_TEXT}</span></div>
            <p className="small">One payment covers your {COVERS_TEXT} returns. No account, no subscription.</p>
          </div>
          {PAYMENT_LINK
            ? <a className="btn btn-primary" href={PAYMENT_LINK}>Buy a key</a>
            : <button type="button" className="btn btn-primary" disabled>Buying opens soon</button>}
        </div>
        <p className="small muted">You pay on Stripe's secure page, then come straight back here with your work as you left it. Lou never sees your card or your tax information.</p>

        {entitled.length > 0 && !entitled.includes(year) && (
          <Callout tone="warn" title={`Your key covers ${yearsLabel(entitled)}, not ${year}`}>
            <p>A {year} return needs a new key.</p>
          </Callout>
        )}

        <details className="more" open={keyOpen} onToggle={(e) => setKeyOpen(e.currentTarget.open)}>
          <summary>I already have a key</summary>
          <div className="field">
            <label htmlFor="key-input">Paste your key</label>
            <textarea id="key-input" className="input" rows={3} value={text} spellCheck={false} autoComplete="off"
              placeholder="LOU1.…" aria-invalid={problem ? true : undefined} aria-describedby={problem ? 'key-error' : undefined}
              onChange={(e) => { setText(e.target.value); setProblem(undefined); }} />
            {problem && <p id="key-error" className="error-text" role="alert">{problem}</p>}
          </div>
          <div style={{ marginTop: 'var(--s-3)' }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !text.trim()} onClick={() => void submit()}>Add key</button>
          </div>
        </details>
        <p className="small"><a href="/recover/">Lost your key? Find it by email</a></p>
      </div>
    </section>
  );
}

/** Stands in for a locked results section (the FBAR worksheet, the mapping guide). */
export function LockedFold({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="section fold fold-locked no-print">
      <div className="fold-locked-row">
        <span><span className="fold-title">{title}</span><span className="fold-meta">{meta}</span></span>
        <span className="badge"><Lock size={12} /> Needs a key</span>
      </div>
    </div>
  );
}

/** Shown at the top of the app after a key arrives from the thank-you page or an email link. */
export function LicenseNotice() {
  const { licenseNotice, dismissLicenseNotice } = useApp();
  if (!licenseNotice) return null;
  return (
    <div className="no-print" style={{ marginBottom: 'var(--s-5)' }} role="status">
      <Callout tone={licenseNotice.ok ? 'ok' : 'block'} title={licenseNotice.ok ? 'You are all set' : "That key didn't work"}>
        <p>{licenseNotice.text}</p>
        <div><button type="button" className="btn btn-ghost btn-sm" onClick={dismissLicenseNotice}>Dismiss</button></div>
      </Callout>
    </div>
  );
}

/** "Your data" dialog: which years the saved key unlocks, and a way to add one. */
export function LicenseSection() {
  const { state, entitled } = useApp();
  return (
    <section className="data-section">
      <h3>Your key</h3>
      {entitled === null ? <p className="small muted">Checking…</p>
        : entitled.length > 0
          ? <p className="small muted">Your key unlocks {yearsLabel(entitled)}. It is saved with your data and travels inside backup files. It works without an internet connection.</p>
          : <p className="small muted">{state.licenses.length ? 'The saved key could not be read.' : 'No key yet. You can see everything for free. A key unlocks the filled forms and guides on the last step.'}{' '}
            <a href="/recover/">Lost your key? Find it by email</a>.</p>}
    </section>
  );
}
