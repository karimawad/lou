// Sales of shares and fund units. Each sale needs its own dates so Lou can use the exchange rate on
// the purchase date (cost) and the sale date (proceeds). T5008 slips start a row automatically.

import { useEffect } from 'react';
import { useApp } from '../state/context';
import { uid } from '../state/store';
import type { CapitalSale } from '../tax/capital';
import { FX_FIRST } from '../tax/fx';
import { Plus, Trash } from '../ui/icons';
import { Callout, Field, MoneyField, TextInput, YesNo } from '../ui/kit';

const box = { display: 'grid', gap: 'var(--s-4)', padding: 'var(--s-4)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)' } as const;

export function SalesSection() {
  const { state, update } = useApp();
  const year = state.year ?? 2025;
  const married = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  const sales = state.sales ?? [];
  const t5008 = state.slips.filter((s) => s.type === 'T5008' && (s.boxes['20'] || s.boxes['21']));
  const shelters = state.accounts.filter((a) => a.kind === 'tfsa' || a.kind === 'fhsa' || a.kind === 'resp');
  const setSales = (next: CapitalSale[]) => update((s) => ({ ...s, sales: next }));
  const set = (id: string, patch: Partial<CapitalSale>) => setSales(sales.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  // Start one sale per T5008 slip that has none yet (the slip gives proceeds and cost; the user adds dates).
  useEffect(() => {
    const missing = t5008.filter((s) => !sales.some((x) => x.slipId === s.id));
    if (!missing.length) return;
    setSales([...sales, ...missing.map((s): CapitalSale => ({
      id: uid(), owner: s.owner, description: s.payer ? `Securities sold - ${s.payer}` : 'Securities sold', acquired: '', sold: '',
      proceedsCad: s.boxes['21'] ?? 0, costCad: s.boxes['20'] ?? 0, slipId: s.id,
    }))]);
  }, [t5008.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const carry = state.capitalLossCarryover;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Sales of investments{state.digitalAssets ? ' and digital assets' : ''}</h2>
        <p>Shares, ETFs and fund units you sold in {year}, from your T5008 slips or your broker's realized gains report. The US needs the
          date you bought and the date you sold each one, because each amount is converted at the exchange rate on its own date.</p>
        {state.digitalAssets && (
          <p>Crypto and NFT sales go here too. A swap of one coin for another counts as a sale of the coin you gave up, so enter it as a sale.</p>
        )}
      </div>

      {sales.map((x, i) => {
        const early = (x.acquired && x.acquired < FX_FIRST) || (x.sold && x.sold < FX_FIRST);
        return (
          <div key={x.id} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{x.digital ? 'Digital asset sale' : 'Sale'} {i + 1}{x.slipId ? ' · from a T5008' : ''}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSales(sales.filter((y) => y.id !== x.id))}><Trash size={16} /> Remove</button>
            </div>
            <div className="grid-3">
              <TextInput label="What you sold" placeholder={x.digital ? '0.5 BTC, transaction ID if you have it' : '100 shares Royal Bank'}
                hint={x.digital ? 'The coin or NFT name or symbol, the exact units, and the transaction ID if available (Form 8949 instructions).' : undefined} value={x.description} onChange={(t) => set(x.id, { description: t })} />
              {married && (
                <Field label="Whose?" htmlFor={`so-${x.id}`}>
                  <select id={`so-${x.id}`} className="input" value={x.owner} onChange={(e) => set(x.id, { owner: e.target.value as CapitalSale['owner'] })}>
                    <option value="taxpayer">{state.taxpayer.firstName || 'Mine'}</option>
                    <option value="spouse">{state.spouse.firstName || 'My spouse'}</option>
                  </select>
                </Field>
              )}
              <TextInput label="Date bought" type="date" value={x.acquired} onChange={(t) => set(x.id, { acquired: t })} />
              <TextInput label="Date sold" type="date" value={x.sold} onChange={(t) => set(x.id, { sold: t })} />
              <MoneyField label="Proceeds (CAD)" hint={x.slipId ? 'T5008 box 21.' : x.digital ? 'What you received, in CAD, on the sale date. For a swap, the market value of what you received.' : undefined} value={x.proceedsCad} onChange={(n) => set(x.id, { proceedsCad: n })} />
              <MoneyField label={x.digital ? 'What you paid for it (CAD)' : 'Cost of the shares sold (CAD)'} hint={x.slipId ? 'T5008 box 20. See the note below about average cost.' : 'What you paid, including fees. If you got it as income, what it was worth when you got it.'} value={x.costCad} onChange={(n) => set(x.id, { costCad: n })} />
              {!x.digital && <Field label="Held where?" htmlFor={`sw-${x.id}`}>
                <select id={`sw-${x.id}`} className="input" value={x.pficFundId ? `fund:${x.pficFundId}` : x.accountId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    set(x.id, v.startsWith('fund:') ? { pficFundId: v.slice(5), accountId: undefined } : { pficFundId: undefined, accountId: v || undefined });
                  }}>
                  <option value="">Regular (non-registered) account</option>
                  {shelters.map((a) => <option key={a.id} value={a.id}>{a.kind.toUpperCase()} at {a.institution || 'an institution'}</option>)}
                  {(state.pficFunds ?? []).map((f) => <option key={f.id} value={`fund:${f.id}`}>Units of {f.name || 'a fund'} (fund list)</option>)}
                </select>
              </Field>}
            </div>
            {early && (
              <div className="grid-3">
                {x.acquired && x.acquired < FX_FIRST && <TextInput label="Exchange rate on the purchase date (CAD per USD)" inputMode="decimal" value={x.acquiredRate ? String(x.acquiredRate) : ''} onChange={(t) => set(x.id, { acquiredRate: Number(t) || undefined })} />}
                {x.sold && x.sold < FX_FIRST && <TextInput label="Exchange rate on the sale date (CAD per USD)" inputMode="decimal" value={x.soldRate ? String(x.soldRate) : ''} onChange={(t) => set(x.id, { soldRate: Number(t) || undefined })} />}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
        <button type="button" className="btn btn-secondary btn-sm"
          onClick={() => setSales([...sales, { id: uid(), owner: 'taxpayer', description: '', acquired: '', sold: '', proceedsCad: 0, costCad: 0 }])}>
          <Plus size={16} /> Add a sale
        </button>
        {state.digitalAssets && (
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => setSales([...sales, { id: uid(), owner: 'taxpayer', description: '', acquired: '', sold: '', proceedsCad: 0, costCad: 0, digital: true }])}>
            <Plus size={16} /> Add a crypto or NFT sale
          </button>
        )}
      </div>
      {state.digitalAssets && !sales.some((x) => x.digital) && (
        <Callout tone="info" title="No crypto or NFT sales?">
          <p>If you only received digital assets (for example staking rewards, an airdrop, or payment for work) and sold or swapped none,
            you have nothing to add here. That income is not a sale, and Lou does not enter it for you yet. See the note on your results page.</p>
        </Callout>
      )}
      {sales.some((x) => x.digital) && (
        <Callout tone="warn" title="Check your crypto records">
          <p>Lou uses the cost and dates you type. Crypto often has many purchases, transfers between wallets and swaps. Make sure each sale lists
            the units you really sold, with the cost of those units. Lou does not match lots for you.</p>
        </Callout>
      )}

      {sales.length > 0 && (
        <Callout tone="info" title="Bought the same shares more than once?">
          <p>Canada uses one average cost for all your shares of a company. The US uses the cost of the shares you actually sold (the first
            ones you bought, unless you told your broker otherwise). Enter each purchase you sold from as its own line, with its own date and cost.
            Mutual funds and ETFs go in the fund list below: their sales follow PFIC rules.</p>
        </Callout>
      )}

      <details className="more" open={!!carry}>
        <summary>Advanced: capital loss carried over from earlier years</summary>
        <YesNo legend="Do you have an unused capital loss from a past US return?" hint="It's on the Capital Loss Carryover Worksheet in the Schedule D instructions. Lou carries it automatically from a year you did here."
          value={carry ? true : null} onChange={(v) => update((s) => ({ ...s, capitalLossCarryover: v ? { shortTerm: 0, longTerm: 0 } : null }))} />
        {carry && (
          <div className="grid-2">
            <TextInput label="Short-term loss carryover (US$)" inputMode="decimal" value={carry.shortTerm ? String(carry.shortTerm) : ''}
              onChange={(t) => update((s) => ({ ...s, capitalLossCarryover: { ...carry, shortTerm: Number(t.replace(/[^\d.]/g, '')) || 0 } }))} />
            <TextInput label="Long-term loss carryover (US$)" inputMode="decimal" value={carry.longTerm ? String(carry.longTerm) : ''}
              onChange={(t) => update((s) => ({ ...s, capitalLossCarryover: { ...carry, longTerm: Number(t.replace(/[^\d.]/g, '')) || 0 } }))} />
          </div>
        )}
      </details>
    </section>
  );
}
