// One-time: makes the signing key pair. Usage:  node keygen.mjs <private-key-file>
// Writes the private key there (readable only by you) and prints the public key line for the app.
import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import { generateKeyPair } from './license.mjs';

const out = process.argv[2];
if (!out) { console.error('Usage: node keygen.mjs <private-key-file>'); process.exit(1); }
if (existsSync(out)) { console.error(`${out} already exists. Refusing to overwrite a signing key.`); process.exit(1); }
const { privateKeyPem, publicKeyB64u } = generateKeyPair();
writeFileSync(out, privateKeyPem, { mode: 0o600 });
try { chmodSync(out, 0o600); } catch { /* Windows has no file modes */ }
console.log(`Private key written to ${out}. Keep it secret and back it up.`);
console.log(`Public key (goes in app/src/license/publicKeys.ts): ${publicKeyB64u}`);
