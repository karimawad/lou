// Lou's key server logic. It does four things and nothing else:
//   POST /api/claim    {session_id}  after Stripe Checkout: confirms the payment with Stripe and returns the key.
//   POST /api/webhook                Stripe tells us a payment completed: emails the key (the backup path if /claim never ran).
//   POST /api/recover  {email}       "Find my key": emails the key for any paid checkout under that email. Always answers the same.
//   POST /api/support  {email, subject, message}   the "Report a problem" form: emails the support inbox (nothing is stored).
// It never sees tax data (the app does not talk to it). No database: Stripe is the record, keys are deterministic.
// Logs: method, path and status only. No emails, keys or bodies.
import { mintKey } from './license.mjs';
import { rateLimiter } from './limits.mjs';
import { verifyWebhook, yearsForSession } from './stripe.mjs';

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function createHandler({ stripe, mail, privateKeyPem, kid, priceYears, webhookSecret, siteUrl, supportTo = 'karim@bigtimedesign.ca', allow = rateLimiter(), log = console.log }) {
  const keyFor = (session, years) => mintKey({ privateKeyPem, kid, years, sessionId: session.id, paidAt: session.created });

  async function readBody(req, limit = 64 * 1024) {
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
    return Buffer.concat(chunks).toString('utf8');
  }
  const json = (res, status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res.end(JSON.stringify(body));
  };
  // Behind the web server proxy: the LAST X-Forwarded-For entry is the one the proxy added. The first entries can be written by the
  // visitor, so using them would let anyone dodge the rate limits just by sending a made-up header.
  const clientIp = (req) => ((req.headers['x-forwarded-for'] ?? '').toString().split(',').pop().trim() || req.socket.remoteAddress || 'unknown');
  // A cross-site HTML form can only send simple content types. Requiring JSON means a browser must ask permission first (and gets none).
  const isJson = (req) => /^application\/json\b/i.test(req.headers['content-type'] ?? '');
  const jsonBody = async (req) => {
    const parsed = JSON.parse((await readBody(req)) || '{}');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  };

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
      if (!isJson(req)) return json(res, 415, { error: 'json_only' });
      if (!allow(`claim:${clientIp(req)}`, 30, 3600_000)) return json(res, 429, { error: 'slow_down' });
      const id = (await jsonBody(req)).session_id;
      if (typeof id !== 'string' || !SESSION_ID.test(id)) return json(res, 400, { error: 'bad_session' });
      let session;
      try { session = await stripe.session(id); } catch (e) { return json(res, e.status === 404 ? 404 : 502, { error: 'lookup_failed' }); }
      const years = yearsForSession(session, priceYears);
      if (!years) return json(res, 402, { error: 'not_paid' });
      json(res, 200, { key: keyFor(session, years), years });
    },

    'POST /api/webhook': async (req, res) => {
      const raw = await readBody(req, 512 * 1024);
      if (!verifyWebhook(raw, req.headers['stripe-signature'], webhookSecret)) return json(res, 400, { error: 'bad_signature' });
      const event = JSON.parse(raw);
      const id = event?.data?.object?.id;
      if ((event?.type === 'checkout.session.completed' || event?.type === 'checkout.session.async_payment_succeeded') && typeof id === 'string' && SESSION_ID.test(id)) {
        try { await emailKeyForSession(id); } catch { return json(res, 500, { error: 'try_again' }); } // Stripe retries
      }
      json(res, 200, { received: true });
    },

    'POST /api/recover': async (req, res) => {
      if (!isJson(req)) return json(res, 415, { error: 'json_only' });
      const { email } = await jsonBody(req);
      const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (addr.length > 254 || !EMAIL.test(addr)) return json(res, 400, { error: 'bad_email' });
      if (!allow(`recover-ip:${clientIp(req)}`, 5, 3600_000) || !allow(`recover-email:${addr}`, 3, 3600_000)) return json(res, 429, { error: 'slow_down' });
      const work = (async () => { for (const id of await stripe.paidSessionsFor(addr)) await emailKeyForSession(id); })().catch(() => { /* nothing to tell the visitor */ });
      json(res, 200, { ok: true }); // the same answer whether or not a payment exists
      await work;
    },

    'POST /api/support': async (req, res) => {
      if (!isJson(req)) return json(res, 415, { error: 'json_only' });
      const b = await jsonBody(req);
      if (b.website) return json(res, 200, { ok: true }); // honeypot field: a person never sees it, a form-filling bot does
      const text = (v) => (typeof v === 'string' ? v : '');
      const email = text(b.email).trim().toLowerCase();
      const subject = text(b.subject).replace(/[\r\n]+/g, ' ').trim();
      const message = text(b.message).replace(/\r\n/g, '\n').trim();
      const errors = {};
      if (email.length > 254 || !EMAIL.test(email)) errors.email = 'Enter a full email address.';
      if (subject.length < 3 || subject.length > 120) errors.subject = 'Give it a short subject (3 to 120 characters).';
      if (message.length < 10 || message.length > 4000) errors.message = 'Describe the problem (10 to 4000 characters).';
      if (Object.keys(errors).length) return json(res, 400, { error: 'invalid', errors });
      if (Number(b.ms) < 1500) return json(res, 200, { ok: true }); // filled in faster than a person can: drop it quietly
      if (!allow(`support-ip:${clientIp(req)}`, 5, 3600_000) || !allow(`support-email:${email}`, 3, 24 * 3600_000)) return json(res, 429, { error: 'slow_down' });
      try {
        const body = `From: ${email}\n\n${message}\n\n--\nSent from the Lou "Report a problem" form.`;
        await mail.sendSupport({ to: supportTo, replyTo: email, subject: `[Lou] ${subject}`, text: body });
      } catch { return json(res, 502, { error: 'send_failed' }); }
      json(res, 200, { ok: true });
    },

    'GET /api/health': (_req, res) => json(res, 200, { ok: true }),
    'HEAD /api/health': (_req, res) => { res.writeHead(200, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(); }, // for uptime monitors
  };

  return async (req, res) => {
    try {
      const route = Object.hasOwn(routes, `${req.method} ${new URL(req.url, 'http://x').pathname}`) && routes[`${req.method} ${new URL(req.url, 'http://x').pathname}`];
      if (!route) json(res, 404, { error: 'not_found' }); else await route(req, res);
    } catch (e) {
      if (!res.headersSent) json(res, e?.status === 413 ? 413 : e instanceof SyntaxError || e instanceof TypeError ? 400 : 500, { error: 'error' });
    }
    log(`${req.method} ${String(req.url).split('?')[0].slice(0, 100)} ${res.statusCode}`);
  };
}
