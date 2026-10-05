import { useMemo, useState } from 'react';
import { incomeSlips, withSlipAnswer } from '../state/t1';
import { autoCarryover, toReturnInput } from '../state/toInput';
import { computeReturn } from '../tax/compute';
import { AccountsSection } from './AccountsSection';
import { BusinessSection } from './BusinessSection';
import { FundsSection } from './FundsSection';
import { SalesSection } from './SalesSection';
import { Feie2555Section } from './Feie2555Section';
import { parseAmount } from '../extract/amount';
import { useApp } from '../state/context';
import type { SlipRecord } from '../state/store';
import type { CarryoverVintage, SlipAnswers } from '../tax/model';
import { Arrow, Back, Plus, Trash } from '../ui/icons';
import { Callout, Choices, TextInput, YesNo, fmtCad, fmtUsd } from '../ui/kit';
import { SLIP_LABEL } from './Slips';


export function Questions() {
  const { state, update, go } = useApp();
  const [priorFeie, setPriorFeie] = useState<boolean | null>(null);
  const vintages = state.carryover.vintages ?? [];
  const auto = useMemo(() => autoCarryover(state), [state]);
  const [carry, setCarry] = useState<boolean | null>(vintages.length ? true : null);
  const setVintages = (next: CarryoverVintage[]) => update((s) => ({ ...s, carryover: { ...s.carryover, general: 0, passive: 0, vintages: next } }));
  const amtVintages = state.carryover.amtVintages ?? [];
  const setAmtVintages = (next: CarryoverVintage[]) => update((s) => ({ ...s, carryover: { ...s.carryover, amtVintages: next } }));

  const slips = incomeSlips(state).filter((s) => s.type !== 'NOA');
  const rrspFromT1 = slips.filter((s) => s.fromT1Line === '12900');
  const dividendSlips = slips.filter((s) => s.type === 'T5' && (s.boxes['24'] || s.boxes['10'] || s.boxes['18']));
  const pensionSlips = slips.filter((s) => ['T4RSP', 'T4RIF'].includes(s.type) || (s.type === 'T4A' && (s.boxes['016'] || s.boxes['018'] || s.boxes['024'])));
  const hasCpp = slips.some((s) => s.type === 'T4AP' || s.type === 'T4AOAS');
  const hasWages = slips.some((s) => s.type === 'T4');
  // Which people need Form 2555 under the current choices (Lou's comparison or the user's pick).
  const feieOwners = useMemo(() => {
    const input = toReturnInput(state);
    if (!input || state.elections.feie === 'no') return [];
    const { best, alternative } = computeReturn(input);
    const withFeie = best.usedFeie ? best : alternative?.usedFeie ? alternative : null;
    return state.elections.feie === 'yes' || best.usedFeie ? (withFeie?.f2555.map((f) => f.owner) ?? []) : [];
  }, [state]);

  const setAnswer = (slip: SlipRecord, patch: Partial<SlipAnswers>) =>
    update((s) => withSlipAnswer(s, slip, patch));

  const carried = [...state.accounts.filter((a) => a.carried).map((a) => a.institution || 'an account'),
    ...(state.businesses ?? []).filter((b) => b.carried).map((b) => b.name || 'a business'),
    ...(state.pficFunds ?? []).filter((f) => f.carried).map((f) => f.name || 'a fund')];
  const ready = carried.length === 0 && (state.accounts.length > 0 || state.noAccounts) && dividendSlips.every((s) => s.answers?.dividendSource) && rrspFromT1.every((s) => s.answers?.rrspKind);

  return (
    <div className="page">
      <div className="head">
        <p className="eyebrow">Step 5</p>
        <h1 id="main-heading" tabIndex={-1}>A few questions</h1>
        <p className="lede">Only the ones that change your return. Each has a sensible default if you're not sure.</p>
      </div>

      {rrspFromT1.map((s) => (
        <section key={s.id} className="section">
          <Choices<'withdrawal' | 'annuity'>
            legend={`What was the RRSP income on line 12900 of your T1 (${fmtCad(Object.values(s.boxes)[0] ?? 0)})?`}
            hint="Your T1 shows one total. The US treats a withdrawal and annuity payments differently (they fall in different foreign tax credit categories). Your T4RSP slip says which: box 22 is a withdrawal, box 16 is annuity payments."
            value={s.answers?.rrspKind}
            onChange={(v) => setAnswer(s, { rrspKind: v })}
            options={[
              { value: 'withdrawal', title: 'Money I took out of my RRSP', desc: 'A withdrawal (T4RSP box 22). This is almost always the answer.' },
              { value: 'annuity', title: 'Annuity payments', desc: 'Regular payments from an annuity bought with RRSP money (T4RSP box 16).' },
            ]}
          />
        </section>
      ))}

      {dividendSlips.map((s) => (
        <section key={s.id} className="section">
          <Choices<'company' | 'fund'>
            legend={s.fromT1Line ? 'Where do the dividends on your T1 (line 12000) come from?' : `Where do the dividends on your ${SLIP_LABEL[s.type]} from ${s.payer || 'this payer'} come from?`}
            hint="Dividends from shares of a Canadian company (like a bank or utility stock) can get lower US tax rates. Mutual funds and most ETFs can't, and the US treats them as PFICs."
            value={s.answers?.dividendSource}
            onChange={(v) => setAnswer(s, { dividendSource: v, metHoldingPeriod: v === 'company' ? s.answers?.metHoldingPeriod ?? true : undefined })}
            options={[
              { value: 'company', title: 'Shares of companies', desc: 'Individual stocks such as RBC, TD, Enbridge or BCE.' },
              { value: 'fund', title: 'A mutual fund or ETF', desc: 'Funds from a bank, robo-advisor or fund company.' },
            ]}
          />
          {s.answers?.dividendSource === 'company' && (
            <YesNo legend="Did you own those shares for more than 60 days around each dividend date?"
              hint="Almost always yes unless you traded in and out quickly."
              value={s.answers?.metHoldingPeriod ?? true} onChange={(v) => setAnswer(s, { metHoldingPeriod: v })} />
          )}
        </section>
      ))}

      {pensionSlips.map((s) => (
        <section key={s.id} className="section">
          <div className="section-head">
            <h2>{s.fromT1Line ? `${s.fromT1Line === '12900' ? 'RRSP income' : 'Pension income'} on your T1 (line ${s.fromT1Line})` : `${SLIP_LABEL[s.type]}${s.payer ? ` from ${s.payer}` : ''}`}</h2>
            <p>If you put money into this plan while you were a US person and never deducted it on a US return, that money comes back
              to you US tax-free. This is your "basis". Most people who contributed through Canadian payroll or RRSP deductions have
              some. If you don't know, leave it at zero: Lou will tax the whole payment, which is the cautious choice.</p>
          </div>
          <TextInput label="US basis included in this payment (CAD)" inputMode="decimal" placeholder="0.00"
            value={s.answers?.usBasisCad !== undefined ? String(s.answers.usBasisCad) : ''}
            onChange={(v) => setAnswer(s, { usBasisCad: v.trim() === '' ? undefined : parseAmount(v) ?? undefined })} />
        </section>
      ))}

      {hasCpp && (
        <section className="section">
          <Choices<'exempt' | 'include'>
            legend="CPP, QPP and Old Age Security"
            hint="Most cross-border tax professionals treat these as taxable only in Canada for US citizens living in Canada, and disclose that on Form 8833. The treaty's wording isn't airtight on this, so you can choose to include them instead. Canadian tax on them still counts toward the credit either way."
            value={state.elections.canadianSocialSecurityExempt ? 'exempt' : 'include'}
            onChange={(v) => update((s) => ({ ...s, elections: { ...s.elections, canadianSocialSecurityExempt: v === 'exempt' } }))}
            options={[
              { value: 'exempt', title: 'Treat as exempt (Form 8833)', desc: 'The common professional position. Lou adds the treaty disclosure.' },
              { value: 'include', title: 'Include in US income', desc: 'The most conservative reading. Usually no extra US tax because of the credit.' },
            ]}
          />
        </section>
      )}

      {hasWages && (
        <section className="section">
          <div className="section-head">
            <h2>Foreign tax credit or foreign earned income exclusion</h2>
            <p>There are two ways to avoid paying tax twice on your Canadian wages. Lou works out both and picks the one that leaves you better off.
              The credit usually wins in Canada because Canadian tax is higher, and only the credit allows the refundable child tax credit.</p>
          </div>
          <Choices<'auto' | 'no' | 'yes'>
            legend="Which should Lou use?"
            value={state.elections.feie}
            onChange={(v) => update((s) => ({ ...s, elections: { ...s.elections, feie: v } }))}
            options={[
              { value: 'auto', title: 'Let Lou compare (recommended)' },
              { value: 'no', title: 'Foreign tax credit only' },
              { value: 'yes', title: 'Foreign earned income exclusion (Form 2555)' },
            ]}
          />
          <YesNo legend="Have you claimed the foreign earned income exclusion (Form 2555) on a past US return?" value={priorFeie} onChange={setPriorFeie} />
          {priorFeie && (
            <Callout tone="warn" title="Switching away from the exclusion has a catch">
              <p>If you claimed Form 2555 before and stop now, you can't claim it again for five years without IRS permission. Lou shows
                both results on the next page so you can decide with the numbers in front of you.</p>
            </Callout>
          )}
        </section>
      )}

      {feieOwners.map((o) => <Feie2555Section key={o} owner={o} />)}

      <BusinessSection />

      <AccountsSection />

      <FundsSection />

      <SalesSection />



      {!vintages.length && auto?.vintages.length ? (
        <Callout tone="ok" title={`Unused Canadian tax carried in from your ${auto.fromYear} return`}>
          <p>Lou took these from the {auto.fromYear} return you did here: {auto.vintages.map((v) => `${v.year}: general ${fmtUsd(v.general)}, passive ${fmtUsd(v.passive)}`).join('; ')}.
            They're applied automatically. Enter your own figures below only if your filed {auto.fromYear} return differs.</p>
        </Callout>
      ) : null}

      <section className="section">
        <YesNo legend="Do you have unused foreign tax credits carried over from earlier years?"
          hint="They appear on Schedule B of last year's Form 1116. If this is your first US return in a while, the answer is No."
          value={carry} onChange={(v) => { setCarry(v); if (!v) setVintages([]); else if (!vintages.length) setVintages([{ year: (state.year ?? 2025) - 1, general: 0, passive: 0 }]); }} />
        {carry && (
          <>
            <p className="hint">Copy line 8 of last year's Schedule B (Form 1116), one row per year the unused tax came from. Older amounts are used first, and anything older than ten years expires.</p>
            <VintageRows rows={vintages} onChange={setVintages} year={state.year ?? 2025} />
          </>
        )}
        <details className="more" open={amtVintages.length > 0}>
          <summary>Advanced: unused AMT foreign tax credit</summary>
          <p className="hint">Only if an earlier return included Form 6251 with AMT Forms 1116. The alternative minimum tax keeps its own
            carryover, separate from the one above. Copy line 8 of that year's AMT Schedule B (Form 1116).
            {!amtVintages.length && auto?.amtVintages.length ? ` Lou already carries these in from your ${auto.fromYear} return.` : ''}</p>
          <VintageRows rows={amtVintages} onChange={setAmtVintages} year={state.year ?? 2025} />
          {!amtVintages.length && (
            <div><button type="button" className="btn btn-secondary btn-sm"
              onClick={() => setAmtVintages([{ year: (state.year ?? 2025) - 1, general: 0, passive: 0 }])}>
              <Plus size={16} /> Add an AMT carryover
            </button></div>
          )}
        </details>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => go('review')}><Back size={18} /> Back</button>
        <span className="spacer" />
        {!ready && <span className="small muted">{carried.length ? `Add this year's figures for ${carried.join(', ')}` : 'Answer the questions above to continue'}</span>}
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => go('results')}>
          See my US return <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}

