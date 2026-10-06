// Makes a key by hand (a friend, a reviewer, a test). Usage:
//   node mint-cli.mjs <private-key-file> --years 2023,2024,2025 [--kid k1]
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mintKey } from './license.mjs';

const [file, ...rest] = process.argv.slice(2);
const arg = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
if (!file) { console.error('Usage: node mint-cli.mjs <private-key-file> --years 2023,2024,2025 [--kid k1]'); process.exit(1); }
const years = arg('years', '2023,2024,2025').split(',').map(Number);
console.log(mintKey({
  privateKeyPem: readFileSync(file, 'utf8'), kid: arg('kid', 'k1'), years,
  sessionId: `manual-${randomBytes(8).toString('hex')}`, paidAt: Math.floor(Date.now() / 1000),
}));
