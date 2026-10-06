// Lou's key server logic. It does three things and nothing else:
//   POST /api/claim    {session_id}  after Stripe Checkout: confirms the payment with Stripe and returns the key.
//   POST /api/webhook                Stripe tells us a payment completed: emails the key (the backup path if /claim never ran).
//   POST /api/recover  {email}       "Find my key": emails the key for any paid checkout under that email. Always answers the same.
// It never sees tax data (the app does not talk to it). No database: Stripe is the record, keys are deterministic.
// Logs: method, path and status only. No emails, keys or bodies.
import { mintKey } from './license.mjs';
import { rateLimiter } from './limits.mjs';
import { verifyWebhook, yearsForSession } from './stripe.mjs';

export function createHandler({ stripe, mail, privateKeyPem, kid, priceYears, webhookSecret, siteUrl, allow = rateLimiter(), log = console.log }) {
  const keyFor = (session, years) => mintKey({ privateKeyPem, kid, years, sessionId: session.id, paidAt: session.created });

  async function readBody(req, limit = 64 * 1024) {
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
    return Buffer.concat(chunks).toString('utf8');
  }
  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const clientIp = (req) => (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').toString().split(',')[0].trim();

  /** Emails the key for a paid session. Returns false when there is nothing to send. */
  async function emailKeyForSession(sessionId) {
    const session = await stripe.session(sessionId);
    const years = yearsForSession(session, priceYears);
    const to = session.customer_details?.email ?? session.customer_email;
    if (!years || !to) return false;
    await mail.sendKey(to, keyFor(session, years), years, siteUrl);
    return true;
  }

  const routes = {
    'POST /api/claim': async (req, res) => {
      if (!allow(`claim:${clientIp(req)}`, 30, 3600_000)) return json(res, 429, { error: 'slow_down' });
      const { session_id: id } = JSON.parse((await readBody(req)) || '{}');
      if (typeof id !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return json(res, 400, { error: 'bad_session' });
      let session;
      try { session = await stripe.session(id); } catch (e) { return json(res, e.status === 404 ? 404 : 502, { error: 'lookup_failed' }); }
      const years = yearsForSession(session, priceYears);
      if (!years) return json(res, 402, { error: 'not_paid' });
      json(res, 200, { key: keyFor(session, years), years });
    },

    'POST /api/webhook': async (req, res) => {
      const raw = await readBody(req);
      if (!verifyWebhook(raw, req.headers['stripe-signature'], webhookSecret)) return json(res, 400, { error: 'bad_signature' });
      const event = JSON.parse(raw);
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        try { await emailKeyForSession(event.data.object.id); } catch { return json(res, 500, { error: 'try_again' }); } // Stripe retries
      }
      json(res, 200, { received: true });
    },

    'POST /api/recover': async (req, res) => {
      const { email } = JSON.parse((await readBody(req)) || '{}');
      const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(addr)) return json(res, 400, { error: 'bad_email' });
      if (!allow(`recover-ip:${clientIp(req)}`, 5, 3600_000) || !allow(`recover-email:${addr}`, 3, 3600_000)) return json(res, 429, { error: 'slow_down' });
      const work = (async () => { for (const id of await stripe.paidSessionsFor(addr)) await emailKeyForSession(id); })().catch(() => { /* nothing to tell the visitor */ });
      json(res, 200, { ok: true }); // the same answer whether or not a payment exists
      await work;
    },

    'GET /api/health': (_req, res) => json(res, 200, { ok: true }),
  };

  return async (req, res) => {
    const route = routes[`${req.method} ${new URL(req.url, 'http://x').pathname}`];
    try {
      if (!route) json(res, 404, { error: 'not_found' }); else await route(req, res);
    } catch (e) {
      if (!res.headersSent) json(res, e.status === 413 ? 413 : e instanceof SyntaxError ? 400 : 500, { error: 'error' });
    }
    log(`${req.method} ${req.url.split('?')[0]} ${res.statusCode}`);
  };
}
