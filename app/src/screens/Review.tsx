import { useEffect, useMemo, useState } from 'react';
import { parseAmount } from '../extract/amount';
import { T1_INCOME_LINES } from '../extract/t1';
import { useApp } from '../state/context';
import { deriveFromT1 } from '../state/t1';
import { getBlob, type SlipRecord } from '../state/store';
import { SLIPS } from '../tax/slips';
import { YEARS } from '../tax/years';
import { Arrow, Back, Check } from '../ui/icons';
import { Callout, fmtUsd } from '../ui/kit';
import { COUNTS_ON_RETURN, destination, NOA_LINES, type Destination } from './destination';
import { confidenceOf } from './provenance';
import { SLIP_LABEL, SLIP_NAME } from './Slips';

export function Review() {
  const { state, update, go } = useApp();
  const firstOpen = state.slips.findIndex((s) => !s.confirmed);
  const [index, setIndex] = useState(Math.max(0, firstOpen));
  const slip = state.slips[index];
  const allDone = state.slips.every((s) => s.confirmed);

  if (!slip) {
    return (
      <div className="page">
        <h1 id="main-heading" tabIndex={-1}>No slips yet</h1>
        <div className="actions"><button type="button" className="btn btn-primary" onClick={() => go('slips')}><Back size={18} /> Add slips</button></div>
      </div>
    );
  }

  const setSlip = (patch: Partial<SlipRecord>) =>
    update((s) => ({ ...s, slips: s.slips.map((x) => (x.id === slip.id ? { ...x, ...patch } : x)) }));

  const confirm = () => {
    setSlip({ confirmed: true });
    const next = state.slips.findIndex((s, i) => i !== index && !s.confirmed);
    if (next >= 0) setIndex(next);
  };

  return (
    <div className="page wide">
      <div className="head">
        <p className="eyebrow">Step 4</p>
        <h1 id="main-heading" tabIndex={-1}>Check the numbers</h1>
        <p className="lede">Compare each amount with your slip. Fix anything Lou misread, then mark the slip as checked.</p>
      </div>

      <div role="tablist" aria-label="Slips" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)' }}>
        {state.slips.map((s, i) => (
          <button key={s.id} role="tab" type="button" aria-selected={i === index}
            className={`btn btn-sm ${i === index ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIndex(i)}>
            {s.confirmed && <Check size={14} strokeWidth={2.4} />}
            {s.type === 'NOA' && s.payer === 'T1 return' ? 'T1 return' : `${SLIP_LABEL[s.type]}${s.payer ? ` · ${s.payer}` : ''}`}
          </button>
        ))}
      </div>

      <SlipEditor key={slip.id} slip={slip} setSlip={setSlip} onConfirm={confirm} />

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => go('slips')}><Back size={18} /> Slips</button>
        <span className="spacer" />
        {!allDone && <span className="small muted">{state.slips.filter((s) => !s.confirmed).length} left to check</span>}
        <button type="button" className="btn btn-primary" disabled={!allDone} onClick={() => go('questions')}>
          Continue <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}

function SlipEditor({ slip, setSlip, onConfirm }: { slip: SlipRecord; setSlip: (p: Partial<SlipRecord>) => void; onConfirm: () => void }) {
  const { state } = useApp();
  const doc = state.docs.find((d) => d.id === slip.docId);
  const rate = YEARS[state.year ?? 2025].irsAvgCadPerUsd;
  const [active, setActive] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(!slip.docId);
  const married = state.filingStatus === 'mfj';
  const quebec = state.address.province === 'QC';

  const rows = useMemo(() => {
    if (slip.type === 'NOA') return [...NOA_LINES.filter((l) => !l.quebecOnly || quebec), ...(slip.payer === 'T1 return' ? T1_INCOME_LINES : [])].map((l) => ({ box: l.box, label: l.label }));
    return SLIPS[slip.type].boxes.map((b) => ({ box: b.box, label: b.label }));
  }, [slip.type, quebec]);
  const visible = showAll ? rows : rows.filter((r) => slip.boxes[r.box] !== undefined);
  const needsCheck = Object.entries(slip.reads).filter(([b, r]) => r.confidence <= 0.5 && !slip.edited.includes(b)).map(([b]) => b);

  const setBox = (box: string, raw: string) => {
    const v = raw.trim() === '' ? undefined : parseAmount(raw);
    const boxes = { ...slip.boxes };
    if (v === undefined) delete boxes[box]; else if (v !== null) boxes[box] = v;
    setSlip({ boxes, edited: [...new Set([...slip.edited, box])], confirmed: false });
  };

  const isT1 = slip.type === 'NOA' && slip.payer === 'T1 return';
  // T1 income lines: say whether Lou uses the amount (no slip for it), checks slips against it, or leaves it out.
  const derived = isT1 ? deriveFromT1(state) : null;
  const t1Use = (box: string): Destination | null => {
    if (!derived || !T1_INCOME_LINES.some((l) => l.box === box)) return null;
    const made = derived.slips.find((s) => s.id === `t1:${slip.id}:${box === '12010' ? '12000' : box}`);
    if (made) {
      const d = destination(made.type, Object.keys(made.boxes)[0]);
      const dividends = box === '12000' || box === '12010';
      return {
        where: d.where, treatment: d.treatment,
        why: dividends ? 'No dividend slip, so Lou uses the T1. The US taxes the actual dividends: Lou removes the Canadian gross-up.' : 'No slip for this line, so Lou uses the T1 amount.',
        source: dividends ? `CRA Federal Worksheet, line 12000 (taxable amount is 138% or 115% of the actual dividend); ${d.source}` : d.source,
      };
    }
    const line = box === '12010' ? '12000' : box;
    const flag = derived.flags.find((f) => f.id === `t1-check-${slip.id}-${line}` || f.id === `t1-${line}-${slip.id}`
      || (f.id === `t1-se-${slip.id}` && ['13500', '13700', '13900', '14100', '14300'].includes(box)));
    if (flag) return { where: flag.id.startsWith('t1-check') ? 'Checked against your slips' : 'Not taken from the T1', why: flag.detail, treatment: 'review' };
    return { where: 'Checked against your slips', why: 'Lou uses your slips for this line.', treatment: 'noa' };
  };

  return (
    <div className="review">
      <SlipPreview slip={slip} docName={doc?.name} previewKey={doc?.previewKeys[slip.reads[active ?? '']?.page ?? 0] ?? doc?.previewKeys[0]}
        scale={doc?.previewScale[slip.reads[active ?? '']?.page ?? 0] ?? 1} activeBox={active} method={doc?.method} />

      <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)' }}>{isT1 ? 'T1 · Your Canadian tax return' : `${SLIP_LABEL[slip.type]} · ${SLIP_NAME[slip.type]}`}</h2>
          {slip.type !== 'NOA' && <p className="small muted" style={{ marginTop: 4 }}>{SLIPS[slip.type].about}</p>}
        </div>

        <div className="grid-2">
          {slip.type !== 'NOA' && (
            <div className="field">
              <label htmlFor="payer">{slip.type === 'T4' ? 'Employer' : 'Payer'}</label>
              <input id="payer" className="input" value={slip.payer} placeholder={slip.type === 'T4' ? 'Employer name' : 'Bank or payer name'}
                onChange={(e) => setSlip({ payer: e.target.value, confirmed: false })} />
            </div>
          )}
          {married && (
            <div className="field">
              <label htmlFor="owner">Whose {slip.type === 'NOA' ? 'assessment' : 'slip'}?</label>
              <select id="owner" className="input" value={slip.owner} onChange={(e) => setSlip({ owner: e.target.value as SlipRecord['owner'], confirmed: false })}>
                <option value="taxpayer">{state.taxpayer.firstName || 'Mine'}</option>
                <option value="spouse">{state.spouse.firstName || 'My spouse'}</option>
              </select>
            </div>
          )}
        </div>

        {needsCheck.length > 0 && (
          <Callout tone="warn" title={`Please double-check box${needsCheck.length > 1 ? 'es' : ''} ${needsCheck.join(', ')}`}>
            <p>Lou wasn't sure about {needsCheck.length > 1 ? 'these amounts' : 'this amount'} from the photo. Compare with your slip and correct it if needed.</p>
          </Callout>
        )}
        {doc?.errors.map((e) => <Callout key={e} tone="warn">{e}</Callout>)}
        {isT1 && (
          <Callout tone="info" title="Read from your T1 return, as filed">
            <p>These are the same line numbers as on a Notice of Assessment. If the CRA changed anything when it assessed your return,
              use the numbers on your Notice of Assessment instead: the US credit is for the tax Canada actually charged.</p>
          </Callout>
        )}
        {slip.type === 'NOA' && !isT1 && (
          <Callout tone="info" title="Where to find these">
            <p>On your Notice of Assessment, in the "Summary" table, by line number. Quebec residents also add the Quebec income tax from their provincial return.</p>
          </Callout>
        )}

        <div className="boxes" role="list">
          {visible.map(({ box, label }) => {
            const value = slip.boxes[box];
            const read = slip.reads[box];
            const dest = t1Use(box) ?? destination(slip.type, box, { socialSecurityExempt: state.elections.canadianSocialSecurityExempt });
            const conf = confidenceOf(read, slip.edited.includes(box));
            const low = conf.level === 'low';
            const counts = dest.treatment !== 'noa' && COUNTS_ON_RETURN.has(dest.treatment);
            return (
              <div key={box} role="listitem" className={`box-row${active === box ? ' active' : ''}`}
                onMouseEnter={() => setActive(box)} onFocusCapture={() => setActive(box)}>
                <span className="box-num">{slip.type === 'NOA' ? box.replace('QC', '') : box}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="box-label">{label}</div>
                  {value !== undefined && (
                    <>
                      <div className={`box-where${counts || dest.treatment === 'noa' ? '' : ' quiet'}`}>{dest.where}</div>
                      {dest.why && <div className="box-dest">{dest.why}</div>}
                      {dest.source && <div className="box-source">Source: {dest.source}</div>}
                      <div className="box-flag">
                        <span className={`badge ${conf.tone === 'muted' ? '' : conf.tone}`} title={conf.detail}>
                          {conf.level === 'low' ? 'Please check against your document' : conf.level === 'entered' ? conf.label : `Read: ${conf.label}`}
                        </span>
                        {conf.level !== 'low' && conf.level !== 'entered' && <span className="small muted"> {conf.detail}</span>}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="visually-hidden" htmlFor={`box-${box}`}>Box {box} {label}, Canadian dollars</label>
                  <MoneyInput id={`box-${box}`} value={value} onCommit={(raw) => setBox(box, raw)} invalid={low} />
                  {value !== undefined && counts && <div className="box-usd num">≈ {fmtUsd(value / rate)}</div>}
                </div>
              </div>
            );
          })}
          {!visible.length && <div className="slip-view-empty">No amounts yet. Show all boxes to type them in.</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
          <button type="button" className="linkish" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show only filled boxes' : 'Show every box on this slip'}
          </button>
          <span className="small muted">US dollars use the IRS {state.year} average: {rate} CAD = 1 USD</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {slip.confirmed
            ? <span className="badge ok" style={{ fontSize: 'var(--text-sm)', padding: '6px 12px' }}><Check size={14} strokeWidth={2.4} /> Checked</span>
            : <button type="button" className="btn btn-primary" disabled={!Object.keys(slip.boxes).length} onClick={onConfirm}>
                <Check size={18} /> This slip looks right
              </button>}
        </div>
      </div>
    </div>
  );
}

function MoneyInput({ id, value, onCommit, invalid }: { id: string; value: number | undefined; onCommit: (raw: string) => void; invalid?: boolean }) {
  const fmt = (v: number | undefined) => (v === undefined ? '' : v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  const bad = text.trim() !== '' && parseAmount(text) === null;
  return (
    <input id={id} className="input num" inputMode="decimal" value={text} placeholder="0.00" aria-invalid={bad || invalid || undefined}
      onChange={(e) => setText(e.target.value)} onBlur={() => { if (!bad) onCommit(text); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

function SlipPreview({ slip, previewKey, scale, activeBox, docName, method }: {
  slip: SlipRecord; previewKey?: string; scale: number; activeBox: string | null; docName?: string; method?: string;
}) {
  const [url, setUrl] = useState<string>();
  const [natural, setNatural] = useState<{ w: number; h: number }>();
  const [whole, setWhole] = useState(false);
  useEffect(() => {
    let revoke: string | undefined;
    if (previewKey) getBlob(previewKey).then((b) => { if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); } });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [previewKey]);

  // Focus on the band of the page that holds the boxes Lou read (pages often carry two copies of a slip).
  const rects = Object.values(slip.reads).map((r) => r.rect).filter((r): r is [number, number, number, number] => !!r);
  const band = useMemo(() => {
    if (!natural || !rects.length) return null;
    const pad = natural.w * 0.09;
    const y0 = Math.max(0, Math.min(...rects.map((r) => r[1] * scale)) - pad * 1.6);
    const y1 = Math.min(natural.h, Math.max(...rects.map((r) => (r[1] + r[3]) * scale)) + pad * 1.4);
    return y1 - y0 > natural.h * 0.85 ? null : { y0, h: Math.max(y1 - y0, natural.w * 0.45) };
  }, [natural, rects.map((r) => r.join()).join(), scale]); // eslint-disable-line react-hooks/exhaustive-deps
  const focus = band && !whole ? band : null;

  const rect = activeBox ? slip.reads[activeBox]?.rect : undefined;
  const methodLabel = method === 'fields' ? "Read exactly from the PDF's form fields" : method === 'text' ? "Read from the PDF's text"
    : method === 'ocr' ? 'Read from the image' : method === 'csv' ? 'Imported from CSV' : 'Typed in';

  return (
    <div className="slip-view">
      {url ? (
        <div className="slip-canvas" style={focus && natural ? { aspectRatio: `${natural.w} / ${focus.h}`, overflow: 'hidden' } : undefined}>
          <div style={{ position: 'relative', marginTop: focus && natural ? `${(-focus.y0 / natural.w) * 100}%` : 0 }}>
            <img src={url} alt={`Your ${SLIP_LABEL[slip.type]}`} onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {rect && natural && (
              <div className="highlight" style={{
                left: `${((rect[0] * scale - 4) / natural.w) * 100}%`, top: `${((rect[1] * scale - 4) / natural.h) * 100}%`,
                width: `${((rect[2] * scale + 8) / natural.w) * 100}%`, height: `${((rect[3] * scale + 8) / natural.h) * 100}%`,
              }} />
            )}
          </div>
        </div>
      ) : (
        <div className="slip-view-empty">{slip.docId ? 'Loading your slip…' : 'You are typing this slip in. Keep the paper slip next to you and copy each box.'}</div>
      )}
      <div className="slip-view-bar">
        <span>{docName ?? 'No file'} · {methodLabel}</span>
        {band && <button type="button" className="linkish" style={{ fontSize: 'var(--text-xs)' }} onClick={() => setWhole((v) => !v)}>{whole ? 'Zoom to the slip' : 'Whole page'}</button>}
      </div>
    </div>
  );
}
