// Questions Form 2555 needs: Part I, Part II (bona fide residence) or III (physical presence), and Part VI housing.

import { useApp } from '../state/context';
import { carryFeie2555, otherYears } from '../state/carry';
import { emptyFeie2555, type Feie2555Details } from '../tax/model';
import { bonaFide, HOUSING, HOUSING_LOCATIONS } from '../tax/feie';
import { Plus, Trash } from '../ui/icons';
import { Callout, Choices, MoneyField, TextInput, YesNo } from '../ui/kit';

export function Feie2555Section({ owner }: { owner: 'taxpayer' | 'spouse' }) {
  const { state, update } = useApp();
  // Nothing typed this year yet: start from the nearest year's background (employer, move date, home), trips left empty.
  const fromOther = state.year ? otherYears(state, state.year).map((y) => y.data.feie2555?.[owner]).find(Boolean) : undefined;
  const base = () => state.feie2555[owner] ?? (fromOther ? carryFeie2555(fromOther) : emptyFeie2555());
  const d = base();
  const year = state.year ?? 2025;
  const name = owner === 'spouse' ? state.spouse.firstName || 'Your spouse' : 'You';
  const set = (patch: Partial<Feie2555Details>) =>
    update((s) => ({ ...s, feie2555: { ...s.feie2555, [owner]: { ...(s.feie2555[owner] ?? base()), ...patch } } }));
  const setTrip = (i: number, patch: Partial<Feie2555Details['trips'][number]>) =>
    set({ trips: d.trips.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const test = d.test ?? 'bfr';
  const bf = test === 'bfr' && d.residenceStart ? bonaFide(year, d.residenceStart) : null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Form 2555 details{owner === 'spouse' ? ` for ${name}` : ''}</h2>
        <p>The foreign earned income exclusion needs proof that {owner === 'spouse' ? 'they' : 'you'} lived in Canada as a resident, not a visitor.
          These answers go on Parts I and II of Form 2555.</p>
      </div>

      <Choices<'bfr' | 'ppt'> legend="Which test do you meet?" value={test} onChange={(v) => set({ test: v })}
        options={[
          { value: 'bfr', title: 'I live in Canada (bona fide residence)', desc: `You made your home in Canada for a period that includes all of ${year} (or all of ${year + 1}, if you moved during ${year}).` },
          { value: 'ppt', title: 'I was outside the US at least 330 full days in 12 months (physical presence)', desc: 'Based only on days counted. Useful in the year you moved.' },
        ]} />
      <TextInput label={test === 'ppt' ? 'When did you arrive in Canada?' : 'When did your Canadian residence begin?'} type="date" value={d.residenceStart}
        onChange={(v) => set({ residenceStart: v })}
        hint={test === 'ppt' ? 'Lou counts full days from the day after you arrived.' : "The date you moved to Canada to live. If you've always lived here, use your date of birth."} />
      {bf?.waitForNextYear && (
        <Callout tone="block" title={`Bona fide residence needs all of ${year + 1} first`}>
          <p>Your residence began during {year}. It counts for {year} (from {d.residenceStart}) once it has lasted through December 31, {year + 1}.
            Until then, try the physical presence test, file Form 2350 for more time, or choose "Foreign tax credit only".</p>
        </Callout>
      )}

      <TextInput label="Employer's address in Canada" value={d.employerAddress} placeholder="100 King St W, Toronto, ON M5X 1A9"
        onChange={(v) => set({ employerAddress: v })} hint="Printed on your T4 next to the employer's name." />

      <Choices<Feie2555Details['employerType']> legend="Your employer is" value={d.employerType} onChange={(v) => set({ employerType: v })}
        options={[
          { value: 'foreign', title: 'A Canadian company or organization' },
          { value: 'foreignAffiliate', title: 'The Canadian branch or affiliate of a US company' },
          { value: 'us', title: 'A US company' },
          { value: 'self', title: 'Myself (self-employed)' },
        ]} />

      <YesNo legend="Have you filed Form 2555 on a past US return?" value={d.filedBefore}
        onChange={(v) => set(v ? { filedBefore: true, priorYear: d.priorYear || String(year - 1) } : { filedBefore: false, priorYear: '', revoked: false })} />
      {d.filedBefore && (
        <div className="grid-2">
          <TextInput label="Last year you filed it" inputMode="numeric" value={d.priorYear} onChange={(v) => set({ priorYear: v.replace(/\D/g, '').slice(0, 4) })} />
          <YesNo legend="Have you ever revoked the exclusion?" value={d.revoked} onChange={(v) => set({ revoked: v })} />
        </div>
      )}
      {d.filedBefore && d.revoked && (
        <TextInput label="Which exclusion, and the year the revocation took effect" value={d.revokedDetail} onChange={(v) => set({ revokedDetail: v })} />
      )}

      <Choices<NonNullable<Feie2555Details['quarters']>> legend="Where do you live in Canada?" row value={d.quarters} onChange={(v) => set({ quarters: v })}
        options={[
          { value: 'purchased', title: 'A home I own' },
          { value: 'rented', title: 'A rented house or apartment' },
          { value: 'room', title: 'A rented room' },
          { value: 'employer', title: 'Housing from my employer' },
        ]} />

      <YesNo legend={`Did any of your family live with you in Canada during ${year}?`} value={d.familyWithYou} onChange={(v) => set({ familyWithYou: v })} />
      {d.familyWithYou && (
        <TextInput label="Who, and for what period?" value={d.familyWho} placeholder="Spouse and two children, all year" onChange={(v) => set({ familyWho: v })} />
      )}

      <Choices<NonNullable<Feie2555Details['status']>> legend="Your status in Canada" value={d.status}
        onChange={(v) => set({ status: v, visaLimited: v === 'citizen' || v === 'pr' ? false : d.visaLimited })}
        options={[
          { value: 'citizen', title: 'Canadian citizen' },
          { value: 'pr', title: 'Permanent resident' },
          { value: 'permit', title: 'Work permit' },
          { value: 'other', title: 'Something else' },
        ]} />
      {d.status === 'other' && <TextInput label="Describe your status" value={d.statusOther} onChange={(v) => set({ statusOther: v })} />}
      {(d.status === 'permit' || d.status === 'other') && (
        <>
          <YesNo legend="Does it limit how long you can stay or work in Canada?" value={d.visaLimited} onChange={(v) => set({ visaLimited: v })} />
          {d.visaLimited && (
            <Callout tone="warn" title="Attach a short explanation">
              <p>Form 2555 asks for an explanation when a permit limits your stay. A sentence with the permit type and expiry date is enough.
                A fixed-term permit can make the IRS question bona fide residence, so keep your permit and lease handy.</p>
            </Callout>
          )}
        </>
      )}

      <YesNo legend="Did you keep a home in the United States while living in Canada?" value={d.usHome} onChange={(v) => set({ usHome: v })} />
      {d.usHome && (
        <TextInput label="Its address, whether it was rented, and who lived there" value={d.usHomeAddress} onChange={(v) => set({ usHomeAddress: v })} />
      )}

      <div className="field">
        <span className="label">Trips to the United States</span>
        <p className="hint">Form 2555 lists each visit in {year}{test === 'ppt' ? ', and the physical presence test also needs trips in the 12 months around it' : ''}.
          Days you worked while in the US matter most: that pay isn't foreign earned income.</p>
        {d.trips.map((t, i) => (
          <div key={i} className="grid-3" style={{ alignItems: 'end' }}>
            <TextInput label="Arrived" type="date" value={t.arrived} onChange={(v) => setTrip(i, { arrived: v })} />
            <TextInput label="Left" type="date" value={t.left} onChange={(v) => setTrip(i, { left: v })} />
            <div style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'end' }}>
              <TextInput label="Days you worked" inputMode="numeric" value={String(t.businessDays)}
                onChange={(v) => setTrip(i, { businessDays: Number(v.replace(/\D/g, '')) || 0 })} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove trip" onClick={() => set({ trips: d.trips.filter((_, j) => j !== i) })}><Trash size={16} /></button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={d.trips.length >= 20}
            onClick={() => set({ trips: [...d.trips, { arrived: '', left: '', businessDays: 0 }] })}>
            <Plus size={16} /> Add a trip
          </button>
        </div>
      </div>

      <YesNo legend="Do you want to claim foreign housing costs (rent and utilities)?"
        hint={`Housing above a base amount ($${HOUSING[year].baseFull.toLocaleString('en-US')} US for a full year) can be excluded too. Owners can't count mortgage payments or property tax.`}
        value={!!d.housing} onChange={(v) => set({ housing: v ? { expensesCad: 0, location: '' } : undefined })} />
      {d.housing && (
        <div className="grid-2">
          <MoneyField label={`Housing costs for ${year} (CAD)`} hint="Rent, utilities (not phone or internet TV), renter's insurance, residential parking, repairs, furniture rental."
            value={d.housing.expensesCad} onChange={(n) => set({ housing: { ...d.housing!, expensesCad: n } })} />
          <div className="field">
            <label htmlFor={`hl-${owner}`}>City</label>
            <select id={`hl-${owner}`} className="input" value={d.housing.location} onChange={(e) => set({ housing: { ...d.housing!, location: e.target.value } })}>
              <option value="">Elsewhere in Canada</option>
              {Object.keys(HOUSING_LOCATIONS[year]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="hint">These cities have higher IRS limits.</p>
          </div>
        </div>
      )}
    </section>
  );
}
