// Self-employment (T2125 in Canada) -> Schedule C. The user copies figures from their T2125;
// Lou converts them and applies the US rules (standard mileage, simplified home office, ADS).

import { useMemo } from 'react';
import { businessKey, carryBusinesses, missingFrom } from '../state/carry';
import { useApp } from '../state/context';
import { uid } from '../state/store';
import { ADS_YEARS, MILEAGE_RATE, type Business, type BusinessAsset, type SchCExpenseLine } from '../tax/business';
import { FX_FIRST } from '../tax/fx';
import { Plus, Trash } from '../ui/icons';
import { Callout, Field, MoneyField, TextInput, YesNo } from '../ui/kit';
import { CarriedNote, CarryOffer } from './CarryOffer';

/** Schedule C expense lines with the T2125 lines that usually feed them. */
const EXPENSES: { line: SchCExpenseLine; label: string; t2125: string }[] = [
  { line: '8', label: 'Advertising', t2125: '8521' },
  { line: '10', label: 'Commissions and fees', t2125: '' },
  { line: '11', label: 'Contract labour (people who are not employees)', t2125: '' },
  { line: '14', label: 'Employee benefit programs', t2125: '' },
  { line: '15', label: 'Insurance (not health)', t2125: '8690' },
  { line: '16a', label: 'Mortgage interest on business property', t2125: '8710' },
  { line: '16b', label: 'Other interest', t2125: '8710' },
  { line: '17', label: 'Legal and accounting fees', t2125: '8860' },
  { line: '18', label: 'Office expenses', t2125: '8810' },
  { line: '19', label: 'Pension and profit-sharing plans for employees', t2125: '' },
  { line: '20a', label: 'Rent or lease: vehicles, machinery, equipment', t2125: '8910' },
  { line: '20b', label: 'Rent: other business property', t2125: '8910' },
  { line: '21', label: 'Repairs and maintenance', t2125: '8960' },
  { line: '22', label: 'Supplies', t2125: '8811' },
  { line: '23', label: 'Taxes and licences (incl. employer CPP/EI on staff)', t2125: '8760, 9180' },
  { line: '24a', label: 'Travel (fares, hotels; not meals)', t2125: '9200' },
  { line: '25', label: 'Utilities', t2125: '9220' },
  { line: '26', label: 'Wages paid to employees', t2125: '9060' },
  { line: '27b', label: 'Other expenses (describe below)', t2125: '9270, 8710 bank charges, 9275' },
];

const newBusiness = (owner: Business['owner']): Business => ({
  id: uid(), owner, name: '', activity: '', code: '', accounting: 'cash', grossCad: 0, returnsCad: 0, cogsCad: 0, otherIncomeCad: 0,
  expensesCad: {}, mealsCad: 0, assets: [], deMinimis: true, capitalMaterial: false, materiallyParticipated: true,
});

const box = { display: 'grid', gap: 'var(--s-4)', padding: 'var(--s-4)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)' } as const;

