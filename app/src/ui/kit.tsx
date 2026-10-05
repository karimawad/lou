// Shared form and feedback components. Standard controls, consistent states.

import { useEffect, useId, useState, type ReactNode, type InputHTMLAttributes } from 'react';
import { parseAmount } from '../extract/amount';
import { Alert, Info, Stop, Check } from './icons';

export function Field({ label, hint, error, children, htmlFor }: {
  label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="error-text" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ label, hint, error, value, onChange, ...rest }: {
  label: ReactNode; hint?: ReactNode; error?: string; value: string; onChange: (v: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className="input" value={value} aria-invalid={!!error || undefined}
        onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export interface ChoiceOption<T extends string> { value: T; title: ReactNode; desc?: ReactNode }

export function Choices<T extends string>({ legend, hint, value, onChange, options, row, name }: {
  legend: ReactNode; hint?: ReactNode; value: T | null | undefined; onChange: (v: T) => void;
  options: ChoiceOption<T>[]; row?: boolean; name?: string;
}) {
  const auto = useId();
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--s-2)' }}>
      <legend className="label" style={{ marginBottom: 'var(--s-2)', padding: 0 }}>{legend}</legend>
      {hint && <p className="hint" style={{ marginTop: '-4px' }}>{hint}</p>}
      <div className={`choices${row ? ' row' : ''}`}>
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name={name ?? auto} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="choice-title">{o.title}</span>
            {o.desc && <span className="choice-desc">{o.desc}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function YesNo({ legend, hint, value, onChange, yes = 'Yes', no = 'No' }: {
  legend: ReactNode; hint?: ReactNode; value: boolean | null | undefined; onChange: (v: boolean) => void; yes?: ReactNode; no?: ReactNode;
}) {
  return (
    <Choices legend={legend} hint={hint} row value={value === null || value === undefined ? null : value ? 'y' : 'n'}
      onChange={(v) => onChange(v === 'y')} options={[{ value: 'y', title: yes }, { value: 'n', title: no }]} />
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'block' | 'ok'; title?: ReactNode; children?: ReactNode }) {
  const Icon = tone === 'warn' ? Alert : tone === 'block' ? Stop : tone === 'ok' ? Check : Info;
  return (
    <div className={`callout ${tone}`} role={tone === 'block' ? 'alert' : undefined}>
      <Icon />
      <div>{title && <strong>{title}</strong>}{children && <div className="callout-body">{children}</div>}</div>
    </div>
  );
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'code', minimumFractionDigits: 2 });
export const fmtUsd = (n: number) => usd.format(n);
export const fmtCad = (n: number) => cad.format(n).replace('CAD', '').trim() + ' CAD';

/** Money input (CAD) that formats on blur, not while typing. Accepts "100,000.00" or "100 000,00". */
export function MoneyField({ label, value, onChange, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const id = useId();
  const fmt = (v: number) => (v ? v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  const bad = text.trim() !== '' && parseAmount(text) === null;
  return (
    <Field label={label} hint={hint} error={bad ? 'Enter an amount like 12,500.00' : undefined} htmlFor={id}>
      <input id={id} className="input num" inputMode="decimal" value={text} placeholder="0.00" aria-invalid={bad || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (!bad) onChange(parseAmount(text) ?? 0); }} />
    </Field>
  );
}
