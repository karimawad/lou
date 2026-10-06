import { useRef, useState, type DragEvent } from 'react';
import { useApp } from '../state/context';
import { addToYear, putBlob, uid, type DocRecord, type SlipRecord } from '../state/store';
import { TAX_YEARS, type TaxYear } from '../tax/years';
import type { SlipType } from '../tax/slips';
import { CSV_TEMPLATE } from '../extract/csv';
import type { Progress } from '../extract/browser';
import { Arrow, Back, Camera, FileIcon, Plus, Trash, Upload } from '../ui/icons';
import { Callout } from '../ui/kit';

export { SLIP_LABEL, SLIP_NAME } from './slipLabels';
import { SLIP_LABEL, SLIP_NAME } from './slipLabels';

interface Job { id: string; name: string; progress: Progress; error?: string }

export function Slips() {
  const { state, update, go } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const hasNoa = state.slips.some((s) => s.type === 'NOA');
  const working = jobs.some((j) => j.progress.stage !== 'done' && !j.error);

  async function handleFiles(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    const { readDocument } = await import('../extract/browser');
    for (const file of list) {
      const id = uid();
      setJobs((j) => [...j, { id, name: file.name, progress: { stage: 'reading', fraction: 0.05, label: 'Starting' } }]);
      try {
        const r = await readDocument(file, (progress) => setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress } : x))));
        const previewKeys = await Promise.all(r.previews.map(async (b, i) => { const k = `${id}:p${i}`; await putBlob(k, b); return k; }));
        const doc: DocRecord = {
          id, name: file.name, kind: r.method === 'csv' ? 'csv' : file.type.startsWith('image/') ? 'image' : 'pdf',
          method: r.method, addedAt: Date.now(), previewKeys, previewScale: r.previewScale, errors: r.errors,
        };
        const slips: SlipRecord[] = r.slips.filter((s) => s.type).map((s) => ({
          id: uid(), type: s.type!, owner: s.owner ?? 'taxpayer', payer: s.payer ?? '', year: s.year, docId: id,
          boxes: Object.fromEntries(Object.entries(s.boxes).map(([k, v]) => [k, v.value])),
          reads: s.boxes, edited: [], confirmed: false,
        }));
        // Slips printed with another supported year go to that year's workspace.
        const current = state.year;
        const routed = new Map<TaxYear, SlipRecord[]>();
        for (const slip of slips) {
          const y = (slip.year && TAX_YEARS.includes(slip.year as TaxYear) ? slip.year : current) as TaxYear;
          routed.set(y, [...(routed.get(y) ?? []), slip]);
        }
        if (!routed.size && current) routed.set(current, []);
        update((st) => [...routed.entries()].reduce((acc, [y, list]) => addToYear(acc, y, [doc], list), st));
        const elsewhere = [...routed.keys()].filter((y) => y !== current);
        const found = slips.length ? `Found ${slips.length === 1 ? 'a slip' : `${slips.length} slips`}` : 'No slip found';
        const label = elsewhere.length ? `${found}. Added to your ${elsewhere.join(' and ')} return${elsewhere.length > 1 ? 's' : ''}` : found;
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress: { stage: 'done', fraction: 1, label }, error: r.errors[0] } : x)));
      } catch (e) {
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, error: `Lou couldn't open this file. ${e instanceof Error ? e.message : ''}`.trim() } : x)));
      }
    }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); };

  const addManual = (type: SlipType) => {
    const slip: SlipRecord = { id: uid(), type, owner: 'taxpayer', payer: '', year: state.year ?? undefined, boxes: {}, reads: {}, edited: [], confirmed: false };
    update((s) => ({ ...s, slips: [...s.slips, slip] }));
    setAdding(false);
  };

  const removeSlip = (id: string) => update((s) => ({ ...s, slips: s.slips.filter((x) => x.id !== id) }));

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'lou-slips-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const wrongYear = state.slips.filter((s) => s.year && state.year && s.year !== state.year && !TAX_YEARS.includes(s.year as TaxYear));

  return (
    <div className="page">
      <div className="head">
        <p className="eyebrow">Step 3</p>
        <h1 id="main-heading" tabIndex={-1}>Add your slips</h1>
        <p className="lede">Drop in PDFs from CRA My Account, your employer or your bank, or take photos of paper slips. Lou reads them here on your device.</p>
      </div>

      <div className={`drop${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <div className="drop-icon"><Upload size={24} /></div>
        <h2>Drop slips here</h2>
        <p>Start with your final T1 General. PDF, photo (JPG, PNG, HEIC) or CSV. Several at once is fine.</p>
        <div className="drop-buttons">
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}><FileIcon size={18} /> Choose files</button>
          <button type="button" className="btn btn-secondary" onClick={() => camRef.current?.click()}><Camera size={18} /> Take a photo</button>
        </div>
        <input ref={fileRef} type="file" multiple hidden accept=".pdf,.csv,.tsv,image/*,application/pdf,text/csv"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
        <input ref={camRef} type="file" hidden accept="image/*" capture="environment"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {jobs.length > 0 && (
        <div className="list" aria-live="polite">
          {jobs.map((j) => (
            <div key={j.id} className="list-row">
              <span className="slip-tag" style={{ minWidth: 40 }}><FileIcon size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="list-title">{j.name}</div>
                <div className="list-meta">{j.error ?? j.progress.label}</div>
                {!j.error && j.progress.stage !== 'done' && (
                  <div className="progress" style={{ display: 'block', height: 3, marginTop: 6, background: 'var(--line)', borderRadius: 3 }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round(j.progress.fraction * 100)}%`, background: 'var(--accent)', transition: 'width 300ms var(--ease)' }} />
                  </div>
                )}
              </div>
              <span className={`badge ${j.error ? 'warn' : j.progress.stage === 'done' ? 'ok' : ''}`}>{j.error ? 'Check' : j.progress.stage === 'done' ? 'Read' : 'Reading'}</span>
            </div>
          ))}
        </div>
      )}

      {!hasNoa && (
        <Callout tone="info" title="Add your T1 return or Notice of Assessment">
          <p>Your US foreign tax credit uses the Canadian tax you owe for the year, not the tax withheld on your slips. Drop in your
            final T1 General (or the Notice of Assessment from CRA My Account), or type in five numbers from it.</p>
          <div style={{ marginTop: 'var(--s-3)' }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => addManual('NOA')}><Plus size={16} /> Type it in</button></div>
        </Callout>
      )}

      <section className="section">
        <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 'var(--s-3)' }}>
          <div><h2>Slips Lou has</h2><p>{state.slips.length ? 'You will check each one on the next step.' : 'Nothing yet. Add a file above, or type a slip in.'}</p></div>
        </div>
        {state.slips.length > 0 && (
          <div className="list">
            {state.slips.map((s) => (
              <div key={s.id} className="list-row">
                <span className="slip-tag">{s.type === 'NOA' && s.payer === 'T1 return' ? 'T1' : SLIP_LABEL[s.type]}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="list-title">{s.payer || SLIP_NAME[s.type]}</div>
                  <div className="list-meta">
                    {Object.keys(s.boxes).length} {Object.keys(s.boxes).length === 1 ? 'box' : 'boxes'} filled
                    {s.docId ? ` · from ${state.docs.find((d) => d.id === s.docId)?.name ?? 'a file'}` : ' · typed in'}
                    {s.year ? ` · ${s.year}` : ''}
                  </div>
                </div>
                <div className="row-actions">
                  {s.confirmed && <span className="badge ok">Checked</span>}
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${SLIP_LABEL[s.type]} ${s.payer}`} onClick={() => removeSlip(s.id)}><Trash size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {wrongYear.length > 0 && (
          <Callout tone="warn" title="Some slips are from a different year">
            <p>{wrongYear.map((s) => `${SLIP_LABEL[s.type]} (${s.year})`).join(', ')} {wrongYear.length === 1 ? 'is' : 'are'} from a year Lou doesn't cover (2023 to 2025). Lou leaves {wrongYear.length === 1 ? 'it' : 'them'} out.</p>
          </Callout>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-2)', alignItems: 'center' }}>
          {adding ? (
            <>
              <span className="small muted">Which slip?</span>
              {(['T4', 'T5', 'T3', 'T4A', 'T4RSP', 'T4RIF', 'T4AP', 'T4AOAS', 'T4E', 'T5008', 'T5007', 'NOA'] as SlipType[]).map((t) => (
                <button key={t} type="button" className="btn btn-secondary btn-sm" onClick={() => addManual(t)}>{SLIP_LABEL[t]}</button>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setAdding(true)}><Plus size={18} /> Type a slip in</button>
              <button type="button" className="linkish" onClick={downloadTemplate}>Download the CSV template</button>
            </>
          )}
        </div>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => go('you')}><Back size={18} /> Back</button>
        <span className="spacer" />
        <button type="button" className="btn btn-primary" disabled={!state.slips.length || working} onClick={() => go('review')}>
          Check the numbers <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}
