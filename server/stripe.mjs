// The little Stripe needs: check a webhook signature, read a Checkout Session, find a buyer's sessions by email.
// Plain fetch against Stripe's REST API with a restricted (read-only) key, so there is no SDK to keep patched.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verifies the Stripe-Signature header of a webhook against the raw request body. */
export function verifyWebhook(rawBody, header, secret, { toleranceSec = 300, now = Date.now() } = {}) {
  if (!header) return false;
  const items = header.split(',').map((p) => p.trim());
  const t = Number(items.find((p) => p.startsWith('t='))?.slice(2));
  if (!t || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  // Stripe may send several v1 signatures while a secret is being rotated.
  return items.filter((p) => p.startsWith('v1=')).some((p) => {
    const given = Buffer.from(p.slice(3), 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export function stripeClient(secretKey, fetchImpl = fetch) {
  const call = async (path, params) => {
    const url = new URL(`https://api.stripe.com/v1/${path}`);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(`${k}[]`, x)); else url.searchParams.set(k, String(v));
    }
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${secretKey}` } });
    if (!res.ok) { const e = new Error(`Stripe ${res.status}`); e.status = res.status; throw e; }
    return res.json();
  };
  return {
    /** One Checkout Session with the price it was for. */
    session: (id) => call(`checkout/sessions/${encodeURIComponent(id)}`, { expand: ['line_items'] }),
    /** Ids of completed, paid sessions for an email, newest first, searching up to `maxPages` pages of 100. */
    async paidSessionsFor(email, maxPages = 10) {
      const want = email.trim().toLowerCase();
      const found = [];
      let after;
      for (let i = 0; i < maxPages; i++) {
        const page = await call('checkout/sessions', { limit: 100, status: 'complete', ...(after ? { starting_after: after } : {}) });
        for (const s of page.data) {
          const e = (s.customer_details?.email ?? s.customer_email ?? '').trim().toLowerCase();
          if (e === want && s.payment_status === 'paid') found.push(s.id);
        }
        if (!page.has_more) break;
        after = page.data.at(-1).id;
      }
      return found;
    },
  };
}

/** The tax years a paid session unlocks: the first line item whose price is in the price map, or null. */
export function yearsForSession(session, priceYears) {
  if (session.payment_status !== 'paid') return null;
  for (const item of session.line_items?.data ?? []) {
    const years = priceYears[item.price?.id];
    if (years?.length) return years;
  }
  return null;
}
