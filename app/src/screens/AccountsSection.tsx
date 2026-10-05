// Canadian accounts: feeds the FBAR worksheet and Form 8938.

import { useMemo } from 'react';
import { useApp } from '../state/context';
import { accountKey, carryAccounts, missingFrom } from '../state/carry';
import { uid } from '../state/store';
import { CarriedNote, CarryOffer } from './CarryOffer';
import { ACCOUNT_KIND_LABEL, analyzeAccounts, type AccountKind, type ForeignAccount } from '../tax/accounts';
import { Plus, Trash } from '../ui/icons';
import { Callout, Field, MoneyField, TextInput, YesNo, fmtUsd } from '../ui/kit';
import type { RegisteredDetails } from '../tax/foreignTrust';

const newAccount = (): ForeignAccount => ({
  id: uid(), owner: 'taxpayer', kind: 'bank', institution: '', street: '', city: '', province: '', postalCode: '',
  accountNumber: '', maxValueCad: 0, yearEndValueCad: 0, opened: false, closed: false,
});

type Institution = Pick<ForeignAccount, 'institution' | 'street' | 'city' | 'province' | 'postalCode'>;
const institutionOf = (a: Institution): Institution =>
  ({ institution: a.institution, street: a.street, city: a.city, province: a.province, postalCode: a.postalCode });
const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Institutions already typed in, in any year: one entry per name, keeping the most complete address. */
export function knownInstitutions(accountLists: ForeignAccount[][]): Institution[] {
  const best = new Map<string, Institution>();
  const filled = (i: Institution) => [i.street, i.city, i.province, i.postalCode].filter((x) => x.trim()).length;
  for (const a of accountLists.flat()) {
    if (!a.institution.trim()) continue;
    const prev = best.get(key(a.institution));
    if (!prev || filled(a) > filled(prev)) best.set(key(a.institution), institutionOf(a));
  }
  return [...best.values()].sort((x, y) => x.institution.localeCompare(y.institution));
}

