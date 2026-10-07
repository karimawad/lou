// Catch-up filing: the IRS Streamlined Foreign Offshore Procedures. Three delinquent returns, six FBARs, Form 14653, tax plus interest, mailed on paper.
// The rules live in tax/catchup.ts; this screen asks, shows what is left, and builds the package.

import { useMemo, useState } from 'react';
import { useApp } from '../state/context';
import { carryAccounts } from '../state/carry';
import { fbarYearsOf, distinctAccounts, isReturnYear, owedByYear, type FbarSummary, type YearReadiness } from '../state/catchup';
import { uid, type AppState } from '../state/store';
import { ACCOUNT_KIND_LABEL, type AccountKind, type ForeignAccount } from '../tax/accounts';
import {
  ACCOUNT_PROMPT_HELP, SCREEN_QUESTIONS, SFOP, STATEMENT_PROMPTS, accountPromptId, evaluateScreening, fbarLateAfter, fullDaysOutside, meets330, sfopPlan,
  type CatchupState,
} from '../tax/catchup';
import type { TaxYear } from '../tax/years';
import { Back, Download, Plus, Trash } from '../ui/icons';
import { Callout, Field, MoneyField, TextInput, YesNo, fmtUsd } from '../ui/kit';
import { useUnlocked, UnlockPanel } from './Unlock';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const money2 = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const list = (years: number[]) => years.join(', ');

