// Lou keys, checked on this device. A key is "LOU1.<payload>.<signature>" (base64url); the signature is Ed25519 over
// the text "LOU1.<payload>", made by Lou's key server (server/license.mjs) after a Stripe payment. The public keys below
// are all this code needs: no network call, so a paid key keeps working offline, forever.
import { verifyAsync } from '@noble/ed25519';

/** Public signing keys by key id (raw 32 bytes, base64url). To rotate: add a new id here and sign new keys with it; old keys keep working. */
export const PUBLIC_KEYS: Record<string, string> = {
  k1: 'jOTElDRBpUhIwvt6W53vrImEPguibXHGDnZa1MxEm_c',
};

export interface LicensePayload {
  /** Key id. */ k: string;
  /** Tax years the key unlocks. */ y: number[];
  /** Short hash of the payment (not the Stripe id). */ s: string;
  /** When it was paid, seconds since 1970. */ t: number;
}

export type KeyProblem = 'empty' | 'format' | 'unknown-key' | 'signature';

const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Pasted keys arrive with spaces, line breaks, quotes or a trailing link: keep only the key itself. */
export function cleanKey(input: string): string {
  const m = input.replace(/\s+/g, '').match(/LOU1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return m ? m[0] : input.replace(/\s+/g, '');
}

export async function checkKey(input: string, publicKeys: Record<string, string> = PUBLIC_KEYS): Promise<{ ok: true; payload: LicensePayload } | { ok: false; problem: KeyProblem }> {
  const key = cleanKey(input);
  if (!key) return { ok: false, problem: 'empty' };
  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== 'LOU1') return { ok: false, problem: 'format' };
  let payload: LicensePayload;
  let sig: Uint8Array;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64u(parts[1])));
    sig = fromB64u(parts[2]);
  } catch { return { ok: false, problem: 'format' }; }
  if (!payload || !Array.isArray(payload.y) || !payload.y.every(Number.isInteger) || typeof payload.k !== 'string') return { ok: false, problem: 'format' };
  const pub = publicKeys[payload.k];
  if (!pub) return { ok: false, problem: 'unknown-key' };
  try {
    const good = await verifyAsync(sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`), fromB64u(pub));
    return good ? { ok: true, payload } : { ok: false, problem: 'signature' };
  } catch { return { ok: false, problem: 'signature' }; }
}

export function problemText(p: KeyProblem): string {
  switch (p) {
    case 'empty': return 'Paste your key first.';
    case 'unknown-key': return 'This key was made by a newer version of Lou. Reload Lou to update, then try again.';
    default: return "That key isn't valid. Copy the whole key from your email (it starts with LOU1) and try again.";
  }
}

/** Every tax year the keys cover (keys that fail the check cover nothing). */
export async function yearsCovered(keys: string[], publicKeys: Record<string, string> = PUBLIC_KEYS): Promise<number[]> {
  const years = new Set<number>();
  for (const k of keys) {
    const r = await checkKey(k, publicKeys);
    if (r.ok) r.payload.y.forEach((y) => years.add(y));
  }
  return [...years].sort((a, b) => a - b);
}

export const yearsLabel = (ys: number[]) => (ys.length > 1 ? `${ys[0]} to ${ys[ys.length - 1]}` : String(ys[0]));
