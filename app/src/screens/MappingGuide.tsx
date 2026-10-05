// The fallback guide: every Canadian box, its US destination, and why.

import { T1_INCOME_LINES } from '../extract/t1';
import { incomeSlips } from '../state/t1';
import { confidenceOf } from './provenance';
import type { AppState } from '../state/store';
import type { ReturnResult } from '../tax/compute';
import { SLIPS } from '../tax/slips';
import { YEARS } from '../tax/years';
import { Callout, fmtCad, fmtUsd } from '../ui/kit';
import { COUNTS_ON_RETURN, destination, t1LineLabel } from './destination';
import { DISPLAY_ORDER, F1040_LABELS, f1040Line } from './lines';
import { SLIP_LABEL } from './Slips';

/** Schedule C lines and the T2125 figures they come from (all converted at the IRS yearly average rate). */
const SCHC_GUIDE: [string, string][] = [
  ['1', 'Gross income, line 8299 or 8000'], ['2', 'Returns and allowances'], ['4', 'Cost of goods sold, line 8518'], ['6', 'Other income, line 8230'],
  ['7', 'Gross income'], ['8', 'Advertising, line 8521'], ['9', 'Car: business miles x IRS rate + parking and tolls (not line 9281)'],
  ['10', 'Commissions and fees'], ['11', 'Contract labour'], ['13', 'US depreciation (ADS), not CCA line 9936'], ['14', 'Employee benefit programs'],
  ['15', 'Insurance, line 8690'], ['16a', 'Mortgage interest, line 8710'], ['16b', 'Other interest, line 8710'], ['17', 'Legal and accounting, line 8860'],
  ['18', 'Office expenses, line 8810'], ['19', 'Pension plans'], ['20a', 'Vehicle and equipment rent'], ['20b', 'Other rent, line 8910'],
  ['21', 'Repairs and maintenance, line 8960'], ['22', 'Supplies, line 8811 (plus items expensed under the de minimis election)'],
  ['23', 'Taxes and licences, lines 8760 and 9180'], ['24a', 'Travel, line 9200'], ['24b', 'Meals: 50% of line 8523 (no entertainment)'],
  ['25', 'Utilities, line 9220'], ['26', 'Wages, line 9060'], ['27b', 'Other expenses (Part V, line 48)'], ['28', 'Total expenses'],
  ['29', 'Tentative profit'], ['30', 'Home office, simplified method: $5 x square feet (not line 9945)'],
];