export function Catchup() {
  const { state, update, go, openYear, entitled } = useApp();
  const c = state.catchup;
  const today = todayIso();
  const plan = useMemo(() => sfopPlan(today, c.extension), [today, c.extension]);
  const summaries = useMemo(() => fbarYearsOf(state, plan), [state, plan]);
  const maxAggregateUsd = Math.max(0, ...summaries.map((s) => s.maxAggregateUsd));
  const screening = useMemo(() => evaluateScreening(c, plan, { maxAggregateUsd }), [c, plan, maxAggregateUsd]);
  const set = (patch: Partial<CatchupState>) => update((s) => ({ ...s, catchup: { ...s.catchup, ...patch } }));
  const unsupported = plan.unsupportedReturnYears.length > 0 || plan.unsupportedFbarYears.length > 0;

  return (
    <div className="page">
      <div className="head no-print">
        <p className="eyebrow">Catch-up filing</p>
        <h1 id="main-heading" tabIndex={-1}>Catch up on missed US returns and FBARs</h1>
        <p className="lede">If you did not know you had to file, the IRS has a way to catch up without penalties. You file {SFOP.returnCount} years of returns and {SFOP.fbarCount} years of FBARs, pay the tax and interest, and certify that the mistake was not on purpose.</p>
      </div>

      <section className="section">
        <div className="section-head"><h2>How the streamlined procedure works</h2></div>
        <ul className="checklist">
          <li><strong>It is for people living outside the US.</strong> The IRS calls it the Streamlined Foreign Offshore Procedures. You must have been outside the US for at least {SFOP.fullDaysOutside} full days in at least one of the three years, with no US home kept for you.</li>
          <li><strong>You pay the tax and the interest, not penalties.</strong> Done correctly, the IRS waives failure-to-file and failure-to-pay penalties, accuracy penalties, information return penalties and FBAR penalties. Many people in Canada owe little or nothing after the foreign tax credit, but a person with investment income can owe tax.</li>
          <li><strong>You certify in your own words.</strong> Form 14653 is signed under penalty of perjury and says your mistake was not willful. If it was, this route is not for you.</li>
          <li><strong>It goes by mail.</strong> The IRS does not accept electronic submissions. The FBARs go online to FinCEN first.</li>
        </ul>
        <Callout tone="info" title="What Lou does and does not do">
          <p>Lou prepares the three returns, the FBAR worksheets, the cover sheet and checklist, and lays out every entry for Form 14653. Lou does not write your statement for you, does not prepare amended returns (Form 1040-X), and does not cover the domestic procedure (5% penalty) for people who were in the US most of the year. Quebec returns are not supported yet. Lou is software, not a tax preparer.</p>
        </Callout>
      </section>

      {unsupported && (
        <Callout tone="block" title="Lou does not have every year yet">
          <p>Today's date puts {plan.unsupportedReturnYears.length ? `the ${list(plan.unsupportedReturnYears)} return${plan.unsupportedReturnYears.length > 1 ? 's' : ''}` : `the ${list(plan.unsupportedFbarYears)} FBAR${plan.unsupportedFbarYears.length > 1 ? 's' : ''}`} in the procedure, and Lou does not have the tax rules or exchange rates for {plan.unsupportedReturnYears.length ? 'that year' : 'it'} yet. A professional can prepare it, or check back after Lou is updated.</p>
        </Callout>
      )}

      <YearsSection plan={plan} c={c} today={today} set={set} />

      {!unsupported && (
        <>
          <ScreeningSection c={c} screening={screening} plan={plan} set={set} />
          {screening.canProceed && (
            <>
              <ReturnsSection plan={plan} state={state} payDate={c.mailDate || today} onOpen={(y, step) => { openYear(y as TaxYear); go(step); }} />
              <AccountsSection plan={plan} summaries={summaries} state={state} onOpen={(y) => { openYear(y as TaxYear); go('accounts'); }} />
              <StatementSection summaries={summaries} c={c} set={set} />
              <MailSection plan={plan} state={state} summaries={summaries} c={c} set={set} today={today} entitled={entitled} />
            </>
          )}
        </>
      )}

      <div className="actions no-print">
        <button type="button" className="btn btn-ghost" onClick={() => go(state.year ? 'results' : 'start')}><Back size={18} /> Back</button>
        <span className="spacer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- years

function YearsSection({ plan, c, today, set }: { plan: ReturnType<typeof sfopPlan>; c: CatchupState; today: string; set: (p: Partial<CatchupState>) => void }) {
  const ask = plan.askExtensionFor;
  return (
    <section className="section">
      <div className="section-head">
        <h2>Which years you need</h2>
        <p>The years depend on the date. Today is {today}, so the procedure covers these.</p>
      </div>
      <div className="ledger-wrap">
        <table className="ledger">
          <tbody>
            <tr><td><strong>US returns</strong></td><td className="num" style={{ textAlign: 'left' }}>{list(plan.returnYears)}</td><td className="muted small">The 3 most recent years whose due date has passed.</td></tr>
            <tr><td><strong>FBARs</strong></td><td className="num" style={{ textAlign: 'left' }}>{list(plan.fbarYears)}{plan.fbarAlsoNow ? `, and ${plan.fbarAlsoNow}` : ''}</td>
              <td className="muted small">The 6 most recent years whose FBAR is late (after October 15 of the next year).{plan.fbarAlsoNow ? ` The ${plan.fbarAlsoNow} FBAR is not late yet, so it is due October 15, ${plan.fbarAlsoNow + 1}. File it with the others.` : ''}</td></tr>
          </tbody>
        </table>
      </div>
      {ask !== null && (
        <YesNo legend={`Did you file Form 4868 (an extension) for ${ask}?`}
          hint={`People living abroad get an automatic extension to June 15, ${ask + 1}. With Form 4868 the due date is October 15, ${ask + 1}. If you did not file Form 4868, ${ask} counts as late after June 15. If you did, it counts after October 15 and the procedure covers the three years before it.`}
          value={c.extension[ask]} onChange={(v) => set({ extension: { ...c.extension, [ask]: v } })} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------- screening

function ScreeningSection({ c, screening, plan, set }: { c: CatchupState; screening: ReturnType<typeof evaluateScreening>; plan: ReturnType<typeof sfopPlan>; set: (p: Partial<CatchupState>) => void }) {
  const refers = screening.findings.filter((f) => f.level === 'refer');
  return (
    <section className="section">
      <div className="section-head">
        <h2>Check that this fits you</h2>
        <p>Answer honestly. Some answers mean you should talk to a tax professional before you go further. Your answers stay on this device.</p>
      </div>
      <div style={{ display: 'grid', gap: 'var(--s-5)' }}>
        {SCREEN_QUESTIONS.map((q) => (
          <YesNo key={q.key} legend={q.text} hint={q.hint} value={c.screen[q.key]} onChange={(v) => set({ screen: { ...c.screen, [q.key]: v } })} />
        ))}
        {plan.returnYears.map((y) => (
          <YesNo key={`f${y}`} legend={`Did you already file a US return for ${y}?`} hint="Even one you think was wrong or incomplete." value={c.alreadyFiled[y]}
            onChange={(v) => set({ alreadyFiled: { ...c.alreadyFiled, [y]: v } })} />
        ))}
        <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
          <p className="label" style={{ margin: 0 }}>On how many days in each year were you in the US for any part of the day?</p>
          <p className="hint" style={{ margin: 0 }}>Count a day if you were in the US at any time in it, including a day you passed through. A day outside the US is a full day from midnight to midnight. Check your passport stamps, calendars or flight records.</p>
          <div className="grid-3">
            {plan.returnYears.map((y) => {
              const d = c.daysInUs[y];
              return (
                <Field key={y} label={`Days in the US in ${y}`} htmlFor={`days-${y}`}
                  hint={d === undefined ? undefined : `${fullDaysOutside(y, d)} full days outside the US. ${meets330(y, d) ? 'Enough.' : `Not enough (needs ${SFOP.fullDaysOutside}).`}`}>
                  <input id={`days-${y}`} className="input num" inputMode="numeric" value={d === undefined ? '' : String(d)} placeholder="0"
                    onChange={(e) => {
                      const t = e.target.value.replace(/\D/g, '');
                      const next = { ...c.daysInUs };
                      if (t === '') delete next[y]; else next[y] = Math.min(366, Number(t));
                      set({ daysInUs: next });
                    }} />
                </Field>
              );
            })}
          </div>
        </div>
      </div>

      {screening.findings.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--s-3)', marginTop: 'var(--s-5)' }}>
          {screening.findings.map((f) => (
            <Callout key={f.id} tone={f.level === 'stop' ? 'block' : 'warn'} title={f.level === 'stop' ? `Lou stops here: ${f.title}` : `See a professional: ${f.title}`}>
              <p>{f.detail}</p>
            </Callout>
          ))}
        </div>
      )}
      {!screening.clear && screening.pending.length > 0 && <p className="small muted" role="status" style={{ marginTop: 'var(--s-4)' }}>{screening.pending.length} answer{screening.pending.length === 1 ? '' : 's'} still needed.</p>}
      {screening.clear && refers.length > 0 && (
        <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'start', marginTop: 'var(--s-4)' }}>
          <input type="checkbox" checked={c.professionalAck} onChange={(e) => set({ professionalAck: e.target.checked })} style={{ accentColor: 'var(--accent)', marginTop: 4 }} />
          <span>I have talked to a qualified tax professional about the points above and I want to go on with Lou's package.</span>
        </label>
      )}
      {screening.canProceed && <div style={{ marginTop: 'var(--s-4)' }}><Callout tone="ok" title="You can go on"><p>Nothing you told Lou rules out the streamlined procedure. That is not a promise that the IRS will accept your certification. You make that statement and you sign it.</p></Callout></div>}
    </section>
  );
}

// ---------------------------------------------------------------------------- returns

function ReturnsSection({ plan, state, payDate, onOpen }: { plan: ReturnType<typeof sfopPlan>; state: AppState; payDate: string; onOpen: (year: number, step: 'you' | 'slips' | 'review' | 'questions' | 'results') => void }) {
  const owed = useMemo(() => owedByYear(state, plan, payDate), [state, plan, payDate]);
  return (
    <section className="section">
      <div className="section-head">
        <h2>Your {plan.returnYears.length} returns</h2>
        <p>Each year is a normal Lou return: your slips, your Notice of Assessment, a few questions. Do them one at a time.</p>
      </div>
      <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
        {owed.readiness.map((r) => <ReturnRow key={r.year} r={r} next={nextStep(r)} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

function nextStep(r: YearReadiness): 'you' | 'slips' | 'review' | 'questions' | 'results' {
  if (!r.started) return 'you';
  if (r.ready) return 'results';
  return r.blockers.some((b) => /about you/i.test(b)) ? 'you' : r.blockers.some((b) => /slip|Notice/i.test(b)) ? 'slips' : 'questions';
}

function ReturnRow({ r, next, onOpen }: { r: YearReadiness; next: 'you' | 'slips' | 'review' | 'questions' | 'results'; onOpen: (y: number, s: 'you' | 'slips' | 'review' | 'questions' | 'results') => void }) {
  return (
    <div className="download-row" style={{ alignItems: 'start' }}>
      <div>
        <div className="list-title">{r.year} return <span className={`badge ${r.ready ? 'ok' : r.started ? 'warn' : ''}`}>{r.ready ? 'Ready' : r.started ? 'In progress' : 'Not started'}</span></div>
        <div className="list-meta">
          {r.ready ? (r.owe > 0 ? `Tax owed ${fmtUsd(r.owe)}.` : 'No tax owed.')
            : r.blockers.length ? r.blockers.join(' ') : 'Not started.'}
        </div>
      </div>
      {isReturnYear(r.year) && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(r.year, next)}>{r.ready ? 'Review' : r.started ? 'Continue' : 'Start'} {r.year}</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- accounts (FBAR years)

const STATUS_BADGE: Record<FbarSummary['status'], { tone: string; text: string }> = {
  todo: { tone: 'warn', text: 'Needs your accounts' },
  carried: { tone: 'warn', text: 'Add this year\'s balances' },
  none: { tone: 'ok', text: 'No accounts' },
  under: { tone: 'ok', text: 'No FBAR needed' },
  file: { tone: 'accent', text: 'FBAR to file' },
};

function AccountsSection({ plan, summaries, state, onOpen }: { plan: ReturnType<typeof sfopPlan>; summaries: FbarSummary[]; state: AppState; onOpen: (year: number) => void }) {
  const { update } = useApp();
  const setYear = (year: number, fn: (cur: { accounts: ForeignAccount[]; noAccounts: boolean }) => { accounts: ForeignAccount[]; noAccounts: boolean }) =>
    update((s) => {
      const cur = s.catchup.fbar[year] ?? { accounts: [], noAccounts: false };
      return { ...s, catchup: { ...s.catchup, fbar: { ...s.catchup.fbar, [year]: fn(cur) } } };
    });
  // Institutions typed anywhere, to fill the name and address in one pick.
  const known = useMemo(() => {
    const seen = new Map<string, ForeignAccount>();
    for (const a of [...summaries.flatMap((s) => s.accounts), ...state.accounts]) if (a.institution.trim() && !seen.has(a.institution.trim().toLowerCase())) seen.set(a.institution.trim().toLowerCase(), a);
    return [...seen.values()];
  }, [summaries, state.accounts]);
  const married = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  return (
    <section className="section">
      <div className="section-head">
        <h2>Your Canadian accounts for each FBAR year</h2>
        <p>An FBAR is due for a year when your Canadian accounts together held more than US$10,000 at any time. Lou needs the highest balance of each account in each year. Your statements show it. For {list(plan.returnYears)}, the accounts are the ones in your return.</p>
      </div>
      <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
        {summaries.map((s) => {
          const badge = STATUS_BADGE[s.status];
          return (
            <details key={s.year} className="fold" open={s.status === 'todo' || s.status === 'carried'}>
              <summary>
                <span><span className="fold-title">{s.year}</span>
                  <span className="fold-meta">{s.analysis ? `Highest balances ${fmtUsd(s.maxAggregateUsd)} at ${s.analysis.rate} CAD per USD` : 'No accounts entered'} · {Date.parse(`${todayIso()}T00:00:00Z`) > Date.parse(`${fbarLateAfter(s.year)}T00:00:00Z`) ? 'late' : `due Oct 15, ${s.year + 1}`}</span></span>
                <span className={`badge ${badge.tone}`}>{badge.text}</span>
              </summary>
              {s.inReturn ? (
                <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
                  <p className="small muted">These accounts come from your {s.year} return ({s.accounts.length} account{s.accounts.length === 1 ? '' : 's'}). Edit them there.</p>
                  <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(s.year)}>Open {s.year} questions</button></div>
                </div>
              ) : (
                <FbarYearEditor s={s} married={married} state={state} known={known}
                  onChange={(fn) => setYear(s.year, fn)} otherYears={summaries.filter((o) => o.year !== s.year && o.accounts.length > 0)} />
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}

const emptyAccount = (): ForeignAccount => ({
  id: uid(), owner: 'taxpayer', kind: 'bank', institution: '', street: '', city: '', province: '', postalCode: '', accountNumber: '',
  maxValueCad: 0, yearEndValueCad: 0, opened: false, closed: false,
});

function FbarYearEditor({ s, married, state, known, otherYears, onChange }: {
  s: FbarSummary; married: boolean; state: AppState; known: ForeignAccount[]; otherYears: FbarSummary[];
  onChange: (fn: (cur: { accounts: ForeignAccount[]; noAccounts: boolean }) => { accounts: ForeignAccount[]; noAccounts: boolean }) => void;
}) {
  const accounts = s.accounts;
  const setAccounts = (next: ForeignAccount[]) => onChange((cur) => ({ accounts: next, noAccounts: next.length ? false : cur.noAccounts }));
  const setAccount = (id: string, patch: Partial<ForeignAccount>) => setAccounts(accounts.map((a) => (a.id === id ? { ...a, ...patch, ...('maxValueCad' in patch ? { carried: undefined } : {}) } : a)));
  const nearest = [...otherYears].sort((a, b) => Math.abs(a.year - s.year) - Math.abs(b.year - s.year) || a.year - b.year)[0];
  return (
    <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
      {!accounts.length && nearest && (
        <Callout tone="info" title={`Start from your ${nearest.year} accounts?`}>
          <p>Lou copies the bank, account number and address. The {s.year} balances start empty, and accounts opened or closed in other years are left out.</p>
          <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => setAccounts(carryAccounts(nearest.accounts, nearest.year as TaxYear, s.year as TaxYear))}>Copy accounts from {nearest.year}</button></div>
        </Callout>
      )}
      {accounts.map((a, i) => (
        <div key={a.id} style={{ display: 'grid', gap: 'var(--s-3)', padding: 'var(--s-4)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s-2)' }}>
            <strong>Account {i + 1}{a.institution ? ` · ${a.institution}` : ''}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccounts(accounts.filter((x) => x.id !== a.id))}><Trash size={16} /> Remove</button>
          </div>
          {a.carried && <p className="small" role="status">Copied from {a.carried}. Enter the highest balance in {s.year}. If the account was empty all year, enter 0 and leave it.</p>}
          <div className="grid-3">
            <Field label="Type" htmlFor={`k-${a.id}`}>
              <select id={`k-${a.id}`} className="input" value={a.kind} onChange={(e) => setAccount(a.id, { kind: e.target.value as AccountKind })}>
                {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).filter((k) => k !== 'pension').map((k) => <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            {married && (
              <Field label="Whose?" htmlFor={`o-${a.id}`}>
                <select id={`o-${a.id}`} className="input" value={a.owner} onChange={(e) => setAccount(a.id, { owner: e.target.value as ForeignAccount['owner'] })}>
                  <option value="taxpayer">{state.taxpayer.firstName || 'Mine'}</option>
                  <option value="spouse">{state.spouse.firstName || 'My spouse'}</option>
                  <option value="joint">Joint</option>
                </select>
              </Field>
            )}
            <TextInput label="Account number" value={a.accountNumber} inputMode="numeric" onChange={(v) => setAccount(a.id, { accountNumber: v })} />
            <TextInput label="Institution" value={a.institution} placeholder="RBC Royal Bank" onChange={(v) => setAccount(a.id, { institution: v })} />
            <MoneyField label={`Highest balance in ${s.year} (CAD)`} value={a.maxValueCad} onChange={(v) => setAccount(a.id, { maxValueCad: v })} />
          </div>
          {known.some((k) => k.institution.trim().toLowerCase() !== a.institution.trim().toLowerCase()) && (
            <Field label="Use an institution you already entered" htmlFor={`s-${a.id}`}>
              <select id={`s-${a.id}`} className="input" value="" onChange={(e) => {
                const k = known[Number(e.target.value)];
                if (k) setAccount(a.id, { institution: k.institution, street: k.street, city: k.city, province: k.province, postalCode: k.postalCode });
              }}>
                <option value="">Choose to fill the name and address…</option>
                {known.map((k, idx) => <option key={k.institution} value={idx}>{k.institution}{k.city ? `, ${k.city}` : ''}</option>)}
              </select>
            </Field>
          )}
          <div className="grid-3">
            <TextInput label="Institution street address" value={a.street} onChange={(v) => setAccount(a.id, { street: v })} />
            <TextInput label="City" value={a.city} onChange={(v) => setAccount(a.id, { city: v })} />
            <div className="grid-2">
              <TextInput label="Province" value={a.province} onChange={(v) => setAccount(a.id, { province: v.toUpperCase().slice(0, 2) })} />
              <TextInput label="Postal code" value={a.postalCode} onChange={(v) => setAccount(a.id, { postalCode: v.toUpperCase() })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-5)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}><input type="checkbox" checked={a.opened} onChange={(e) => setAccount(a.id, { opened: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Opened in {s.year}</label>
            <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}><input type="checkbox" checked={a.closed} onChange={(e) => setAccount(a.id, { closed: e.target.checked })} style={{ accentColor: 'var(--accent)' }} /> Closed in {s.year}</label>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setAccounts([...accounts, emptyAccount()])}><Plus size={18} /> Add an account</button>
        {!accounts.length && (
          <label style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'center' }}>
            <input type="checkbox" checked={s.noAccounts} onChange={(e) => onChange((cur) => ({ ...cur, noAccounts: e.target.checked }))} style={{ accentColor: 'var(--accent)' }} />
            I had no Canadian bank or investment accounts in {s.year}
          </label>
        )}
      </div>
      {s.analysis && s.analysis.fbar.map((f) => (
        <Callout key={f.owner} tone={f.required ? 'warn' : 'ok'} title={`FBAR${f.owner === 'spouse' ? ` for ${state.spouse.firstName || 'your spouse'}` : ''}: ${f.required ? 'required' : 'not required'}`}>
          <p>Highest balances add up to {fmtUsd(f.aggregateMaxUsd)} at the US Treasury rate for December 31, {s.year} ({s.analysis!.rate} CAD per USD).</p>
        </Callout>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------- statement

function StatementSection({ summaries, c, set }: { summaries: FbarSummary[]; c: CatchupState; set: (p: Partial<CatchupState>) => void }) {
  const accounts = useMemo(() => distinctAccounts(summaries), [summaries]);
  const put = (id: string, v: string) => set({ statement: { ...c.statement, [id]: v } });
  return (
    <section className="section">
      <div className="section-head">
        <h2>Your statement for Form 14653</h2>
        <p>The IRS asks you to explain, in your own words, why you did not report everything. You sign it under penalty of perjury.</p>
      </div>
      <Callout tone="warn" title="Lou does not write this for you">
        <p>Lou only asks the questions the form asks. Write what was true for you, including facts that do not help. Lou puts your words into the worksheet exactly as you typed them. A statement that is vague, copied from somewhere else, or not true can cost you the penalty relief. If you are not sure how to describe something, ask a professional.</p>
      </Callout>
      <div style={{ display: 'grid', gap: 'var(--s-5)' }}>
        {STATEMENT_PROMPTS.map((p) => (
          <StatementBox key={p.id} id={`st-${p.id}`} label={<>{p.label}{p.optional ? <span className="muted"> (if it applies)</span> : null}</>} hint={p.help}
            value={c.statement[p.id] ?? ''} onChange={(v) => put(p.id, v)} />
        ))}
        {accounts.length > 0 && (
          <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
            <div>
              <p className="label" style={{ margin: 0 }}>Your Canadian accounts</p>
              <p className="hint" style={{ margin: 0 }}>{ACCOUNT_PROMPT_HELP} Answer for each account.</p>
            </div>
            {accounts.map((a) => (
              <StatementBox key={a.id} id={`st-${a.id}`} label={`${ACCOUNT_KIND_LABEL[a.kind]} at ${a.institution || 'this institution'}${a.accountNumber ? `, account ${a.accountNumber}` : ''}`}
                value={c.statement[accountPromptId(a)] ?? ''} onChange={(v) => put(accountPromptId(a), v)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatementBox({ id, label, hint, value, onChange }: { id: string; label: React.ReactNode; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea id={id} className="input" rows={5} value={value} onChange={(e) => onChange(e.target.value)} spellCheck style={{ resize: 'vertical' }} />
    </Field>
  );
}

// ---------------------------------------------------------------------------- pay and mail

function MailSection({ plan, state, summaries, c, set, today, entitled }: {
  plan: ReturnType<typeof sfopPlan>; state: AppState; summaries: FbarSummary[]; c: CatchupState; set: (p: Partial<CatchupState>) => void; today: string; entitled: number[] | null;
}) {
  const payDate = c.mailDate && c.mailDate >= today ? c.mailDate : today;
  const owed = useMemo(() => owedByYear(state, plan, payDate), [state, plan, payDate]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const { unlocked: firstUnlocked } = useUnlocked(plan.returnYears[0] ?? 0);
  const allUnlocked = entitled !== null && plan.returnYears.every((y) => entitled.includes(y));
  const returnsReady = owed.readiness.every((r) => r.ready);
  const fbarsReady = summaries.every((s) => s.status !== 'todo' && s.status !== 'carried');
  const nameOf = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
  const joint = state.filingStatus === 'mfj';
  const name = joint && state.spouse.firstName ? `${nameOf(state.taxpayer)} and ${nameOf(state.spouse)}` : nameOf(state.taxpayer) || 'Taxpayer';
  const a = state.address;
  const address = [a.street, a.city, a.province, a.postalCode, a.country].filter(Boolean).join(', ');
  const ready = returnsReady && fbarsReady;

  const build = async (kind: 'mail' | 'cover' | 'worksheet' | 'fbar') => {
    setBusy(kind); setError(undefined);
    try {
      const pkg = await import('../pdf/catchupPackage');
      const { fillReturn } = await import('../pdf/fill');
      const input = {
        plan, catchup: c, name, ssn: state.taxpayer.ssn, address, payDate, preparedOn: today, fbar: summaries,
        years: [] as { year: number; tax: number; interest: number; formTitles: string[] }[],
      };
      const yearForms: { year: number; forms: Awaited<ReturnType<typeof fillReturn>> }[] = [];
      for (const [i, r] of owed.readiness.entries()) {
        if (!r.input || !r.result) throw new Error(`The ${r.year} return is not ready.`);
        const forms = kind === 'mail' || kind === 'cover' ? await fillReturn(r.input, r.result) : [];
        yearForms.push({ year: r.year, forms });
        input.years.push({ year: r.year, tax: r.owe, interest: owed.interest[i].interest, formTitles: forms.map((f) => f.title) });
      }
      const bytes = kind === 'mail' ? await pkg.buildMailPackage(yearForms)
        : kind === 'cover' ? await pkg.buildCoverSheet(input)
        : kind === 'worksheet' ? await pkg.buildForm14653Worksheet(input)
        : await pkg.buildFbarWorksheets(input, { taxpayer: nameOf(state.taxpayer) || 'Taxpayer', spouse: nameOf(state.spouse) || 'Spouse' });
      const file = { mail: 'Streamlined-returns', cover: 'Streamlined-cover-sheet', worksheet: 'Form-14653-worksheet', fbar: 'FBAR-worksheets' }[kind];
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      Object.assign(document.createElement('a'), { href: url, download: `${file}-${state.taxpayer.lastName || 'Lou'}.pdf` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong building the PDF.');
    } finally { setBusy(null); }
  };

  const rows = owed.readiness.map((r, i) => ({ r, i: owed.interest[i] }));
  return (
    <section className="section">
      <div className="section-head">
        <h2>Pay and mail</h2>
        <p>The IRS wants the tax and the interest with the package. Lou estimates the interest from April 15 of each year to the day you mail it. The IRS may send a bill or a refund for any difference.</p>
      </div>
      <div className="grid-3" style={{ maxWidth: 520 }}>
        <TextInput label="Date you plan to mail it" type="date" value={c.mailDate} min={today} onChange={(v) => set({ mailDate: v })} hint={`Blank means today (${today}).`} />
      </div>
      <div className="ledger-wrap">
        <table className="ledger">
          <thead><tr><th>Year</th><th className="num">Tax</th><th className="num">Interest</th><th className="num">Total</th></tr></thead>
          <tbody>
            {rows.map(({ r, i }) => (
              <tr key={r.year}>
                <td className="num" style={{ textAlign: 'left' }}>{r.year}{r.ready ? '' : ' (not ready)'}</td>
                <td className="num">{money2(r.owe)}</td><td className="num">{money2(i.interest)}</td><td className="num">{money2(r.owe + i.interest)}</td>
              </tr>
            ))}
            <tr className="total"><td>Payment</td><td className="num">{money2(owed.totalTax)}</td><td className="num">{money2(owed.totalInterest)}</td><td className="num">{money2(owed.totalTax + owed.totalInterest)}</td></tr>
          </tbody>
        </table>
      </div>
      {owed.interest.some((i) => i.partial) && <Callout tone="warn" title="Interest is counted only to the end of 2026"><p>Lou's IRS interest table ends there. The IRS will bill the rest. Pick an earlier mailing date or expect a notice.</p></Callout>}
      {owed.totalTax === 0 && returnsReady && <p className="small muted">Nothing is owed after your foreign tax credit, so there is no payment. You still send the returns and Form 14653.</p>}
      {owed.readiness.some((r) => r.result?.pfic.some((p) => p.interest > 0)) && <Callout tone="info" title="Check the interest"><p>One of your returns already includes interest on PFIC tax (Form 8621). Lou charged underpayment interest on the whole balance, which may count that part twice. A professional can check it.</p></Callout>}

      {!ready && <Callout tone="warn" title="Finish these before you build the package">
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          {!returnsReady && <li>Every return needs to be ready (see Your returns above).</li>}
          {!fbarsReady && <li>Every FBAR year needs its accounts, or the box saying you had none.</li>}
        </ul>
      </Callout>}

      {ready && !allUnlocked && entitled !== null && <UnlockPanel year={plan.returnYears.find((y) => !entitled.includes(y)) ?? plan.returnYears[0]} />}
      {ready && allUnlocked && (
        <div className="downloads">
          <DownloadRow title="Your returns, ready to mail" meta={`${list(plan.returnYears)}, with the red "${SFOP.notation}" notation printed at the top of page 1 of each Form 1040 and each information return, in mailing order.`} busy={busy === 'mail'} onClick={() => build('mail')} />
          <DownloadRow title="Cover sheet and mailing checklist" meta="Goes on top of the package. The checklist is in the order to do things." busy={busy === 'cover'} onClick={() => build('cover')} />
          <DownloadRow title="Form 14653 worksheet" meta="Every entry for the official form, with your statement in your own words." busy={busy === 'worksheet'} onClick={() => build('worksheet')} />
          <DownloadRow title="FBAR worksheets" meta={`Every value FinCEN asks for, for ${list([...plan.fbarYears, ...(plan.fbarAlsoNow ? [plan.fbarAlsoNow] : [])])}.`} busy={busy === 'fbar'} onClick={() => build('fbar')} />
          <div className="download-row">
            <div><div className="list-title">The official Form 14653 (blank)</div><div className="list-meta">Open it in Adobe Acrobat Reader. A web browser shows a blank page. IRS Form 14653, Rev. 3-2025.</div></div>
            <a className="btn btn-secondary" href="/forms/f14653.pdf" download="Form-14653.pdf"><Download size={18} /> Download</a>
          </div>
          {error && <Callout tone="block" title="The PDF couldn't be built">{error}</Callout>}
        </div>
      )}
      {ready && !allUnlocked && entitled === null && firstUnlocked === false && <p className="muted" role="status">Checking your key…</p>}

      <div style={{ marginTop: 'var(--s-6)', display: 'grid', gap: 'var(--s-4)' }}>
        <h3>The order to do things</h3>
        <ol style={{ margin: 0, paddingLeft: '1.2em', display: 'grid', gap: 'var(--s-3)' }}>
          <li>File each FBAR online at bsaefiling.fincen.treas.gov. For each late one choose "Other" as the reason and type "{SFOP.fbarReason}". The worksheets have the values.</li>
          <li>Fill in the official Form 14653 from the worksheet and sign it. Check only the boxes that are true.</li>
          <li>Print the returns. The red notation is already on page 1. On a black and white printer, write "{SFOP.notation}" in red ink at the top of page 1 of each Form 1040, Form 8938, Form 8621, Form 3520 and Form 3520-A.</li>
          <li>Sign each Form 1040. Attach a copy of the signed Form 14653 to each return and each information return, and keep the signed original on top.</li>
          <li>Pay the total. Put your Social Security number on the check.</li>
          <li>Mail everything on paper, with a tracking number, to:
            <div className="address" style={{ marginTop: 'var(--s-2)' }}>{SFOP.mailTo.map((l) => <div key={l}>{l}</div>)}</div>
          </li>
        </ol>
        <p className="small muted" style={{ maxWidth: '62ch' }}>Lou is software, not a tax preparer. You sign the returns and Form 14653 yourself, under penalty of perjury. Review every number first. The IRS can still examine a streamlined submission, and the penalty relief is lost if it finds the failure was willful or the returns were fraudulent.</p>
      </div>
    </section>
  );
}

function DownloadRow({ title, meta, busy, onClick }: { title: string; meta: string; busy: boolean; onClick: () => void }) {
  return (
    <div className="download-row">
      <div><div className="list-title">{title}</div><div className="list-meta">{meta}</div></div>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={onClick}><Download size={18} /> {busy ? 'Building…' : 'Download PDF'}</button>
    </div>
  );
}
