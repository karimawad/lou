import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHandler } from '../../../server/app.mjs';
import { generateKeyPair } from '../../../server/license.mjs';
import { checkKey } from './key';

// The whole payment flow against a pretend Stripe and a pretend mailbox: nothing leaves this machine.
const pair = generateKeyPair();
const SECRET = 'whsec_test';
const SESSION_ID = 'cs_test_a1B2c3D4e5F6g7H8';
const sessions: Record<string, unknown> = {
  [SESSION_ID]: { id: SESSION_ID, created: 1760000000, payment_status: 'paid', customer_details: { email: 'Buyer@Example.com' }, line_items: { data: [{ price: { id: 'price_lou' } }] } },
  cs_test_unpaid0000000: { id: 'cs_test_unpaid0000000', created: 1760000000, payment_status: 'unpaid', customer_details: { email: 'x@example.com' }, line_items: { data: [{ price: { id: 'price_lou' } }] } },
};
const sent: { to: string; key: string; years: number[] }[] = [];
const stripe = {
  session: async (id: string) => { const s = sessions[id]; if (!s) throw Object.assign(new Error('nope'), { status: 404 }); return s; },
  paidSessionsFor: async (email: string) => (email.toLowerCase() === 'buyer@example.com' ? [SESSION_ID] : []),
};
const mail = { sendKey: async (to: string, key: string, years: number[]) => { sent.push({ to, key, years }); } };

let server: Server;
let base = '';
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeAll(async () => {
  const handler = createHandler({ stripe, mail, privateKeyPem: pair.privateKeyPem, kid: 'k1', priceYears: { price_lou: [2023, 2024, 2025] }, webhookSecret: SECRET, siteUrl: 'https://lou.example', log: () => {} });
  server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });

const signed = (body: string, t = Math.floor(Date.now() / 1000)) => ({ 'Stripe-Signature': `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')}` });

describe('key server', () => {
  it('gives a key for a paid checkout, and the app accepts it', async () => {
    const res = await post('/api/claim', { session_id: SESSION_ID });
    expect(res.status).toBe(200);
    const { key, years } = (await res.json()) as { key: string; years: number[] };
    expect(years).toEqual([2023, 2024, 2025]);
    expect((await checkKey(key, { k1: pair.publicKeyB64u })).ok).toBe(true);
    // claiming again gives the very same key
    expect(((await (await post('/api/claim', { session_id: SESSION_ID })).json()) as { key: string }).key).toBe(key);
  });

  it('refuses unpaid, unknown and malformed sessions', async () => {
    expect((await post('/api/claim', { session_id: 'cs_test_unpaid0000000' })).status).toBe(402);
    expect((await post('/api/claim', { session_id: 'cs_test_doesnotexist1' })).status).toBe(404);
    expect((await post('/api/claim', { session_id: 'drop table' })).status).toBe(400);
    expect((await post('/api/claim', '{not json')).status).toBe(400);
  });

  it('emails the key when Stripe reports a completed payment, and rejects forged webhooks', async () => {
    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: SESSION_ID } } });
    sent.length = 0;
    expect((await post('/api/webhook', body)).status).toBe(400);
    expect((await post('/api/webhook', body, signed(body, 1000))).status).toBe(400); // stale
    expect(sent).toHaveLength(0);
    expect((await post('/api/webhook', body, signed(body))).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('Buyer@Example.com');
    expect((await checkKey(sent[0].key, { k1: pair.publicKeyB64u })).ok).toBe(true);
  });

  it('find-my-key answers the same for a buyer and a stranger, and only emails the buyer', async () => {
    sent.length = 0;
    const a = await post('/api/recover', { email: ' buyer@example.com ' });
    const b = await post('/api/recover', { email: 'stranger@example.com' });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await a.text()).toBe(await b.text());
    await new Promise((r) => setTimeout(r, 50));
    expect(sent.map((s) => s.to)).toEqual(['Buyer@Example.com']);
    expect((await post('/api/recover', { email: 'not an email' })).status).toBe(400);
  });

  it('slows down repeated find-my-key requests', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await post('/api/recover', { email: 'spam@example.com' })).status);
    expect(codes).toContain(429);
  });
});