export function MappingGuide({ state, result: r }: { state: AppState; result: ReturnResult }) {
  const year = state.year ?? 2025;
  const rate = YEARS[year].irsAvgCadPerUsd;

  return (
    <div style={{ display: 'grid', gap: 'var(--s-5)' }}>
      <div className="ledger-wrap">
        <table className="ledger">
          <thead>
            <tr><th>Slip</th><th>Box</th><th className="num">CAD</th><th className="num">USD</th><th>Goes to</th></tr>
          </thead>
          <tbody>
            {incomeSlips(state).flatMap((s) => Object.entries(s.boxes).filter(([box]) => s.type !== 'NOA' || !T1_INCOME_LINES.some((l) => l.box === box)).map(([box, value]) => {
              const label = s.type === 'NOA' ? t1LineLabel(box) : SLIPS[s.type].boxes.find((b) => b.box === box)?.label;
              const dest = destination(s.type, box, { socialSecurityExempt: state.elections.canadianSocialSecurityExempt });
              const counts = dest.treatment !== 'noa' && COUNTS_ON_RETURN.has(dest.treatment);
              const conf = confidenceOf(s.reads[box], s.edited.includes(box), s.fromT1Line);
              return (
                <tr key={`${s.id}-${box}`}>
                  <td><strong>{SLIP_LABEL[s.type]}</strong>{s.payer ? <div className="muted small">{s.payer}</div> : null}</td>
                  <td><span className="num">{box.replace('QC', '')}</span><div className="muted small">{label}</div><div className="muted small">{conf.level === 'entered' || conf.level === 't1' ? conf.label : `Read: ${conf.label}`}</div></td>
                  <td className="num">{fmtCad(value)}</td>
                  <td className="num">{counts ? fmtUsd(value / rate) : '·'}</td>
                  <td style={{ maxWidth: 360 }}><strong>{dest.where}</strong>{dest.why ? <div className="muted small">{dest.why}</div> : null}{dest.source ? <div className="muted small">Source: {dest.source}</div> : null}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      <div className="ledger-wrap">
        <table className="ledger">
          <thead><tr><th>Form 1040 ({year}) line</th><th>What it is</th><th className="num">Enter</th></tr></thead>
          <tbody>
            {DISPLAY_ORDER.filter((k) => r.f1040[k] && f1040Line(year, k)).map((k) => (
              <tr key={k}><td className="num" style={{ textAlign: 'left' }}>{f1040Line(year, k)}</td><td>{F1040_LABELS[k] ?? k}</td><td className="num">{fmtUsd(r.f1040[k])}</td></tr>
            ))}
            {r.f1040['1h'] ? <tr><td className="num" style={{ textAlign: 'left' }}>1h type</td><td colSpan={2}>Write "Foreign wages - Canada" beside the amount</td></tr> : null}
          </tbody>
        </table>
      </div>

      {r.scheduleC.map((c) => (
        <div key={c.business.id} className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th>Schedule C line</th><th>From your T2125</th><th className="num">Enter</th></tr></thead>
            <tbody>
              {SCHC_GUIDE.filter(([k]) => c.lines[k]).map(([k, what]) => (
                <tr key={k}><td className="num" style={{ textAlign: 'left' }}>{year < 2025 && k === '27b' ? '27a' : k}</td><td>{what}</td><td className="num">{fmtUsd(c.lines[k])}</td></tr>
              ))}
              <tr><td className="num" style={{ textAlign: 'left' }}>31</td><td>Net profit: also Schedule 1, line 3</td><td className="num">{fmtUsd(c.lines['31'])}</td></tr>
              <tr><td colSpan={3} className="muted small">Schedule SE: not filed. Schedule 2, line 4: write "Exempt, see attached statement" and attach your CPT56 certificate of coverage.</td></tr>
            </tbody>
          </table>
        </div>
      ))}

      {r.scheduleD && (
        <div className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th>Form 8949 (box {r.scheduleD.rows.some((x) => !x.longTerm) ? 'C' : ''}{r.scheduleD.rows.some((x) => !x.longTerm) && r.scheduleD.rows.some((x) => x.longTerm) ? ' and ' : ''}{r.scheduleD.rows.some((x) => x.longTerm) ? 'F' : ''})</th><th>Bought / sold</th><th className="num">Proceeds</th><th className="num">Cost</th><th className="num">Gain</th></tr></thead>
            <tbody>
              {r.scheduleD.rows.map((x, i) => (
                <tr key={i}><td>{x.description}<div className="muted small">{x.longTerm ? 'Long-term' : 'Short-term'}{x.acquiredRate ? ` · rates ${x.acquiredRate} / ${x.soldRate} CAD per USD` : ''}</div></td>
                  <td>{x.acquired} → {x.sold}</td><td className="num">{fmtUsd(x.proceeds)}</td><td className="num">{fmtUsd(x.basis)}</td><td className="num">{fmtUsd(x.gain)}</td></tr>
              ))}
              <tr><td colSpan={4}>Schedule D line 16 (then line 21 if a loss), to Form 1040 line 7</td><td className="num">{fmtUsd(r.f1040['7a'])}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {r.pfic.filter((p) => p.fund.account !== 'rrsp').map((p) => (
        <div key={p.fund.id} className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th colSpan={2}>Form 8621: {p.fund.name} ({p.fund.regime === '1291' ? 'section 1291 fund' : p.fund.regime === 'mtm' ? 'mark-to-market' : 'QEF'}){p.mustFile ? '' : ' · not required this year'}</th></tr></thead>
            <tbody>
              {Object.entries(p.lines).filter(([, v]) => v !== undefined && v !== 0).map(([k, v]) => (
                <tr key={k}><td className="num" style={{ textAlign: 'left' }}>{k.replace('15e1', '15e(1)').replace('15e2', '15e(2)')}</td><td className="num">{['15a', '15b', '15c', '15d', '15e1'].includes(k) ? fmtCad(v) : k === '3' ? v : fmtUsd(v)}</td></tr>
              ))}
              {p.deferredTax > 0 && <tr><td colSpan={2} className="muted small">Line 16e goes on Form 1040 line 16 (box 3, "1291TAX"); line 16f on Schedule 2 line 17p; line 16b on Schedule 1 line 8z.</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      {r.trusts.map((t) => (
        <div key={t.account.id} className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th colSpan={2}>Form 3520 / 3520-A: {t.trustName} (mailed separately)</th></tr></thead>
            <tbody>
              <tr><td>Form 3520 line 13 (contributions)</td><td className="num">{fmtUsd(t.contributionsUsd)}</td></tr>
              <tr><td>Form 3520 line 23 / owner statement line 9 (value Dec 31)</td><td className="num">{fmtUsd(t.yearEndUsd)}</td></tr>
              <tr><td>Form 3520 lines 24 and 27 (withdrawals)</td><td className="num">{fmtUsd(t.withdrawalsUsd)}</td></tr>
              <tr><td>3520-A Part II lines 1, 2 (interest, dividends; also on your Schedule B)</td><td className="num">{fmtUsd(t.interestUsd)} / {fmtUsd(t.dividendsUsd)}</td></tr>
            </tbody>
          </table>
        </div>
      ))}

      {r.f1116.map((f) => (
        <div key={f.category} className="ledger-wrap">
          <table className="ledger">
            <thead><tr><th colSpan={3}>Form 1116, {f.category} category (country: Canada, taxes accrued)</th></tr></thead>
            <tbody>
              {(['1a', '3a', '3d', '3e', '3f', '3g', '6', '7', '8', '9', '10', '11', '12', '14', '15', '17', '18', '19', '20', '21', '24'] as const)
                .filter((k) => f.lines[k] !== undefined && (f.lines[k] !== 0 || ['7', '14', '24'].includes(k)))
                .map((k) => (
                  <tr key={k}><td className="num" style={{ textAlign: 'left' }}>{k}</td><td>{k === '8' ? `Canadian income tax (${fmtCad(f.taxCad)})` : ''}</td>
                    <td className="num">{k === '3f' || k === '19' ? f.lines[k].toFixed(4) : fmtUsd(f.lines[k])}</td></tr>
                ))}
              {f.excessCredit > 0 && <tr><td colSpan={2}>Unused credit to carry forward (Schedule B, Form 1116)</td><td className="num">{fmtUsd(f.excessCredit)}</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      {r.needsForm8833 && (
        <Callout tone="info" title="Form 8833 (included in your PDFs)">
          <p>Treaty country: Canada. Articles: XVIII(5) and XXIX(3)(a). Code provision modified: IRC section 61(a). Amount excluded:{' '}
            {fmtUsd(r.items.filter((i) => i.usLine === 'excluded' && !i.deferred).reduce((acc, i) => acc + i.usd, 0))} of Canadian social security (CPP/QPP/OAS).
            Disclosure is voluntary under Treas. Reg. 301.6114-1(c)(1)(iv).</p>
        </Callout>
      )}
    </div>
  );
}
