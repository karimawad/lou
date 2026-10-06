// Lou keys. A key is "LOU1.<payload>.<signature>" (base64url). The payload says which tax years it unlocks;
// the signature is Ed25519 over the text "LOU1.<payload>". The app carries the public key and checks keys offline.
// Minting is deterministic: the same Stripe payment always gives the same key, so no database is needed.
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';

export const KEY_PREFIX = 'LOU1';
const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** What the payload holds. k = key id (for rotation), y = tax years unlocked, s = short hash of the payment, t = when it was paid. */
export function keyPayload({ kid, years, sessionId, paidAt }) {
  const s = b64u(createHash('sha256').update(sessionId).digest()).slice(0, 12);
  return { k: kid, y: [...years].sort((a, b) => a - b), s, t: paidAt };
}

export function mintKey({ privateKeyPem, kid, years, sessionId, paidAt }) {
  if (!years?.length) throw new Error('A key needs at least one tax year.');
  const body = `${KEY_PREFIX}.${b64u(JSON.stringify(keyPayload({ kid, years, sessionId, paidAt })))}`;
  const sig = sign(null, Buffer.from(body), createPrivateKey(privateKeyPem));
  return `${body}.${b64u(sig)}`;
}

/** A new Ed25519 pair: the private key as PEM (keep secret), the public key as base64url raw bytes (goes in the app). */
export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return { privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }), publicKeyB64u: b64u(der.subarray(der.length - 32)) };
}
