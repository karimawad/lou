// Canadian mutual funds and ETFs (PFICs). Lou needs a little history for each fund to apply the
// section 1291 rules, or the figures for a mark-to-market or QEF election the user already has.

import { useEffect, useMemo } from 'react';
import { carryFunds, fundKey, missingFrom } from '../state/carry';
import { useApp } from '../state/context';
import { incomeSlips } from '../state/t1';
import { uid } from '../state/store';
import type { PficAccount, PficFund, PficRegime } from '../tax/pfic';
import { Plus, Trash } from '../ui/icons';
import { Callout, Choices, Field, MoneyField, TextInput } from '../ui/kit';
import { CarriedNote, CarryOffer } from './CarryOffer';

const box = { display: 'grid', gap: 'var(--s-4)', padding: 'var(--s-4)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)' } as const;
const num = (t: string) => Number(t.replace(/[^\d.-]/g, '')) || 0;

export function FundsSection() {
  const { state, update } = useApp();
  const year = state.year ?? 2025;
  const married = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  const funds = state.pficFunds ?? [];
  const fundSlips = incomeSlips(state).filter((s) => s.type === 'T3' || (s.type === 'T5' && s.answers?.dividendSource === 'fund'));
  const setFunds = (next: PficFund[]) => update((s) => ({ ...s, pficFunds: next }));
  // Entering the year-end value counts as filling in this year's figures for a fund copied from another year.
  const set = (id: string, patch: Partial<PficFund>) => setFunds(funds.map((f) => (f.id === id
    ? { ...f, ...patch, ...('valueYearEndCad' in patch ? { carried: undefined } : {}) } : f)));
  const offer = useMemo(() => missingFrom(state, year, (d) => d.pficFunds, carryFunds, fundKey, funds), [state, year, funds]);
  const offerUi = offer && (
    <CarryOffer section="funds" from={offer.year} what={['fund', 'funds']} names={offer.items.map((f) => f.name || 'a fund')}
      note={`Lou copies each fund's name, account, purchase date and distribution history; the ${year} value and distributions start empty.`}
      onAdd={() => setFunds([...funds, ...offer.items])} />
  );
  // Fund distributions on the slip: T3 boxes 49, 23, 26 and 21; T5 boxes 24, 10 and 18 (actual amounts, not grossed up).
  const slipTotal = (ids: string[] = []) => fundSlips.filter((s) => ids.includes(s.id)).reduce((a, s) =>
    a + (s.type === 'T3' ? ['49', '23', '26', '21'] : ['24', '10', '18']).reduce((b, k) => b + (s.boxes[k] ?? 0), 0), 0);

  // One fund per fund slip that isn't linked yet.
  useEffect(() => {
    const missing = fundSlips.filter((s) => !funds.some((f) => f.slipIds?.includes(s.id)));
    if (!missing.length) return;
    // A fund copied from another year with the slip's payer name takes the slip instead of a new fund being made.
    const norm = (t: string) => t.trim().toLowerCase();
    let next = funds;
    const unmatched = missing.filter((s) => {
      const f = next.find((x) => !x.slipIds?.length && x.owner === s.owner && norm(x.name) === norm(s.payer));
      if (!f) return true;
      next = next.map((x) => (x === f ? { ...x, slipIds: [s.id], distributions: [{ date: `${year}-12-31`, amountCad: slipTotal([s.id]) }] } : x));
      return false;
    });
    setFunds([...next, ...unmatched.map((s): PficFund => ({
      id: uid(), owner: s.owner, name: s.payer || 'Fund', account: 'taxable', regime: '1291', acquired: '', sharesYearEnd: 0, valueYearEndCad: 0,
      distributions: [{ date: `${year}-12-31`, amountCad: slipTotal([s.id]) }], priorDistributionsCad: [0, 0, 0], slipIds: [s.id],
    }))]);
  }, [fundSlips.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!funds.length && !fundSlips.length) return (
    <section className="section">
      <div className="section-head">
        <h2>Canadian mutual funds and ETFs</h2>
        <p>Only funds outside an RRSP or RRIF matter here (including funds inside a TFSA, RESP or FHSA). If you have none, skip this.</p>
      </div>
      {offerUi}
      <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => setFunds([{ id: uid(), owner: 'taxpayer', name: '', account: 'taxable', regime: '1291', acquired: '',
        sharesYearEnd: 0, valueYearEndCad: 0, distributions: [], priorDistributionsCad: [0, 0, 0] }])}><Plus size={16} /> Add a fund</button></div>
    </section>
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2>Canadian mutual funds and ETFs</h2>
        <p>The US treats Canadian funds as "passive foreign investment companies" (PFICs), with their own form (8621) and rules. Lou needs
          a little history for each fund outside an RRSP or RRIF. Funds inside an RRSP or RRIF need nothing.</p>
      </div>

      {offerUi}

      {funds.map((f, i) => (
        <div key={f.id} style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Fund {i + 1}{f.name ? ` · ${f.name}` : ''}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFunds(funds.filter((x) => x.id !== f.id))}><Trash size={16} /> Remove</button>
          </div>
          {f.carried && (
            <CarriedNote from={f.carried} year={year} onConfirm={() => setFunds(funds.map((x) => (x.id === f.id ? { ...x, carried: undefined } : x)))}
              what={`Enter the units and value on December 31, ${year}, and the ${year} distributions with their dates.${f.regime !== '1291' ? ` For a ${f.regime === 'mtm' ? 'mark-to-market' : 'QEF'} election, also enter this year's starting figures from your ${f.carried} Form 8621.` : ''} If you sold it all before ${year}, remove it.`} />
          )}
          <div className="grid-3">
            <TextInput label="Fund name" placeholder="Maple Balanced Fund Series A" value={f.name} onChange={(t) => set(f.id, { name: t })} />
            <TextInput label="Fund company address" placeholder="100 King St W, Toronto ON" value={f.address ?? ''} onChange={(t) => set(f.id, { address: t })} />
            {married && (
              <Field label="Whose?" htmlFor={`fo-${f.id}`}>
                <select id={`fo-${f.id}`} className="input" value={f.owner} onChange={(e) => set(f.id, { owner: e.target.value as PficFund['owner'] })}>
                  <option value="taxpayer">{state.taxpayer.firstName || 'Mine'}</option>
                  <option value="spouse">{state.spouse.firstName || 'My spouse'}</option>
                  <option value="joint">Joint</option>
                </select>
              </Field>
            )}
            <Field label="Held in" htmlFor={`fa-${f.id}`}>
              <select id={`fa-${f.id}`} className="input" value={f.account} onChange={(e) => set(f.id, { account: e.target.value as PficAccount })}>
                <option value="taxable">A regular (non-registered) account</option>
                <option value="tfsa">A TFSA</option>
                <option value="resp">An RESP</option>
                <option value="fhsa">An FHSA</option>
                <option value="rrsp">An RRSP or RRIF</option>
              </select>
            </Field>
          </div>
          {f.account === 'rrsp' ? <p className="hint">Inside an RRSP or RRIF: no Form 8621 and no US tax until you withdraw (Rev. Proc. 2014-55).</p> : (
            <>
              <div className="grid-3">
                <TextInput label="Date of your first purchase still held" type="date" value={f.acquired} onChange={(t) => set(f.id, { acquired: t })} />
                <TextInput label={`Units held on Dec 31, ${year}`} inputMode="decimal" value={f.sharesYearEnd ? String(f.sharesYearEnd) : ''} onChange={(t) => set(f.id, { sharesYearEnd: num(t) })} />
                <MoneyField label={`Value on Dec 31, ${year} (CAD)`} value={f.valueYearEndCad} onChange={(n) => set(f.id, { valueYearEndCad: n })} />
              </div>
              <Choices<PficRegime> legend="Which US treatment applies to this fund?" value={f.regime} onChange={(v) => set(f.id, {
                regime: v, mtm: v === 'mtm' ? f.mtm ?? { firstYear: year, basisUsdStart: 0, sharesStart: 0, unreversedUsd: 0 } : f.mtm,
                qef: v === 'qef' ? f.qef ?? { ordinaryEarningsCad: 0, netCapitalGainCad: 0, basisUsdStart: 0, sharesStart: 0, previouslyTaxedUsd: 0 } : f.qef,
              })}
                options={[
                  { value: '1291', title: 'No election (the default)', desc: 'Normal distributions are taxed as dividends. Large distributions and gains on sale carry an extra tax and interest.' },
                  { value: 'mtm', title: 'Mark-to-market election', desc: 'Each year the rise in value is taxed as ordinary income. Choose this if you made the election on an earlier return, or want to start it this year.' },
                  { value: 'qef', title: 'Qualified electing fund (QEF)', desc: 'Only if the fund gives you a "PFIC Annual Information Statement" and you elected QEF in your first year.' },
                ]} />
              {f.regime !== 'qef' && (
                <div className="grid-3">
                  {f.distributions.map((d, k) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <TextInput label={`Distribution ${k + 1} date`} type="date" value={d.date} onChange={(t) => set(f.id, { distributions: f.distributions.map((x, j) => (j === k ? { ...x, date: t } : x)) })} />
                      <MoneyField label={`Distribution ${k + 1} (CAD)`} value={d.amountCad} onChange={(n) => set(f.id, { distributions: f.distributions.map((x, j) => (j === k ? { ...x, amountCad: n } : x)) })} />
                      <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => set(f.id, { distributions: f.distributions.filter((_, j) => j !== k) })}><Trash size={16} /> Remove</button></div>
                    </div>
                  ))}
                  <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => set(f.id, { distributions: [...f.distributions, { date: `${year}-12-31`, amountCad: 0 }] })}><Plus size={16} /> Add a distribution</button></div>
                </div>
              )}
              {f.regime === '1291' && (
                <>
                  <p className="hint">Total distributions in each of the three years before {year}. Leave a year at zero if you didn't own the fund then.
                    These set the normal level of payouts; anything over 125% of it is an "excess distribution".</p>
                  <div className="grid-3">
                    {[1, 2, 3].map((k) => (
                      <MoneyField key={k} label={`${year - k} distributions (CAD)`} value={f.priorDistributionsCad[k - 1] ?? 0}
                        onChange={(n) => set(f.id, { priorDistributionsCad: [0, 1, 2].map((j) => (j === k - 1 ? n : f.priorDistributionsCad[j] ?? 0)) })} />
                    ))}
                  </div>
                </>
              )}
              {f.regime === 'mtm' && f.mtm && (
                <div className="grid-3">
                  <TextInput label="First year of the election" inputMode="numeric" value={String(f.mtm.firstYear)} onChange={(t) => set(f.id, { mtm: { ...f.mtm!, firstYear: num(t) } })} />
                  <TextInput label={`Adjusted US basis on Jan 1, ${year} (US$)`} hint="Last year's Form 8621 line 10a, or your cost if you bought this year." inputMode="decimal"
                    value={f.mtm.basisUsdStart ? String(f.mtm.basisUsdStart) : ''} onChange={(t) => set(f.id, { mtm: { ...f.mtm!, basisUsdStart: num(t) } })} />
                  <TextInput label={`Units held on Jan 1, ${year}`} inputMode="decimal" value={f.mtm.sharesStart ? String(f.mtm.sharesStart) : ''} onChange={(t) => set(f.id, { mtm: { ...f.mtm!, sharesStart: num(t) } })} />
                  <TextInput label="Unreversed inclusions (US$)" hint="Past mark-to-market gains minus past deductions." inputMode="decimal"
                    value={f.mtm.unreversedUsd ? String(f.mtm.unreversedUsd) : ''} onChange={(t) => set(f.id, { mtm: { ...f.mtm!, unreversedUsd: num(t) } })} />
                </div>
              )}
              {f.regime === 'qef' && f.qef && (
                <div className="grid-3">
                  <MoneyField label="Your ordinary earnings from the statement (CAD)" value={f.qef.ordinaryEarningsCad} onChange={(n) => set(f.id, { qef: { ...f.qef!, ordinaryEarningsCad: n } })} />
                  <MoneyField label="Your net capital gain from the statement (CAD)" value={f.qef.netCapitalGainCad} onChange={(n) => set(f.id, { qef: { ...f.qef!, netCapitalGainCad: n } })} />
                  <TextInput label={`Adjusted US basis on Jan 1, ${year} (US$)`} inputMode="decimal" value={f.qef.basisUsdStart ? String(f.qef.basisUsdStart) : ''} onChange={(t) => set(f.id, { qef: { ...f.qef!, basisUsdStart: num(t) } })} />
                  <TextInput label={`Units held on Jan 1, ${year}`} inputMode="decimal" value={f.qef.sharesStart ? String(f.qef.sharesStart) : ''} onChange={(t) => set(f.id, { qef: { ...f.qef!, sharesStart: num(t) } })} />
                  <TextInput label="Earlier QEF inclusions not yet paid out (US$)" inputMode="decimal" value={f.qef.previouslyTaxedUsd ? String(f.qef.previouslyTaxedUsd) : ''} onChange={(t) => set(f.id, { qef: { ...f.qef!, previouslyTaxedUsd: num(t) } })} />
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFunds([...funds, { id: uid(), owner: 'taxpayer', name: '', account: 'taxable', regime: '1291', acquired: '',
          sharesYearEnd: 0, valueYearEndCad: 0, distributions: [], priorDistributionsCad: [0, 0, 0] }])}><Plus size={16} /> Add a fund</button>
      </div>
      <Callout tone="info" title="Sold fund units this year?">
        <p>Add each sale under "Sales of investments" and set "Held where?" to the fund. A gain on a fund without an election is taxed under the PFIC rules, not as a capital gain.</p>
      </Callout>
    </section>
  );
}
