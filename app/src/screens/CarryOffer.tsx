// "You listed these in 2024. Add them to 2025?" for things that rarely change from year to year.

import { useApp } from '../state/context';
import { Callout } from '../ui/kit';

export function CarryOffer({ section, from, names, what, note, onAdd }: {
  /** Key for remembering a "No thanks" for this section in this year. */
  section: string;
  from: number;
  names: string[];
  /** Singular and plural noun: ['account', 'accounts']. */
  what: [string, string];
  /** What starts empty, e.g. "Balances start empty for you to fill in." */
  note?: string;
  onAdd: () => void;
}) {
  const { state, update } = useApp();
  if (!names.length || (state.carryDismissed ?? []).includes(section)) return null;
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
  return (
    <Callout tone="info" title={`Bring in your ${what[1]} from ${from}?`}>
      <p>{names.length === 1 ? `One ${what[0]}` : `${names.length} ${what[1]}`} from your {from} return {names.length === 1 ? "isn't" : "aren't"} here yet: {list}. {note}</p>
      <div style={{ display: 'flex', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>Add {names.length === 1 ? 'it' : 'them'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => update((s) => ({ ...s, carryDismissed: [...(s.carryDismissed ?? []), section] }))}>No thanks</button>
      </div>
    </Callout>
  );
}

/** Shown on an item copied from another year until this year's figures are in. */
export function CarriedNote({ from, year, what, onConfirm }: { from: number; year: number; what: string; onConfirm: () => void }) {
  return (
    <Callout tone="warn" title={`Copied from ${from}: add the ${year} figures`}>
      <p>{what}</p>
      <div><button type="button" className="btn btn-secondary btn-sm" onClick={onConfirm}>The {year} figures are in</button></div>
    </Callout>
  );
}
