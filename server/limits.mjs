// A small in-memory rate limiter (a restart clears it, which is fine for this traffic).
export function rateLimiter() {
  const hits = new Map();
  return function allow(bucket, max, windowMs, now = Date.now()) {
    const recent = (hits.get(bucket) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) { hits.set(bucket, recent); return false; }
    recent.push(now);
    hits.set(bucket, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    if (hits.size > 50000) hits.clear(); // a flood of made-up addresses must not be able to fill memory
    return true;
  };
}