/** Unused foreign tax by year of origin, one row per year (Schedule B (Form 1116) line 8). */
function VintageRows({ rows, onChange, year }: { rows: CarryoverVintage[]; onChange: (next: CarryoverVintage[]) => void; year: number }) {
  if (!rows.length) return null;
  const set = (i: number, patch: Partial<CarryoverVintage>) => onChange(rows.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
      {rows.map((v, i) => (
        <div key={i} className="grid-3" style={{ alignItems: 'end' }}>
          <TextInput label="Year it came from" inputMode="numeric" value={v.year ? String(v.year) : ''}
            onChange={(t) => set(i, { year: Number(t.replace(/\D/g, '').slice(0, 4)) || 0 })} />
          <TextInput label="General category (US$)" inputMode="decimal" value={v.general ? String(v.general) : ''}
            onChange={(t) => set(i, { general: parseAmount(t) ?? 0 })} />
          <div style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'end' }}>
            <TextInput label="Passive category (US$)" inputMode="decimal" value={v.passive ? String(v.passive) : ''}
              onChange={(t) => set(i, { passive: parseAmount(t) ?? 0 })} />
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove year"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash size={16} /></button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={rows.length >= 10}
          onClick={() => onChange([...rows, { year: year - 1 - rows.length, general: 0, passive: 0 }])}>
          <Plus size={16} /> Add a year
        </button>
      </div>
    </div>
  );
}
