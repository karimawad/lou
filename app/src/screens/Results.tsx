import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/context';
import { getBlob } from '../state/store';
import type { FilledForm } from '../pdf/fill';
import { QUEBEC_DETAIL, QUEBEC_TITLE, looksQuebec } from '../state/quebec';
import { deriveFromT1 } from '../state/t1';
import { ITIN_MAIL_TO, MAIL_TO, toReturnInput } from '../state/toInput';
import { computeReturn, type ReturnResult } from '../tax/compute';
import type { Flag } from '../tax/model';
import { YEARS } from '../tax/years';
import { Back, Download, Printer, Chevron } from '../ui/icons';
import { Callout, fmtUsd } from '../ui/kit';
import { DISPLAY_ORDER, F1040_LABELS, f1040Line } from './lines';
import { BackupPanel, FolderSync } from './Backup';
import { FbarWorksheet } from './FbarWorksheet';
import { MappingGuide } from './MappingGuide';
import { analyzeAccounts } from '../tax/accounts';
import { LockedFold, UnlockPanel, useUnlocked } from './Unlock';
import { reviewSnapshot, staleReasons, staleYears } from '../state/staleness';

export function Results() {
  const { state, go, update, openYear } = useApp();
  const input = useMemo(() => toReturnInput(state), [state]);
  const computed = useMemo(() => (input ? computeReturn(input) : null), [input]);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string>();
  const hasNoa = state.slips.some((s) => s.type === 'NOA');
  const { unlocked } = useUnlocked(state.year ?? 0);
  usePrintOpensFolds();

  // Remember what carried into this year when it was first shown, so a later change in another year can be flagged.
  const thisYear = state.year;
  const needsBaseline = thisYear !== null && !state.reviewed?.[thisYear];
  useEffect(() => {
    if (!needsBaseline || !thisYear) return;
    update((s) => { const snap = s.reviewed?.[thisYear] ? null : reviewSnapshot(s, thisYear); return snap ? { ...s, reviewed: { ...s.reviewed, [thisYear]: snap } } : s; });
  }, [needsBaseline, thisYear, update]);
  const stale = useMemo(() => staleYears(state), [state]);
  /** "I have looked at this year with the new figures": takes a fresh snapshot. */
  const markReviewed = (y: number) => update((s) => { const snap = reviewSnapshot(s, y as 2023 | 2024 | 2025); return snap ? { ...s, reviewed: { ...s.reviewed, [y]: snap } } : s; });

  if (!input || !computed) return null;
  const r = computed.best;
  const alt = computed.alternative;
  const year = input.year;
  const owe = r.refund < 0 ? -r.refund : 0;
  const needsW7 = input.filingStatus === 'mfj' && state.spouseIsUsPerson === false && !state.spouse.ssn.replace(/\D/g, '');

  const flags: Flag[] = [...deriveFromT1(state).flags, ...r.flags];
  const carried = [...state.accounts.filter((a) => a.carried).map((a) => a.institution || 'an account'),
    ...(state.businesses ?? []).filter((b) => b.carried).map((b) => b.name || 'a business'),
    ...(state.pficFunds ?? []).filter((f) => f.carried).map((f) => f.name || 'a fund')];
  if (carried.length) flags.unshift({ id: 'carried', severity: 'block', title: `Add this year's figures for ${carried.join(', ')}`,
    detail: `Lou copied ${carried.length === 1 ? 'it' : 'them'} from another year, but balances, income and distributions are different every year. Go back to A few questions and fill in ${year}'s figures.` });
  if (looksQuebec(state)) flags.unshift({ id: 'quebec', severity: 'block', title: QUEBEC_TITLE, detail: QUEBEC_DETAIL });
  if (!hasNoa) flags.unshift({ id: 'no-noa', severity: 'block', title: 'Add your Notice of Assessment',
    detail: "Without it Lou can't claim the foreign tax credit, so the tax shown here is far too high. Go back to Your slips and add it." });
  if (r.needsForm8833) flags.push({ id: '8833', severity: 'info', title: 'Form 8833 is included to explain your CPP/OAS',
    detail: "Your return treats CPP/QPP/OAS as exempt under the US-Canada treaty. Strictly, disclosure isn't required for social security (Treas. Reg. 301.6114-1(c)(1)(iv) waives it), but Lou includes Form 8833 so the IRS can see why that income isn't on your return." });
  if (state.digitalAssets) flags.push({ id: 'crypto', severity: 'block', title: 'Add your digital asset sales',
    detail: 'You answered Yes to the digital asset question. Sales go on Form 8949 and Schedule D, which Lou does not fill yet.' });
  const accounts = state.accounts.length ? analyzeAccounts(year, input.filingStatus, state.accounts, { spouseIsUsPerson: state.spouseIsUsPerson ?? undefined }) : null;
  const fbarDue = accounts ? accounts.fbar.some((f) => f.required) : state.accountsOver10k === true;
  if (accounts?.f8938.required) flags.push({ id: '8938', severity: 'info', title: 'Form 8938 is included',
    detail: `Your Canadian accounts were worth more than the threshold for people living abroad, so Lou filled Form 8938 listing each one. Check the account numbers and balances on it before you sign.` });
  if (fbarDue) flags.push({ id: 'fbar', severity: 'warn', title: 'File your FBAR separately',
    detail: 'The FBAR goes to FinCEN online, not with your tax return. The worksheet further down has every value it asks for.' });
  const excess = r.f1116.filter((f) => f.excessCredit > 0);
  const rank = { block: 0, warn: 1, info: 2 } as const;
  flags.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const download = async (kind: 'combined' | 'packet3520' | string) => {
    if (!unlocked) return; // the buttons are not shown without a key; this keeps any other path closed too
    setBuilding(true); setBuildError(undefined);
    try {
      const { fillReturn, mergeForms } = await import('../pdf/fill');
      const forms = await fillReturn(input, r);
      // The 1040 package and the Form 3520 package are mailed to different IRS addresses.
      const bytes = kind === 'review' ? await reviewPackage(forms)
        : kind === 'combined' ? await mergeForms(forms.filter((f) => !f.packet))
        : kind === 'packet3520' ? await mergeForms(forms.filter((f) => f.packet === '3520'))
        : forms.find((f) => f.id === kind)!.bytes;
      const name = kind === 'review' ? `Review-package-${year}-${input.taxpayer.lastName || 'Lou'}.pdf` : kind === 'combined' ? `US-return-${year}-${input.taxpayer.lastName || 'Lou'}.pdf` : kind === 'packet3520' ? `Form-3520-${year}-${input.taxpayer.lastName || 'Lou'}.pdf` : `${kind}-${year}.pdf`;
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      Object.assign(document.createElement('a'), { href: url, download: name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      markReviewed(year); // a package in hand is what a later change in another year makes out of date
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : 'Something went wrong building the PDF.');
    } finally { setBuilding(false); }
  };

  /** The package for a tax professional: summary, provenance, choices, warnings, forms, and the uploaded pages. */
  const reviewPackage = async (forms: FilledForm[]) => {
    const { buildReviewPackage } = await import('../pdf/reviewPackage');
    const used = new Set(state.slips.map((s) => s.docId));
    const sourcePages = [];
    for (const d of state.docs.filter((x) => used.has(x.id))) {
      for (const [page, key] of d.previewKeys.entries()) {
        const blob = await getBlob(key);
        if (blob && (blob.type === 'image/png' || !blob.type)) sourcePages.push({ doc: d.name, page, png: new Uint8Array(await blob.arrayBuffer()) });
      }
    }
    return buildReviewPackage({ state, input, result: r, flags, forms, sourcePages, preparedOn: new Date().toISOString().slice(0, 10) });
  };

  const formList = buildFormList(r, accounts?.f8938.required === true);

  return (
    <div className="page">
      <div className="head no-print">
        <p className="eyebrow">Step 6</p>
        <h1 id="main-heading" tabIndex={-1}>Your {year} US return</h1>
      </div>

      <div className="verdict no-print">
        {r.refund > 0 ? (
          <>
            <p className="small muted">The IRS owes you</p>
            <div className="verdict-amount refund">{fmtUsd(r.refund)}</div>
            <p>Your Canadian tax covers your US tax, and the additional child tax credit pays out on top of that, even though you owe nothing.</p>
          </>
        ) : owe > 0 ? (
          <>
            <p className="small muted">You owe the IRS</p>
            <div className="verdict-amount owe">{fmtUsd(owe)}</div>
            <p>{owe === r.f1040['23'] ? 'This is the net investment income tax, which the foreign tax credit cannot reduce.' : 'Your Canadian tax does not fully cover your US tax on this income. The breakdown below shows where it comes from.'}</p>
          </>
        ) : (
          <>
            <p className="small muted">You owe the IRS</p>
            <div className="verdict-amount">$0</div>
            <p>Your Canadian tax fully covers your US tax. You still need to file, because US citizens file every year no matter where they live.</p>
          </>
        )}
        {alt && (
          <p className="small">
            {r.refund === alt.refund
              ? 'Lou compared the foreign tax credit with the foreign earned income exclusion. Both give the same result here, so Lou uses the credit: it keeps the refundable child tax credit available and leaves any unused Canadian tax to carry forward.'
              : `Lou compared the foreign tax credit with the foreign earned income exclusion. ${r.usedFeie ? 'The exclusion' : 'The credit'} leaves you ${fmtUsd(Math.abs(r.refund - alt.refund))} better off.`}
          </p>
        )}
      </div>

      {stale.length > 0 && (
        <section className="section no-print">
          <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
            {stale.map((st) => (
              <Callout key={st.year} tone="warn" title={st.year === year ? `Review your ${st.year} return again` : `Your ${st.year} return changed`}>
                <p>{st.year === year
                  ? `Since you last looked at this return, another year you added or changed now carries figures into ${st.year}.`
                  : `Something you did in another year now carries figures into ${st.year}, a return you already looked at.`}</p>
                <ul style={{ margin: 'var(--s-2) 0', paddingLeft: '1.2em' }}>{staleReasons(st).map((l) => <li key={l}>{l}</li>)}</ul>
                <p>Lou has already worked out the new {st.year} numbers.{st.year === year ? ' Check them below' : ' Open it to check them'}, and download the forms again if you already printed or mailed the old ones. Your key covers every year, so there is nothing more to pay.</p>
                <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
                  {st.year !== year && <button type="button" className="btn btn-primary btn-sm" onClick={() => { openYear(st.year); go('results'); }}>Open {st.year}</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => markReviewed(st.year)}>{st.year === year ? 'I have reviewed it' : `Dismiss`}</button>
                </div>
              </Callout>
            ))}
          </div>
        </section>
      )}

      {flags.length > 0 && (
        <section className="section no-print">
          <div className="section-head"><h2>Before you file</h2><p>Lou flags anything it can't decide for you. The red ones change your return.</p></div>
          <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
            {dedupe(flags).map((f) => <Callout key={f.id} tone={f.severity === 'info' ? 'info' : f.severity} title={f.title}><p>{f.detail}</p></Callout>)}
          </div>
        </section>
      )}

      <section className="section no-print">
        <div className="section-head"><h2>How Lou got there</h2><p>Form 1040, in US dollars. Canadian amounts were converted at the IRS {year} average of {YEARS[year].irsAvgCadPerUsd} CAD per USD.</p></div>
        <div className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th>Line</th><th>What it is</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {DISPLAY_ORDER.filter((k) => r.f1040[k] !== undefined && (r.f1040[k] !== 0 || ['15', '16', '22', '24'].includes(k)) && f1040Line(year, k)).map((k) => (
                <tr key={k} className={k === '24' ? 'total' : undefined}>
                  <td className="num" style={{ textAlign: 'left' }}>{f1040Line(year, k)}</td>
                  <td>{F1040_LABELS[k] ?? k}</td>
                  <td className="num">{fmtUsd(r.f1040[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {excess.length > 0 && (
          <Callout tone="info" title="Keep this number for next year">
            <p>You paid more Canadian tax than the US needs to credit this year. The unused amount carries forward for up to ten years,
              and Schedule B (Form 1116) in your PDFs records it. {year < 2025 ? ` When you do your ${year + 1} return in Lou, these carry in automatically:` : " Next year, enter these on the questions step:"}</p>
            <ul style={{ margin: 'var(--s-2) 0 0', paddingLeft: '1.2em' }}>
              {nextYearRows(r).map((row) => <li key={row.year}><span className="num">{row.year}</span>: general {fmtUsd(row.general)}, passive {fmtUsd(row.passive)}</li>)}
            </ul>
          </Callout>
        )}
      </section>

      {!unlocked && <UnlockPanel year={year} />}
      {unlocked && (
      <section className="section no-print">
        <div className="section-head"><h2>Your forms</h2>
          <p>Official {year} IRS PDFs, filled in. Fields stay editable if you want to change anything.</p>
        </div>
        <div className="downloads">
            <div className="download-row">
              <div><div className="list-title">Your complete return</div><div className="list-meta">{formList.map((f) => f.title).join(', ')} · one PDF in mailing order</div></div>
              <button type="button" className="btn btn-primary" disabled={building || !hasNoa} onClick={() => download('combined')}><Download size={18} /> {building ? 'Building…' : 'Download PDF'}</button>
            </div>
            {r.trusts.length > 0 && (
              <div className="download-row">
                <div><div className="list-title">Form 3520 package (mail separately)</div><div className="list-meta">Form 3520 and substitute Form 3520-A for {r.trusts.map((t) => t.trustName).join(', ')} · due June 15, {year + 1}, to Ogden, UT</div></div>
                <button type="button" className="btn btn-secondary" disabled={building} onClick={() => download('packet3520')}><Download size={18} /> Download PDF</button>
              </div>
            )}
            <div className="download-row">
              <div><div className="list-title">Review package for a tax professional</div><div className="list-meta">Every number with where it came from and the rule behind it, your answers, every warning, the filled forms and your documents. For a CPA or enrolled agent to check before you sign.</div></div>
              <button type="button" className="btn btn-secondary" disabled={building || !hasNoa} onClick={() => download('review')}><Download size={18} /> Download PDF</button>
            </div>
            <details className="more">
              <summary>Download forms one at a time</summary>
              <div className="downloads">
                {formList.filter((f) => f.id).map((f) => (
                  <div key={f.id} className="download-row">
                    <div className="list-title">{f.title}</div>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={building} onClick={() => download(f.id!)}><Download size={16} /> PDF</button>
                  </div>
                ))}
              </div>
            </details>
            {buildError && <Callout tone="block" title="The PDF couldn't be built">{buildError}</Callout>}
          </div>
      </section>
      )}

      <section className="section no-print">
        <div className="section-head"><h2>How to file</h2></div>
        <ol style={{ margin: 0, paddingLeft: '1.2em', display: 'grid', gap: 'var(--s-3)' }}>
          <li>Print the return, then sign and date page 2 of Form 1040{input.filingStatus === 'mfj' ? ' (both of you)' : ''}.</li>
          <li>Keep the pages in the order Lou printed them. That is the IRS attachment order.</li>
          {year !== 2025 && <li>Catching up on past years? The IRS Streamlined Foreign Offshore procedure can waive penalties. It has its own steps, forms and mailing address, and the cover sheet, red notation and Form 14653 worksheet come from the <button type="button" className="linkish" onClick={() => go('catchup')}>Catch-up filing</button> page. Do not mail this return on its own if you plan to use it.</li>}
          {needsW7 && <li>Your spouse has no SSN or ITIN, so attach your spouse's Form W-7 to the front of the return, with their passport (original or a copy certified by the passport office). Leave the spouse SSN box blank. The IRS assigns the ITIN, then processes the return.</li>}
          <li>
            Mail it to:
            <div className="address" style={{ marginTop: 'var(--s-2)' }}>{(needsW7 ? ITIN_MAIL_TO : owe > 0 ? MAIL_TO.withPayment : MAIL_TO.noPayment).map((l) => <div key={l}>{l}</div>)}</div>
            {needsW7 && <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>This is the ITIN office from the Form W-7 instructions. Returns sent with a Form W-7 go there, not to the usual address.</p>}
            {owe > 0 && <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>You can also pay online at irs.gov/payments, which is faster than a cheque from a Canadian bank.</p>}
          </li>
          {year === 2025 && <li>The extended deadline for 2025 is October 15, 2026. If you didn't file an extension, file as soon as you can. When you owe nothing, there is no late-filing penalty.</li>}
          {fbarDue && <li>File your FBAR separately online at bsaefiling.fincen.treas.gov, using the worksheet below.</li>}
          {r.trusts.length > 0 && <li>Mail the Form 3520 package on its own (not with your return), signed, with the trustee's declaration of trust and your year-end {r.trusts.map((t) => t.account.kind.toUpperCase()).join('/')} statement attached, to: Internal Revenue Service Center, P.O. Box 409101, Ogden, UT 84409, USA. Because you live outside the US, it is due June 15, {year + 1}.</li>}
        </ol>
        <p className="small muted" style={{ maxWidth: '62ch' }}>
          Lou is software, not a tax preparer. Review every number against your slips before you sign. Your return is your responsibility.
        </p>
      </section>

      {unlocked ? <FbarWorksheet state={state} /> : <LockedFold title="FBAR worksheet" meta="Every value FinCEN asks for, account by account" />}

      {unlocked ? (
      <details className="section fold" id="mapping-guide">
        <summary>
          <span><span className="fold-title">Mapping guide</span>
            <span className="fold-meta">Every Canadian amount, where it went on your US return, and why</span></span>
          <Chevron />
        </summary>
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
          <p>If anything is ever missing from the PDFs, this is your backup. Each amount shows how Lou got it and the rule it followed.</p>
          <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}><Printer size={18} /> Print the guide</button>
        </div>
        <MappingGuide state={state} result={r} />
      </details>
      ) : <LockedFold title="Mapping guide" meta="Every Canadian amount, where it went on your US return, and why" />}

      <section className="section no-print">
        <div className="section-head">
          <h2>Keep a copy of your work</h2>
          <p>Lou saves your progress in this browser. A backup file keeps everything (all years, your answers and your documents) on your computer,
            so you can restore it in another browser, on another computer, or next year.</p>
        </div>
        <BackupPanel />
        <FolderSync />
      </section>

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => go('questions')}><Back size={18} /> Back</button>
        <span className="spacer" />
      </div>
    </div>
  );
}

/** Carryover rows for next year's questions, merged across categories by year of origin. */
function nextYearRows(r: ReturnResult) {
  const rows = new Map<number, { year: number; general: number; passive: number }>();
  for (const f of r.f1116) for (const n of f.scheduleB?.next ?? []) {
    const row = rows.get(n.year) ?? { year: n.year, general: 0, passive: 0 };
    row[f.category] += n.amount;
    rows.set(n.year, row);
  }
  return [...rows.values()].sort((a, b) => a.year - b.year);
}

function dedupe(flags: Flag[]) {
  const seen = new Set<string>();
  return flags.filter((f) => (seen.has(f.title) ? false : (seen.add(f.title), true)));
}

function buildFormList(r: ReturnResult, with8938: boolean): { id?: string; title: string }[] {
  const list: { id?: string; title: string }[] = [{ id: '1040', title: 'Form 1040' }];
  if (r.schedule1['10'] || r.schedule1['8d']) list.push({ id: 'sch1', title: 'Schedule 1' });
  if (r.schedule1a['38']) list.push({ id: 'sch1a', title: 'Schedule 1-A' });
  if (r.schedule2['21'] || r.schedule2['3'] || r.scheduleC.length) list.push({ id: 'sch2', title: 'Schedule 2' });
  if (r.schedule3['8']) list.push({ id: 'sch3', title: 'Schedule 3' });
  list.push({ id: 'schB', title: 'Schedule B' });
  for (const c of r.scheduleC) list.push({ id: `schC-${c.business.id}`, title: `Schedule C (${c.business.name || c.business.activity || 'business'})` });
  if (r.scheduleD) list.push({ id: 'schD', title: 'Schedule D' }, { id: '8949', title: 'Form 8949' });
  for (const f of r.f1116) list.push({ id: `1116-${f.category}`, title: `Form 1116 (${f.category})` });
  if (r.f6251.mustFile) {
    list.push({ id: '6251', title: 'Form 6251' });
    if (r.f6251.f1116.length && r.f6251.lines['8'] !== r.schedule3['1']) {
      for (const f of r.f6251.f1116) list.push({ id: `1116amt-${f.category}`, title: `AMT Form 1116 (${f.category})` });
    }
  }
  for (const f of r.f2555) list.push({ id: `2555-${f.owner}`, title: `Form 2555${f.owner === 'spouse' ? ' (spouse)' : ''}` });
  if (Object.keys(r.schedule8812).length) list.push({ id: 'sch8812', title: 'Schedule 8812' });
  if (with8938) list.push({ id: '8938', title: 'Form 8938' });
  for (const c of r.scheduleC) if (c.needs4562) list.push({ id: `4562-${c.business.id}`, title: 'Form 4562' }, { id: `4562stmt-${c.business.id}`, title: 'Form 4562 statement' });
  for (const p of r.pfic) if (p.mustFile) list.push({ id: `8621-${p.fund.id}`, title: `Form 8621 (${p.fund.name})` });
  if (r.scheduleC.some((c) => c.depreciation.some((d) => d.expensed))) list.push({ id: 'deminimis', title: 'De minimis election statement' });
  if (r.scheduleC.length) list.push({ id: 'se-statement', title: 'Self-employment tax statement' });
  for (const owner of ['taxpayer', 'spouse'] as const) {
    if (r.items.some((i) => i.usLine === 'excluded' && !i.deferred && i.owner === owner)) list.push({ id: `8833-${owner}`, title: `Form 8833${owner === 'spouse' ? ' (spouse)' : ''}` });
  }
  return list;
}

/** Closed folds would print empty: open them for printing, then put them back. */
function usePrintOpensFolds() {
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = [];
    const before = () => {
      reopened = [...document.querySelectorAll<HTMLDetailsElement>('details.fold:not([open])')];
      reopened.forEach((d) => { d.open = true; });
    };
    const after = () => { reopened.forEach((d) => { d.open = false; }); reopened = []; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
}