export function AccountsSection() {
  const { state, update } = useApp();
  const year = state.year ?? 2025;
  const married = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  const accounts = state.accounts;
  const setAccounts = (next: ForeignAccount[]) => update((s) => ({ ...s, accounts: next, noAccounts: next.length ? false : s.noAccounts }));
  // Entering a balance counts as filling in this year's figures for an account copied from another year.
  const setAccount = (id: string, patch: Partial<ForeignAccount>) => setAccounts(accounts.map((a) => (a.id === id
    ? { ...a, ...patch, ...('maxValueCad' in patch || 'yearEndValueCad' in patch ? { carried: undefined } : {}) } : a)));
  const offer = useMemo(() => missingFrom(state, year, (d) => d.accounts, carryAccounts, accountKey, accounts), [state, year, accounts]);
  const saved = useMemo(() => knownInstitutions([accounts, ...Object.values(state.years).map((y) => y?.accounts ?? [])]), [accounts, state.years]);
  const addAt = (from: ForeignAccount) => setAccounts([...accounts, { ...newAccount(), owner: from.owner, ...institutionOf(from) }]);
  const analysis = useMemo(() => (state.filingStatus && accounts.length
    ? analyzeAccounts(year, state.filingStatus, accounts, { spouseIsUsPerson: state.spouseIsUsPerson ?? undefined }) : null),
  [accounts, year, state.filingStatus, state.spouseIsUsPerson]);

  return (
    <section className="section">
      <div className="section-head">
        <h2>Your Canadian accounts</h2>
        <p>List every account in your name: bank accounts, investment accounts, RRSP, RRIF, TFSA, RESP and FHSA. Lou uses the
          balances to tell you whether you need an FBAR and Form 8938, and prepares both. Your monthly statements show the highest balance.</p>
      </div>

      {offer && (
        <CarryOffer section="accounts" from={offer.year} what={['account', 'accounts']}
          names={offer.items.map((a) => `${a.institution || 'an institution'} ${ACCOUNT_KIND_LABEL[a.kind]}${a.accountNumber ? ` ${a.accountNumber}` : ''}`)}
          note={`Lou copies the institution, address and account number; the ${year} balances start empty.`}
          onAdd={() => setAccounts([...accounts, ...offer.items])} />
      )}

      {accounts.map((a, i) => (
        <div key={a.id} style={{ display: 'grid', gap: 'var(--s-4)', padding: 'var(--s-4)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
            <strong>Account {i + 1}{a.institution ? ` · ${a.institution}` : ''}</strong>
            <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', justifyContent: 'end' }}>
              {a.institution.trim() && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => addAt(a)}><Plus size={16} /> Another account at {a.institution.trim()}</button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccounts(accounts.filter((x) => x.id !== a.id))}><Trash size={16} /> Remove</button>
            </div>
          </div>
          {a.carried && (
            <CarriedNote from={a.carried} year={year} onConfirm={() => setAccounts(accounts.map((x) => (x.id === a.id ? { ...x, carried: undefined } : x)))}
              what={`Enter the highest balance in ${year} and the balance on December 31, ${year}${a.registered ? ', and the income inside the account' : ''}. If the account was closed or empty all year, leave zero and confirm.`} />
          )}
          <div className="grid-3">
            <Field label="Type" htmlFor={`kind-${a.id}`}>
              <select id={`kind-${a.id}`} className="input" value={a.kind} onChange={(e) => setAccount(a.id, { kind: e.target.value as AccountKind })}>
                {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((k) => <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            {married && (
              <Field label="Whose?" htmlFor={`owner-${a.id}`}>
                <select id={`owner-${a.id}`} className="input" value={a.owner} onChange={(e) => setAccount(a.id, { owner: e.target.value as ForeignAccount['owner'] })}>
                  <option value="taxpayer">{state.taxpayer.firstName || 'Mine'}</option>
                  <option value="spouse">{state.spouse.firstName || 'My spouse'}</option>
                  <option value="joint">Joint</option>
                </select>
              </Field>
            )}
            <TextInput label="Account number" value={a.accountNumber} inputMode="numeric" onChange={(v) => setAccount(a.id, { accountNumber: v })} />
            <TextInput label="Institution" value={a.institution} placeholder="RBC Royal Bank" onChange={(v) => setAccount(a.id, { institution: v })} />
            <MoneyField label="Highest balance in the year (CAD)" value={a.maxValueCad} onChange={(v) => setAccount(a.id, { maxValueCad: v })} />
            <MoneyField label={`Balance on Dec 31, ${year} (CAD)`} value={a.yearEndValueCad} onChange={(v) => setAccount(a.id, { yearEndValueCad: v })} />
          </div>
          {saved.some((s) => key(s.institution) !== key(a.institution)) && (
            <Field label="Use an institution you already entered" htmlFor={`saved-${a.id}`}>
              <select id={`saved-${a.id}`} className="input" value=""
                onChange={(e) => { const s = saved[Number(e.target.value)]; if (s) setAccount(a.id, institutionOf(s)); }}>
                <option value="">Choose to fill the name and address…</option>
                {saved.map((s, i) => key(s.institution) !== key(a.institution) && (
                  <option key={s.institution} value={i}>{s.institution}{s.city ? `, ${s.city}` : ''}</option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid-3">
            <TextInput label="Institution street address" value={a.street} placeholder="200 Bay St" onChange={(v) => setAccount(a.id, { street: v })} />
            <TextInput label="City" value={a.city} onChange={(v) => setAccount(a.id, { city: v })} />
            <div className="grid-2">
              <TextInput label="Province" value={a.province} placeholder="ON" onChange={(v) => setAccount(a.id, { province: v.toUpperCase().slice(0, 2) })} />
              <TextInput label="Postal code" value={a.postalCode} onChange={(v) => setAccount(a.id, { postalCode: v.toUpperCase() })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-5)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
              <input type="checkbox" checked={a.opened} onChange={(e) => setAccount(a.id, { opened: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Opened in {year}
            </label>
            <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
              <input type="checkbox" checked={a.closed} onChange={(e) => setAccount(a.id, { closed: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Closed in {year}
            </label>
          </div>
          {(a.kind === 'tfsa' || a.kind === 'fhsa' || a.kind === 'resp') && <RegisteredPanel account={a} year={year} onChange={(r) => setAccount(a.id, { registered: r })} />}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setAccounts([...accounts, newAccount()])}><Plus size={18} /> Add an account</button>
        {!accounts.length && (
          <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
            <input type="checkbox" checked={state.noAccounts} onChange={(e) => update((s) => ({ ...s, noAccounts: e.target.checked }))} style={{ accentColor: 'var(--accent)' }} />
            I have no Canadian bank or investment accounts
          </label>
        )}
      </div>

      {analysis && (
        <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
          {analysis.fbar.map((f) => (
            <Callout key={f.owner} tone={f.required ? 'warn' : 'ok'} title={`FBAR${f.owner === 'spouse' ? ` for ${state.spouse.firstName || 'your spouse'}` : ''}: ${f.required ? 'required' : 'not required'}`}>
              <p>Highest balances add up to {fmtUsd(f.aggregateMaxUsd)} at the US Treasury rate for December 31, {year} ({analysis.rate} CAD per USD).
                {f.required ? ' Over US$10,000, so an FBAR is due. Lou prepares a worksheet for it on the results page.' : ' That is US$10,000 or less, so no FBAR is needed.'}</p>
            </Callout>
          ))}
          <Callout tone={analysis.f8938.required ? 'warn' : 'ok'} title={`Form 8938: ${analysis.f8938.required ? 'required' : 'not required'}`}>
            <p>{fmtUsd(analysis.f8938.yearEndTotal)} on December 31 and up to {fmtUsd(analysis.f8938.maxTotal)} during the year. The thresholds for people
              living abroad are {fmtUsd(analysis.f8938.threshold.yearEnd)} at year end or {fmtUsd(analysis.f8938.threshold.anyTime)} at any time.
              {analysis.f8938.required ? ' Lou fills Form 8938 with your return.' : ''}</p>
          </Callout>
        </div>
      )}
    </section>
  );
}

const emptyRegistered = (kind: AccountKind): RegisteredDetails => ({
  openedDate: '', startValueCad: 0, contributionsCad: 0, withdrawalsCad: 0, interestCad: 0, companyDividendsCad: 0,
  dividendsQualified: true, holdsInvestments: true, file3520: kind !== 'resp',
});

/** TFSA, FHSA, RESP: income inside (US-taxable every year) and, for TFSA/FHSA, the Form 3520 details. */
function RegisteredPanel({ account: a, year, onChange }: { account: ForeignAccount; year: number; onChange: (r: RegisteredDetails) => void }) {
  const r = a.registered ?? emptyRegistered(a.kind);
  const set = (patch: Partial<RegisteredDetails>) => onChange({ ...r, ...patch });
  const name = a.kind.toUpperCase();
  return (
    <div style={{ display: 'grid', gap: 'var(--s-3)', borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)' }}>
      <p className="small"><strong>Inside this {name}</strong> · The US taxes income earned in a {name} every year, even though Canada doesn't.
        Your year-end statement shows these figures. Mutual funds and ETFs held here also go in the fund list; sales go under "Sales of investments".</p>
      {!a.registered && (
        <Callout tone="warn" title="Fill these in, even with zeros">
          <p>Lou needs them before it can finish your return.</p>
          <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(r)}>These figures are right</button></div>
        </Callout>
      )}
      <div className="grid-3">
        <TextInput label="Date the account was opened" type="date" value={r.openedDate} onChange={(t) => set({ openedDate: t })} />
        <MoneyField label={`Value on Dec 31, ${year - 1} (CAD)`} value={r.startValueCad} onChange={(n) => set({ startValueCad: n })} />
        <MoneyField label={`Contributions in ${year} (CAD)`} value={r.contributionsCad} onChange={(n) => set({ contributionsCad: n })} />
        <MoneyField label={`Withdrawals in ${year} (CAD)`} value={r.withdrawalsCad} onChange={(n) => set({ withdrawalsCad: n })} />
        <MoneyField label="Interest earned (CAD)" value={r.interestCad} onChange={(n) => set({ interestCad: n })} />
        <MoneyField label="Dividends from company shares (CAD)" hint="Actual dividends, not grossed up." value={r.companyDividendsCad} onChange={(n) => set({ companyDividendsCad: n })} />
      </div>
      {r.companyDividendsCad > 0 && <YesNo legend="Did you hold those shares more than 60 days around each dividend?" value={r.dividendsQualified} onChange={(v) => set({ dividendsQualified: v })} />}
      <YesNo legend="Does it hold investments (shares, funds) rather than only cash or GICs?" value={r.holdsInvestments} onChange={(v) => set({ holdsInvestments: v })} />
      {a.kind !== 'resp' ? (
        <>
          <YesNo legend={`Prepare Form 3520 and Form 3520-A for this ${name}?`}
            hint="Recommended. The IRS has never said whether these accounts are foreign trusts; filing protects you from a penalty of $10,000 or more. The forms are mailed separately, by June 15."
            value={r.file3520} onChange={(v) => set({ file3520: v })} />
        </>
      ) : <p className="hint">An RESP needs no Form 3520 (IRS relief for foreign education savings plans, Rev. Proc. 2020-17). Its income is still reported each year.</p>}
    </div>
  );
}
