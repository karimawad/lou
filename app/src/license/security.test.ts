import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHandler } from '../../../server/app.mjs';
import { generateKeyPair } from '../../../server/license.mjs';

// Attack tests against the key server's real request handler (pretend Stripe and mailbox, nothing leaves this machine).
// These are the pen-test cases kept as regression tests: if a change reopens one of these holes, the suite fails.
const pair = generateKeyPair();
const SECRET = 'whsec_pentest';
const PAID = 'cs_live_PaidSessionAbc123456789';
const sent: { to: string }[] = [];
const support: { replyTo: string; subject: string }[] = [];
const stripe = {
  session: async (id: string) => {
    if (id !== PAID) throw Object.assign(new Error('nope'), { status: 404 });
    return { id: PAID, created: 1760000000, payment_status: 'paid', customer_details: { email: 'buyer@example.com' }, line_items: { data: [{ price: { id: 'price_lou' } }] } };
  },
  paidSessionsFor: async (email: string) => (email === 'buyer@example.com' ? [PAID] : []),
};
const mail = {
  sendKey: async (to: string) => { sent.push({ to }); },
  sendSupport: async (m: { replyTo: string; subject: string }) => { support.push(m); },
};

let server: Server;
let base = '';
const mk = () => createHandler({ stripe, mail, privateKeyPem: pair.privateKeyPem, kid: 'k1', priceYears: { price_lou: [2023, 2024, 2025] }, webhookSecret: SECRET, siteUrl: 'https://lou.example', log: () => {} });
beforeAll(async () => {
  server = createServer(mk());
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });

const send = (method: string, path: string, body?: string, headers: Record<string, string> = {}) =>
  fetch(base + path, { method, body, headers: { 'Content-Type': 'application/json', ...headers } });
const goodSupport = { email: 'person@example.com', subject: 'A real problem', message: 'This is a real problem description.', website: '', ms: 9000 };

describe('rate limits cannot be dodged', () => {
  it('a made-up X-Forwarded-For does not give a fresh allowance (only the proxy-added last hop counts)', async () => {
    // fresh server so no earlier traffic counts against this address
    const s = createServer(mk());
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/recover`;
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.9.8.${i}, 203.0.113.50` }, body: JSON.stringify({ email: `person${i}@example.com` }) });
      codes.push(res.status);
    }
    s.close();
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });
});