export function BusinessSection() {
  const { state, update } = useApp();
  const year = state.year ?? 2025;
  const married = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  const list = state.businesses ?? [];
  const setList = (next: Business[]) => update((s) => ({ ...s, businesses: next }));
  // Entering income counts as filling in this year's figures for a business copied from another year.
  const set = (id: string, patch: Partial<Business>) => setList(list.map((b) => (b.id === id
    ? { ...b, ...patch, ...('grossCad' in patch ? { carried: undefined } : {}) } : b)));
  const offer = useMemo(() => missingFrom(state, year, (d) => d.businesses, carryBusinesses, businessKey, list), [state, year, list]);

  return (
    <section className="section">
      <div className="section-head">
        <h2>Self-employment</h2>
        <p>If you freelance or run a business on your own (you file a T2125 in Canada), add it here. Copy the figures from your T2125.
          Lou converts them to US dollars and applies the US rules, which differ in a few places: car costs use the IRS mileage rate,
          the home office uses the IRS simplified method, and equipment is depreciated the US way instead of with CCA.</p>
      </div>

      {offer && (
        <CarryOffer section="businesses" from={offer.year} what={['business', 'businesses']} names={offer.items.map((b) => b.name || b.activity || 'a business')}
          note={`Lou copies the name, activity, home office and equipment (which keeps depreciating); ${year} income and expenses start empty.`}
          onAdd={() => setList([...list, ...offer.items])} />
      )}

      {list.map((b, i) => {
        const v = b.vehicle;
        const h = b.homeOffice;
        const setAsset = (k: number, patch: Partial<BusinessAsset>) => set(b.id, { assets: b.assets.map((a, j) => (j === k ? { ...a, ...patch } : a)) });
        return (
          <div key={b.id} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Business {i + 1}{b.name ? ` · ${b.name}` : ''}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(list.filter((x) => x.id !== b.id))}><Trash size={16} /> Remove</button>
            </div>
            {b.carried && (
              <CarriedNote from={b.carried} year={year} onConfirm={() => setList(list.map((x) => (x.id === b.id ? { ...x, carried: undefined } : x)))}
                what={`Copy the ${year} income and expenses from that year's T2125${v ? ', and the kilometres driven' : ''}. Equipment from earlier years is already listed and keeps depreciating.`} />
            )}
            <div className="grid-3">
              {married && (
                <Field label="Whose business?" htmlFor={`bo-${b.id}`}>
                  <select id={`bo-${b.id}`} className="input" value={b.owner} onChange={(e) => set(b.id, { owner: e.target.value as Business['owner'] })}>
                    <option value="taxpayer">{state.taxpayer.firstName || 'Mine'}</option>
                    <option value="spouse">{state.spouse.firstName || 'My spouse'}</option>
                  </select>
                </Field>
              )}
              <TextInput label="Business name (if any)" value={b.name} onChange={(t) => set(b.id, { name: t })} />
              <TextInput label="What you do" placeholder="Graphic design" value={b.activity} onChange={(t) => set(b.id, { activity: t })} />
              <TextInput label="Industry code (6 digits)" hint="The same NAICS code as on your T2125." inputMode="numeric" value={b.code}
                onChange={(t) => set(b.id, { code: t.replace(/\D/g, '').slice(0, 6) })} />
              <Field label="Accounting method" htmlFor={`acc-${b.id}`}>
                <select id={`acc-${b.id}`} className="input" value={b.accounting} onChange={(e) => set(b.id, { accounting: e.target.value as Business['accounting'] })}>
                  <option value="cash">Cash (income when paid)</option>
                  <option value="accrual">Accrual (income when billed)</option>
                </select>
              </Field>
            </div>

            <h3 className="small" style={{ margin: 0 }}>Income (CAD, without GST/HST)</h3>
            <div className="grid-3">
              <MoneyField label="Gross business or professional income" hint="T2125 line 8299 (or 8000 for professionals)." value={b.grossCad} onChange={(n) => set(b.id, { grossCad: n })} />
              <MoneyField label="Returns and allowances" value={b.returnsCad} onChange={(n) => set(b.id, { returnsCad: n })} />
              <MoneyField label="Cost of goods sold" hint="T2125 line 8518." value={b.cogsCad} onChange={(n) => set(b.id, { cogsCad: n })} />
              <MoneyField label="Other income" hint="T2125 line 8230." value={b.otherIncomeCad} onChange={(n) => set(b.id, { otherIncomeCad: n })} />
              <MoneyField label="Net income on your T2125" hint="Line 9946. Used only to split your Canadian tax for the credit." value={b.canadianNetCad ?? 0}
                onChange={(n) => set(b.id, { canadianNetCad: n || undefined })} />
            </div>

            <h3 className="small" style={{ margin: 0 }}>Expenses (CAD)</h3>
            <div className="grid-3">
              {EXPENSES.map((e) => (
                <MoneyField key={e.line} label={e.label} hint={e.t2125 ? `T2125 line ${e.t2125}.` : undefined}
                  value={b.expensesCad[e.line] ?? 0} onChange={(n) => set(b.id, { expensesCad: { ...b.expensesCad, [e.line]: n } })} />
              ))}
              <MoneyField label="Business meals (full amount)" hint="T2125 line 8523 before the 50% cut. Leave out entertainment: the US allows none." value={b.mealsCad}
                onChange={(n) => set(b.id, { mealsCad: n })} />
            </div>
            {(b.expensesCad['27b'] ?? 0) > 0 && (
              <TextInput label="What are the other expenses?" placeholder="Software subscriptions, bank charges" value={b.otherDescription ?? ''} onChange={(t) => set(b.id, { otherDescription: t })} />
            )}
            <Callout tone="info" title="Leave out capital cost allowance (CCA) and business-use-of-home">
              <p>Enter those below instead. The US doesn't use CCA, and it has its own home office method. Car costs are also handled below.</p>
            </Callout>

            <YesNo legend="Did you use a car for this business?" value={!!v}
              onChange={(yes) => set(b.id, { vehicle: yes ? { businessKm: 0, commutingKm: 0, totalKm: 0, parkingTollsCad: 0, placedInService: '', personalUseAvailable: true, anotherVehicle: false, evidence: true, writtenEvidence: true } : undefined })} />
            {v && (
              <>
                <p className="hint">Lou uses the IRS standard mileage rate ({Math.round(MILEAGE_RATE[year] * 1000) / 10}¢ per mile for {year}) instead of your actual car costs. Keep your logbook.</p>
                <div className="grid-3">
                  <TextInput label="Business kilometres" inputMode="numeric" value={v.businessKm ? String(v.businessKm) : ''} onChange={(t) => set(b.id, { vehicle: { ...v, businessKm: Number(t.replace(/\D/g, '')) || 0 } })} />
                  <TextInput label="Commuting kilometres" hint="Home to a regular workplace." inputMode="numeric" value={v.commutingKm ? String(v.commutingKm) : ''} onChange={(t) => set(b.id, { vehicle: { ...v, commutingKm: Number(t.replace(/\D/g, '')) || 0 } })} />
                  <TextInput label="Total kilometres in the year" inputMode="numeric" value={v.totalKm ? String(v.totalKm) : ''} onChange={(t) => set(b.id, { vehicle: { ...v, totalKm: Number(t.replace(/\D/g, '')) || 0 } })} />
                  <MoneyField label="Business parking and tolls" value={v.parkingTollsCad} onChange={(n) => set(b.id, { vehicle: { ...v, parkingTollsCad: n } })} />
                  <TextInput label="Date you started using it for business" type="date" value={v.placedInService} onChange={(t) => set(b.id, { vehicle: { ...v, placedInService: t } })} />
                </div>
                <YesNo legend="Was the car available for personal use outside work hours?" value={v.personalUseAvailable} onChange={(x) => set(b.id, { vehicle: { ...v, personalUseAvailable: x } })} />
                <YesNo legend="Do you or your spouse have another car for personal use?" value={v.anotherVehicle} onChange={(x) => set(b.id, { vehicle: { ...v, anotherVehicle: x } })} />
                <YesNo legend="Do you have a written record (logbook) of business kilometres?" value={v.evidence && v.writtenEvidence}
                  onChange={(x) => set(b.id, { vehicle: { ...v, evidence: x, writtenEvidence: x } })} />
              </>
            )}

            <YesNo legend="Do you use part of your home only for this business?" hint="It must be used regularly and for nothing else (a dedicated office, not the kitchen table)."
              value={!!h} onChange={(yes) => set(b.id, { homeOffice: yes ? { homeSqM: 0, officeSqM: 0, regularExclusive: true } : undefined })} />
            {h && (
              <div className="grid-3">
                <TextInput label="Size of your home (m²)" inputMode="decimal" value={h.homeSqM ? String(h.homeSqM) : ''} onChange={(t) => set(b.id, { homeOffice: { ...h, homeSqM: Number(t) || 0 } })} />
                <TextInput label="Size of the office (m²)" hint="The IRS allows $5 per square foot, up to 300 sq ft (about 28 m²)." inputMode="decimal"
                  value={h.officeSqM ? String(h.officeSqM) : ''} onChange={(t) => set(b.id, { homeOffice: { ...h, officeSqM: Number(t) || 0 } })} />
              </div>
            )}

            <div className="section-head" style={{ marginTop: 'var(--s-2)' }}>
              <h3 className="small" style={{ margin: 0 }}>Equipment and furniture</h3>
              <p className="hint">Things you bought for the business that last more than a year (the items on your CCA schedule), this year or earlier.
                Items of US$2,500 or less bought this year are deducted in full; bigger ones are spread over several years.</p>
            </div>
            {b.assets.map((a, k) => (
              <div key={k} className="grid-3" style={{ alignItems: 'end' }}>
                <TextInput label="Item" placeholder="Laptop" value={a.description} onChange={(t) => setAsset(k, { description: t })} />
                <Field label="Kind" htmlFor={`ak-${b.id}-${k}`}>
                  <select id={`ak-${b.id}-${k}`} className="input" value={a.kind} onChange={(e) => setAsset(k, { kind: e.target.value as BusinessAsset['kind'] })}>
                    <option value="computer">Computer, camera, phone ({ADS_YEARS.computer} years)</option>
                    <option value="furniture">Office furniture ({ADS_YEARS.furniture} years)</option>
                    <option value="equipment">Other equipment ({ADS_YEARS.equipment} years)</option>
                    <option value="other">Something else</option>
                  </select>
                </Field>
                {a.kind === 'other' && (
                  <TextInput label="Recovery period (years)" hint="IRS Pub 946, Table B-1, ADS column." inputMode="numeric" value={a.recoveryYears ? String(a.recoveryYears) : ''}
                    onChange={(t) => setAsset(k, { recoveryYears: Number(t) || undefined })} />
                )}
                <MoneyField label="Cost (CAD, before GST/HST you claimed back)" value={a.costCad} onChange={(n) => setAsset(k, { costCad: n })} />
                <TextInput label="Date bought and first used" type="date" value={a.placedInService} onChange={(t) => setAsset(k, { placedInService: t })} />
                <TextInput label="Business use (%)" inputMode="numeric" value={String(a.businessUsePct)} onChange={(t) => setAsset(k, { businessUsePct: Math.min(100, Number(t.replace(/\D/g, '')) || 0) })} />
                {a.placedInService && a.placedInService < FX_FIRST && (
                  <TextInput label="Exchange rate on that date (CAD per USD)" inputMode="decimal" value={a.rateOverride ? String(a.rateOverride) : ''}
                    onChange={(t) => setAsset(k, { rateOverride: Number(t) || undefined })} />
                )}
                <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => set(b.id, { assets: b.assets.filter((_, j) => j !== k) })}><Trash size={16} /> Remove</button></div>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => set(b.id, { assets: [...b.assets, { description: '', kind: 'computer', costCad: 0, placedInService: '', businessUsePct: 100 }] })}>
                <Plus size={16} /> Add an item
              </button>
            </div>

            <details className="more">
              <summary>Advanced</summary>
              <YesNo legend="Deduct items of US$2,500 or less in full (de minimis safe harbor election)?" hint="Lou attaches the election statement. Say No to depreciate everything instead."
                value={b.deMinimis} onChange={(x) => set(b.id, { deMinimis: x })} />
              <YesNo legend="Does the business earn mainly from equipment, inventory or other capital rather than your own work?" hint="Only matters for the foreign earned income exclusion (30% limit)."
                value={b.capitalMaterial} onChange={(x) => set(b.id, { capitalMaterial: x })} />
              <YesNo legend={`Did you work in the business regularly through ${year}?`} hint="'Material participation'. Almost always Yes for a one-person business."
                value={b.materiallyParticipated} onChange={(x) => set(b.id, { materiallyParticipated: x })} />
            </details>
          </div>
        );
      })}

      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setList([...list, newBusiness('taxpayer')])}>
          <Plus size={16} /> Add a business
        </button>
      </div>
    </section>
  );
}
