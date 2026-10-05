import { useState } from 'react';
import { carryDependents, dependentKey, missingFrom } from '../state/carry';
import { useApp } from '../state/context';
import { CarryOffer } from './CarryOffer';
import type { AppState } from '../state/store';
import type { Dependent, Person } from '../tax/model';
import type { FilingStatus } from '../tax/years';
import { Arrow, Back, Plus, Trash } from '../ui/icons';
import { Callout, Choices, Field, TextInput, YesNo } from '../ui/kit';

const PROVINCES = [
  ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'], ['NL', 'Newfoundland and Labrador'],
  ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'],
  ['QC', 'Quebec'], ['SK', 'Saskatchewan'], ['YT', 'Yukon'],
] as const;

export const formatSsn = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 9);
  return d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
};
const ssnOk = (v: string) => v.replace(/\D/g, '').length === 9;

type Married = 'no' | 'yes';

export function You() {
  const { state, update, go } = useApp();
  const [tried, setTried] = useState(false);
  const year = state.year ?? 2025;
  const startMarried: Married | null = state.filingStatus === 'mfj' || state.filingStatus === 'mfs' || state.spouseIsUsPerson !== null
    ? 'yes' : state.filingStatus ? 'no' : null;
  const [isMarried, setIsMarried] = useState<Married | null>(startMarried);

  const set = (fn: (s: AppState) => AppState) => update(fn);
  const setPerson = (who: 'taxpayer' | 'spouse', patch: Partial<Person>) => set((s) => ({ ...s, [who]: { ...s[who], ...patch } }));
  const setStatus = (filingStatus: FilingStatus) => set((s) => ({ ...s, filingStatus }));
  const hasSpouseForm = state.filingStatus === 'mfj' || state.filingStatus === 'mfs';
  // The spouse's number may be left blank (NRA on a separate return, Form W-7 on a joint one); a partly typed number is an error.
  const spouseDigits = state.spouse.ssn.replace(/\D/g, '').length;
  const spouseNoTin = hasSpouseForm && spouseDigits === 0;

  const depOffer = state.year ? missingFrom(state, state.year, (d) => d.dependents, (list, _from, to) => carryDependents(list, to), dependentKey, state.dependents) : null;

  const errors = {
    firstName: !state.taxpayer.firstName.trim() && 'Enter your first name.',
    lastName: !state.taxpayer.lastName.trim() && 'Enter your last name.',
    ssn: !ssnOk(state.taxpayer.ssn) && 'Enter all 9 digits of your SSN.',
    dob: !state.taxpayer.dateOfBirth && 'Enter your date of birth.',
    status: !state.filingStatus && 'Answer the marriage questions above.',
    spouseFirst: hasSpouseForm && !state.spouse.firstName.trim() && "Enter your spouse's first name.",
    spouseSsn: hasSpouseForm && spouseDigits > 0 && spouseDigits < 9 && "Enter all 9 digits, or leave it blank if your spouse has no number.",
    city: !state.address.city.trim() && 'Enter your city.',
    province: !state.address.province && 'Choose your province or territory.',
    canada: state.livedInCanadaAllYear !== true && 'Lou needs you to have lived in Canada all year.',
    digital: state.digitalAssets === null && 'Answer the digital asset question.',
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (tried ? errors[k] || undefined : undefined);

  const addDependent = () => set((s) => ({ ...s, dependents: [...s.dependents, {
    firstName: '', lastName: s.taxpayer.lastName, ssn: '', relationship: 'Son', dateOfBirth: '',
    hasValidSsn: true, usPerson: true, livedWithYouOverHalfYear: true,
  }] }));
  const setDep = (i: number, patch: Partial<Dependent>) => set((s) => ({ ...s, dependents: s.dependents.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));

  return (
    <div className="page">
      <div className="head">
        <p className="eyebrow">Step 2</p>
        <h1 id="main-heading" tabIndex={-1}>About you</h1>
        <p className="lede">This goes on the first page of your Form 1040. It is saved only in this browser.</p>
      </div>

      {state.carryFrom && (
        <Callout tone="info" title={`Started from your ${state.carryFrom} details`}>
          <p>Lou copied what rarely changes: your filing situation, dependents, Canadian accounts, businesses, funds and Form 2555 background.
            Check they still apply to {year}. Balances, income and slips are never copied: Lou asks for {year}'s figures.</p>
        </Callout>
      )}

      <section className="section">
        <div className="section-head"><h2>You</h2></div>
        <div className="grid-2">
          <TextInput label="First name and middle initial" value={state.taxpayer.firstName} autoComplete="given-name"
            onChange={(v) => setPerson('taxpayer', { firstName: v })} error={err('firstName')} />
          <TextInput label="Last name" value={state.taxpayer.lastName} autoComplete="family-name"
            onChange={(v) => setPerson('taxpayer', { lastName: v })} error={err('lastName')} />
          <TextInput label="Social Security number" value={formatSsn(state.taxpayer.ssn)} inputMode="numeric" autoComplete="off"
            placeholder="123-45-6789" onChange={(v) => setPerson('taxpayer', { ssn: formatSsn(v) })} error={err('ssn')}
            hint="Not your Canadian SIN." />
          <TextInput label="Date of birth" type="date" value={state.taxpayer.dateOfBirth}
            onChange={(v) => setPerson('taxpayer', { dateOfBirth: v })} error={err('dob')}
            hint="Used for the extra standard deduction at 65 and over." />
          <TextInput label="Occupation" value={state.taxpayer.occupation ?? ''} placeholder="Teacher"
            onChange={(v) => setPerson('taxpayer', { occupation: v })} hint="Printed next to your signature." />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Filing status</h2>
          <p>Your status on December 31, {year} decides this.</p>
        </div>
        <YesNo legend={`Were you married on December 31, ${year}?`} value={isMarried === null ? null : isMarried === 'yes'}
          onChange={(v) => { setIsMarried(v ? 'yes' : 'no'); set((s) => ({ ...s, filingStatus: null, spouseIsUsPerson: v ? s.spouseIsUsPerson : null })); }} />

        {isMarried === 'no' && (
          <Choices<FilingStatus> legend="Which describes you?" value={state.filingStatus} onChange={setStatus} options={[
            { value: 'single', title: 'Single', desc: 'The usual choice if no one depends on you.' },
            { value: 'hoh', title: 'Head of household', desc: 'You paid more than half the cost of keeping up a home for a child or relative who lived with you more than half the year. Lower tax than single.' },
          ]} />
        )}

        {isMarried === 'yes' && (
          <>
            <YesNo legend="Is your spouse a US citizen or green card holder?" value={state.spouseIsUsPerson}
              onChange={(v) => set((s) => ({ ...s, spouseIsUsPerson: v, filingStatus: v ? 'mfj' : 'mfs' }))} />
            {state.spouseIsUsPerson === true && (
              <Choices<FilingStatus> legend="How do you want to file?" value={state.filingStatus} onChange={setStatus} options={[
                { value: 'mfj', title: 'Married filing jointly', desc: 'Recommended. One return for both of you, usually the lowest tax.' },
                { value: 'mfs', title: 'Married filing separately', desc: 'Each of you files your own return. Rarely better.' },
              ]} />
            )}
            {state.spouseIsUsPerson === false && (
              <Choices<FilingStatus> legend="How do you want to file?" value={state.filingStatus} onChange={setStatus} options={[
                { value: 'mfs', title: 'Married filing separately', desc: 'Recommended for most people married to a Canadian. Only your income goes on the US return.' },
                { value: 'hoh', title: 'Head of household', desc: 'Allowed when your spouse has no US status and a child lived with you more than half the year. Lower tax than filing separately.' },
                { value: 'mfj', title: 'Married filing jointly (by election)', desc: "Treats your spouse as a US resident, which puts their worldwide income on this return too. Lou won't calculate their side; talk to a cross-border professional first." },
              ]} />
            )}
          </>
        )}
        {err('status') && <p className="error-text">{err('status')}</p>}
      </section>

      {hasSpouseForm && (
        <section className="section">
          <div className="section-head">
            <h2>Your spouse</h2>
            <p>If your spouse has no SSN or ITIN, leave that box blank.</p>
          </div>
          <div className="grid-2">
            <TextInput label="Spouse's first name" value={state.spouse.firstName} onChange={(v) => setPerson('spouse', { firstName: v })} error={err('spouseFirst')} />
            <TextInput label="Spouse's last name" value={state.spouse.lastName} onChange={(v) => setPerson('spouse', { lastName: v })} />
            <TextInput label="Spouse's SSN or ITIN (if any)" value={formatSsn(state.spouse.ssn)} inputMode="numeric"
              onChange={(v) => setPerson('spouse', { ssn: formatSsn(v) })} error={err('spouseSsn')} />
            {state.filingStatus === 'mfj' && (
              <>
                <TextInput label="Spouse's date of birth" type="date" value={state.spouse.dateOfBirth} onChange={(v) => setPerson('spouse', { dateOfBirth: v })} />
                <TextInput label="Spouse's occupation" value={state.spouse.occupation ?? ''} onChange={(v) => setPerson('spouse', { occupation: v })} />
              </>
            )}
          </div>
          {spouseNoTin && state.filingStatus === 'mfs' && state.spouseIsUsPerson === false && (
            <Callout tone="ok" title={'Lou will print "NRA" in that box'}>
              <p>That's what the IRS instructions say to do when a spouse filing no US return doesn't have and doesn't need an SSN or ITIN.</p>
            </Callout>
          )}
          {spouseNoTin && state.filingStatus === 'mfj' && state.spouseIsUsPerson === false && (
            <Callout tone="warn" title="Your spouse will need an ITIN (Form W-7)">
              <p>On a joint return your spouse needs a number. You apply for it with the return itself: Lou leaves the box blank, as the Form W-7
                instructions say. Fill in Form W-7 for your spouse (reason "e", spouse of a US citizen or resident), attach it to the front of
                the return, and include your spouse's passport (an original or a copy certified by the passport office). The whole package goes
                to the IRS ITIN office in Austin, not the usual address. Lou shows that address on the last page. Lou doesn't fill Form W-7.</p>
            </Callout>
          )}
          {spouseNoTin && state.spouseIsUsPerson === true && (
            <Callout tone="warn" title="A US citizen or green card holder needs an SSN">
              <p>People who can get a Social Security number can't get an ITIN instead. Your spouse should apply to the Social Security
                Administration. You can still print the return now with the box blank, but the IRS may hold it until the number is added.</p>
            </Callout>
          )}
          {state.filingStatus === 'mfj' && state.spouseIsUsPerson === false && (
            <Callout tone="warn" title="Joint filing with a non-US spouse needs a signed statement">
              <p>You both must attach a statement electing to treat your spouse as a US resident (IRC 6013(g)). Your spouse's
                Canadian slips then belong in Lou too. This choice stays in place for future years unless you revoke it.</p>
            </Callout>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-head"><h2>Your address in Canada</h2></div>
        <div className="grid-2">
          <div style={{ gridColumn: '1 / -1' }}>
            <TextInput label="Street address" value={state.address.street} autoComplete="street-address"
              onChange={(v) => set((s) => ({ ...s, address: { ...s.address, street: v } }))} />
          </div>
          <TextInput label="City" value={state.address.city} autoComplete="address-level2"
            onChange={(v) => set((s) => ({ ...s, address: { ...s.address, city: v } }))} error={err('city')} />
          <Field label="Province or territory" error={err('province')} htmlFor="province">
            <select id="province" className="input" value={state.address.province}
              onChange={(e) => set((s) => ({ ...s, address: { ...s.address, province: e.target.value } }))}>
              <option value="">Choose…</option>
              {PROVINCES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </Field>
          <TextInput label="Postal code" value={state.address.postalCode} autoComplete="postal-code" placeholder="M5H 1A1"
            onChange={(v) => set((s) => ({ ...s, address: { ...s.address, postalCode: v.toUpperCase() } }))} />
        </div>
        {state.address.province === 'QC' && (
          <Callout tone="info" title="Quebec residents">
            <p>Your Quebec income tax (from your TP-1) counts toward the US foreign tax credit. Lou asks for it with your Notice of Assessment.</p>
          </Callout>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Children and other dependents</h2>
          <p>{`Children under 17 with an SSN can bring a US child tax credit of up to ${year === 2023 ? '$1,600' : '$1,700'} each in cash, even when you owe no US tax.`}</p>
          {Object.keys(state.years).length > 0 && <p className="muted">This list is for {year} only. Changes here don't change your other years.</p>}
        </div>
        {depOffer && (
          <CarryOffer section="dependents" from={depOffer.year} what={['dependent', 'dependents']}
            names={depOffer.items.map((d) => `${d.firstName} ${d.lastName}`.trim() || 'a dependent')}
            note="Check that each one still lived with you and qualifies this year."
            onAdd={() => set((s) => ({ ...s, dependents: [...s.dependents, ...depOffer.items] }))} />
        )}
        {state.dependents.map((d, i) => (
          <div key={i} style={{ display: 'grid', gap: 'var(--s-4)', padding: 'var(--s-4)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
            <div className="grid-3">
              <TextInput label="First name" value={d.firstName} onChange={(v) => setDep(i, { firstName: v })} />
              <TextInput label="Last name" value={d.lastName} onChange={(v) => setDep(i, { lastName: v })} />
              <TextInput label="Date of birth" type="date" value={d.dateOfBirth} onChange={(v) => setDep(i, { dateOfBirth: v })} />
              <TextInput label="SSN" value={formatSsn(d.ssn)} inputMode="numeric" onChange={(v) => setDep(i, { ssn: formatSsn(v), hasValidSsn: ssnOk(v) })}
                hint={ssnOk(d.ssn) ? undefined : 'No SSN yet? They can still count for the $500 credit for other dependents, with an ITIN.'} />
              <Field label="Relationship" htmlFor={`rel-${i}`}>
                <select id={`rel-${i}`} className="input" value={d.relationship} onChange={(e) => setDep(i, { relationship: e.target.value })}>
                  {['Son', 'Daughter', 'Stepchild', 'Foster child', 'Grandchild', 'Parent', 'Other'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid-2">
              <YesNo legend="US citizen?" value={d.usPerson} onChange={(v) => setDep(i, { usPerson: v })} />
              <YesNo legend="Lived with you more than half the year?" value={d.livedWithYouOverHalfYear} onChange={(v) => setDep(i, { livedWithYouOverHalfYear: v })} />
            </div>
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => set((s) => ({ ...s, dependents: s.dependents.filter((_, j) => j !== i) }))}>
              <Trash size={16} /> Remove</button></div>
          </div>
        ))}
        <div><button type="button" className="btn btn-secondary" onClick={addDependent}><Plus size={18} /> Add a child or dependent</button></div>
      </section>

      <section className="section">
        <YesNo legend={`Did you live in Canada for all of ${year}?`} value={state.livedInCanadaAllYear}
          onChange={(v) => set((s) => ({ ...s, livedInCanadaAllYear: v }))} />
        {state.livedInCanadaAllYear === false && (
          <Callout tone="block" title="Lou can't do a part-year return yet">
            <p>If you moved to or from Canada during the year, your US return has different rules (and sometimes a dual-status
              return). A cross-border tax professional is the safest route for that year.</p>
          </Callout>
        )}
        {err('canada') && state.livedInCanadaAllYear === null && <p className="error-text">Answer this question.</p>}
        <YesNo legend={`At any time in ${year}, did you receive, sell or exchange any digital assets (such as crypto)?`}
          hint="The IRS asks everyone this on page 1. Simply owning crypto you didn't sell or receive is a No."
          value={state.digitalAssets} onChange={(v) => set((s) => ({ ...s, digitalAssets: v }))} />
        {state.digitalAssets === true && (
          <Callout tone="warn" title="Crypto sales need Form 8949">
            <p>Lou doesn't fill Form 8949 for crypto yet. Lou will mark the box and remind you to add the sales.</p>
          </Callout>
        )}
        {err('digital') && <p className="error-text">{err('digital')}</p>}
      </section>

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => go('start')}><Back size={18} /> Back</button>
        <span className="spacer" />
        {tried && !valid && <span className="error-text" role="status">A few answers are missing above.</span>}
        <button type="button" className="btn btn-primary" onClick={() => { setTried(true); if (valid) go('slips'); }}>
          Continue <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}
