import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
// The server modules are plain JavaScript; the tests run the real minting code against the app's real checking code.
import { generateKeyPair, mintKey } from '../../../server/license.mjs';
import { rateLimiter } from '../../../server/limits.mjs';
import { verifyWebhook, yearsForSession } from '../../../server/stripe.mjs';
import { checkKey, cleanKey, yearsCovered } from './key';

const pair = generateKeyPair();
const other = generateKeyPair();
const pub = { k1: pair.publicKeyB64u };
const mint = (over: Record<string, unknown> = {}) => mintKey({ privateKeyPem: pair.privateKeyPem, kid: 'k1', years: [2023, 2024, 2025], sessionId: 'cs_test_abc123', paidAt: 1760000000, ...over }) as string;

describe('license keys', () => {
  it('a key minted by the server checks out in the app', async () => {
    const r = await checkKey(mint(), pub);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.y).toEqual([2023, 2024, 2025]);
  });

  it('the same payment always gives the same key (no database needed)', () => {
    expect(mint()).toBe(mint());
    expect(mint({ sessionId: 'cs_test_other' })).not.toBe(mint());
  });

  it('does not put the Stripe session id in the key', () => {
    expect(Buffer.from(mint().split('.')[1], 'base64url').toString()).not.toContain('cs_test_abc123');
  });

  it('rejects a key signed by a different private key', async () => {
    const r = await checkKey(mint({ privateKeyPem: other.privateKeyPem }), pub);
    expect(r).toEqual({ ok: false, problem: 'signature' });
  });

  it('rejects a key whose years were edited', async () => {
    const [p, body, sig] = mint().split('.');
    const edited = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), y: [2023, 2024, 2025, 2026] })).toString('base64url');
    expect(await checkKey(`${p}.${edited}.${sig}`, pub)).toEqual({ ok: false, problem: 'signature' });
  });

  it('rejects a key id the app does not know, and nonsense', async () => {
    expect(await checkKey(mint({ kid: 'k9' }), pub)).toEqual({ ok: false, problem: 'unknown-key' });
    expect(await checkKey('hello', pub)).toEqual({ ok: false, problem: 'format' });
    expect(await checkKey('', pub)).toEqual({ ok: false, problem: 'empty' });
    expect(await checkKey('LOU1.%%%.%%%', pub)).toEqual({ ok: false, problem: 'format' });
  });

  it('accepts a key pasted with spaces, line breaks, quotes or a link around it', async () => {
    const k = mint();
    expect(cleanKey(`  "${k.slice(0, 40)}\n${k.slice(40)}"  `)).toBe(k);
    expect((await checkKey(`https://lou.bigtimedesign.ca/app/#key=${k}`, pub)).ok).toBe(true);
  });

  it('works out which tax years several keys cover, ignoring bad ones', async () => {
    const a = mint({ years: [2023, 2024, 2025] });
    const b = mint({ years: [2026], sessionId: 'cs_test_next' });
    expect(await yearsCovered([a, 'junk', b], pub)).toEqual([2023, 2024, 2025, 2026]);
    expect(await yearsCovered(['junk'], pub)).toEqual([]);
  });
});

describe('server helpers', () => {
  it('verifies Stripe webhook signatures, rejecting tampering and stale timestamps', () => {
    const secret = 'whsec_test';
    const body = '{"id":"evt_1"}';
    const t = 1760000000;
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    const now = t * 1000;
    expect(verifyWebhook(body, `t=${t},v1=${v1}`, secret, { now })).toBe(true);
    expect(verifyWebhook(body + ' ', `t=${t},v1=${v1}`, secret, { now })).toBe(false);
    expect(verifyWebhook(body, `t=${t},v1=${v1}`, 'whsec_other', { now })).toBe(false);
    expect(verifyWebhook(body, `t=${t},v1=${v1}`, secret, { now: now + 10 * 60 * 1000 })).toBe(false);
    expect(verifyWebhook(body, `t=${t},v1=deadbeef,v1=${v1}`, secret, { now })).toBe(true); // secret rotation
    expect(verifyWebhook(body, undefined, secret, { now })).toBe(false);
  });

  it('only unlocks years for a paid session on a known price', () => {
    const prices = { price_a: [2023, 2024, 2025] };
    const session = (status: string, price: string) => ({ payment_status: status, line_items: { data: [{ price: { id: price } }] } });
    expect(yearsForSession(session('paid', 'price_a'), prices)).toEqual([2023, 2024, 2025]);
    expect(yearsForSession(session('unpaid', 'price_a'), prices)).toBeNull();
    expect(yearsForSession(session('paid', 'price_unknown'), prices)).toBeNull();
  });

  it('rate limits per bucket and forgets after the window', () => {
    const allow = rateLimiter();
    expect([1, 2, 3].map(() => allow('x', 2, 1000, 0))).toEqual([true, true, false]);
    expect(allow('y', 2, 1000, 0)).toBe(true);
    expect(allow('x', 2, 1000, 1500)).toBe(true);
  });
});