describe('cross-site and content-type attacks', () => {
  it('rejects non-JSON posts (what a cross-site HTML form can send) without doing anything', async () => {
    sent.length = 0; support.length = 0;
    for (const path of ['/api/claim', '/api/recover', '/api/support']) {
      const res = await send('POST', path, JSON.stringify({ ...goodSupport, session_id: PAID }), { 'Content-Type': 'text/plain' });
      expect(res.status).toBe(415);
      const form = await send('POST', path, 'email=a%40b.com', { 'Content-Type': 'application/x-www-form-urlencoded' });
      expect(form.status).toBe(415);
    }
    expect(sent).toHaveLength(0);
    expect(support).toHaveLength(0);
  });

  it('sends no permissive CORS headers and locks down the response', async () => {
    const res = await send('GET', '/api/health');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    const preflight = await fetch(`${base}/api/support`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    expect(preflight.status).toBe(404);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('injection and malformed input', () => {
  it('refuses emails carrying header injection or odd characters', async () => {
    support.length = 0;
    for (const email of ['a@b.com\r\nBcc: victim@example.com', 'a@b.com,c@d.com', '"x y"@b.com', 'a@b.com>\nX: y', '<script>@b.com', 'müller@exämple.com', 'a@b', ' @b.com', 'a'.repeat(300) + '@b.com']) {
      const res = await send('POST', '/api/support', JSON.stringify({ ...goodSupport, email }));
      expect(res.status, email).toBe(400);
    }
    expect(support).toHaveLength(0);
  });

  it('strips line breaks from the subject so it cannot add mail headers', async () => {
    support.length = 0;
    await send('POST', '/api/support', JSON.stringify({ ...goodSupport, email: 'inj@example.com', subject: 'Hi\r\nBcc: victim@example.com\nX-Evil: 1' }));
    expect(support[0].subject).not.toMatch(/[\r\n]/);
  });

  it('is not vulnerable to prototype pollution through JSON bodies', async () => {
    await send('POST', '/api/support', '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"email":"p@example.com","subject":"Proto test","message":"Trying prototype pollution here."}');
    await send('POST', '/api/claim', '{"__proto__":{"polluted":"yes"},"session_id":"cs_test_aaaaaaaaaaaa"}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects session ids that are not a Stripe checkout id', async () => {
    for (const id of ['../../etc/passwd', "cs_test_'; drop table", 'cs_test_' + 'a'.repeat(500), 'cs_test_', '', 'cs_prod_aaaaaaaaaaaaaaaa', 12345, null, { a: 1 }, ['cs_test_aaaaaaaaaaaa']]) {
      const res = await send('POST', '/api/claim', JSON.stringify({ session_id: id }));
      expect(res.status, JSON.stringify(id).slice(0, 40)).toBe(400);
    }
  });

  it('never returns a key for an unknown or unpaid session and reveals no internals in errors', async () => {
    const res = await send('POST', '/api/claim', JSON.stringify({ session_id: 'cs_live_NoSuchSessionXYZ12345' }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('{"error":"lookup_failed"}');
  });

  it('survives garbage bodies of every shape without a server error (fuzz)', async () => {
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const junk = (): unknown => {
      const kinds = [() => null, () => rnd(1e9), () => 'x'.repeat(rnd(5000)), () => [junk(), junk()], () => ({ email: junk(), subject: junk(), message: junk(), session_id: junk(), website: junk(), ms: junk() }),
        () => ({ __proto__: junk() }), () => true, () => -1, () => '\u0000‮\ud800', () => ({ email: 'a@b.com'.repeat(rnd(50)) })];
      return kinds[rnd(kinds.length)]();
    };
    const raw = ['', '{', '[]', 'null', '"str"', '1', '{"a":', '\u0000', '{"email":{"toString":1}}'];
    const statuses = new Set<number>();
    for (let i = 0; i < 150; i++) {
      const path = ['/api/claim', '/api/recover', '/api/support', '/api/webhook'][i % 4];
      const body = i < raw.length ? raw[i] : JSON.stringify(junk());
      const res = await send('POST', path, body);
      statuses.add(res.status);
      expect([200, 400, 402, 404, 413, 415, 429], `${path} ${body.slice(0, 60)}`).toContain(res.status);
    }
    expect((await send('GET', '/api/health')).status).toBe(200); // still alive
  });

  it('cuts off oversized bodies', async () => {
    expect((await send('POST', '/api/support', 'x'.repeat(70 * 1024))).status).toBe(413);
    expect((await send('POST', '/api/webhook', 'x'.repeat(600 * 1024))).status).toBe(413);
  });

  it('answers odd methods and paths with 404, not a crash', async () => {
    for (const [m, p] of [['GET', '/api/claim'], ['DELETE', '/api/support'], ['PUT', '/api/health'], ['GET', '/api/../etc/passwd'], ['GET', '/api/constructor'], ['POST', '/api/__proto__'], ['GET', '//'], ['GET', '/api/health/../claim'], ['TRACE', '/']] as const) {
      const res = await fetch(base + p, { method: m === 'TRACE' ? 'OPTIONS' : m });
      expect([200, 404, 405, 400], `${m} ${p}`).toContain(res.status);
      if (p !== '/api/health') expect(res.status, `${m} ${p}`).not.toBe(200);
    }
  });
});

describe('the Stripe webhook', () => {
  const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: PAID } } });
  const signed = (b: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) => ({ 'Stripe-Signature': `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${b}`).digest('hex')}` });

  it('rejects forged, unsigned, tampered, wrong-secret and stale webhooks and sends nothing', async () => {
    sent.length = 0;
    expect((await send('POST', '/api/webhook', body)).status).toBe(400);
    expect((await send('POST', '/api/webhook', body, { 'Stripe-Signature': 't=1,v1=00' })).status).toBe(400);
    expect((await send('POST', '/api/webhook', body + ' ', signed(body))).status).toBe(400);
    expect((await send('POST', '/api/webhook', body, signed(body, 'whsec_attacker'))).status).toBe(400);
    expect((await send('POST', '/api/webhook', body, signed(body, SECRET, Math.floor(Date.now() / 1000) - 3600))).status).toBe(400);
    expect((await send('POST', '/api/webhook', body, { 'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('ignores a validly signed event with a malformed payload instead of failing', async () => {
    for (const b of ['{}', '{"type":"checkout.session.completed"}', '{"type":"checkout.session.completed","data":{"object":{"id":{"a":1}}}}', '{"type":"checkout.session.completed","data":{"object":{"id":"../../x"}}}']) {
      const res = await send('POST', '/api/webhook', b, signed(b));
      expect(res.status).toBe(200);
    }
  });
});

describe('privacy of "Find my key"', () => {
  it('gives an identical answer for a buyer, a stranger and a malformed-but-plausible address', async () => {
    const a = await send('POST', '/api/recover', JSON.stringify({ email: 'buyer@example.com' }), { 'X-Forwarded-For': '198.51.100.1' });
    const b = await send('POST', '/api/recover', JSON.stringify({ email: 'nobody@example.com' }), { 'X-Forwarded-For': '198.51.100.2' });
    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
  });
});
