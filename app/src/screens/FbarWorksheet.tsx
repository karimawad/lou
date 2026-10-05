// FBAR (FinCEN Form 114) worksheet: what to type into BSA E-Filing for each account.
// Item numbers follow FinCEN's FBAR line-item instructions (Part II: accounts owned
// separately; Part III: joint accounts).

import { Chevron } from '../ui/icons';
import type { AppState } from '../state/store';
import { analyzeAccounts, fbarType } from '../tax/accounts';
import { Callout } from '../ui/kit';

export function FbarWorksheet({ state }: { state: AppState }) {
  if (!state.year || !state.filingStatus || !state.accounts.length) return null;
  const a = analyzeAccounts(state.year, state.filingStatus, state.accounts, { spouseIsUsPerson: state.spouseIsUsPerson ?? undefined });
  const filers = a.fbar.filter((f) => f.required);
  if (!filers.length) return null;

  return (
    <details className="section fold">
      <summary>
        <span><span className="fold-title">FBAR worksheet</span>
          <span className="fold-meta">Every value FinCEN asks for, account by account</span></span>
        <Chevron />
      </summary>
      <div className="section-head">
        <p>File the FBAR online at bsaefiling.fincen.treas.gov ("File FBAR as an Individual"). It is separate from your tax return and due
          April 15, automatically extended to October 15. Values use the US Treasury rate for December 31, {state.year} ({a.rate} CAD per USD),
          rounded up to the next dollar, as FinCEN requires.</p>
      </div>
      {filers.map((f) => {
        const person = f.owner === 'spouse' ? state.spouse : state.taxpayer;
        const rows = a.rows.filter((r) => r.account.kind !== 'pension' && (r.account.owner === f.owner || r.account.owner === 'joint'));
        return (
          <div key={f.owner} style={{ display: 'grid', gap: 'var(--s-3)' }}>
            <h3>{person.firstName} {person.lastName}: {rows.length} account{rows.length === 1 ? '' : 's'}, highest total ${f.aggregateMaxUsd.toLocaleString('en-US')}</h3>
            <div className="ledger-wrap">
              <table className="ledger">
                <thead>
                  <tr><th>Part</th><th>Item 15: max value (USD)</th><th>Item 16: type</th><th>Items 17-21: institution</th><th>Item 22: account number</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const t = fbarType(r.account.kind);
                    const other = r.account.owner === 'joint' ? (f.owner === 'spouse' ? state.taxpayer : state.spouse) : null;
                    return (
                      <tr key={r.account.id}>
                        <td>{r.account.owner === 'joint' ? 'III (joint)' : 'II (separate)'}</td>
                        <td className="num">${r.fbarMaxUsd.toLocaleString('en-US')}</td>
                        <td>{t.type}{t.other ? <div className="muted small">{t.other}</div> : null}</td>
                        <td>{r.account.institution}<div className="muted small">{[r.account.street, r.account.city, r.account.province, r.account.postalCode, 'Canada'].filter(Boolean).join(', ')}</div></td>
                        <td className="num">{r.account.accountNumber || '·'}{other ? <div className="muted small">Joint owner: {other.firstName} {other.lastName}</div> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {filers.length === 2 && a.rows.filter((r) => r.account.kind !== 'pension' && r.account.owner === 'spouse').length === 0 && (
        <Callout tone="info" title="Married? One FBAR can cover both of you">
          <p>If every account your spouse must report is jointly owned with you, you can file one FBAR together (Form 114a, Record of
            Authorization to Electronically File FBARs, signed by both of you and kept with your records).</p>
        </Callout>
      )}
    </details>
  );
}
