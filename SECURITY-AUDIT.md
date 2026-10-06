# Lou security audit and pen test

Date: 2026-10-06. Version audited: 1.3.1 (fixes shipped in 1.3.2). Scope: the whole repository, the built site, the key server (`server/`),
and the live site at https://lou.bigtimedesign.ca (non-destructive checks only: no payments, no real support messages, no load).
Method: code review, dependency audit, secret scan of the tree and the full git history, active attack tests against the key server's real
request handler, browser-driven attacks against the built app, black-box checks of the live site, an accessibility scan, and a production checklist.
Not covered: OpenLiteSpeed and the VPS operating system themselves, Stripe and Hostinger, and automated scanners such as OWASP ZAP (not available here).
Tax-rule correctness is covered only by the automated tests (see "Production readiness"); it was not re-audited by a tax professional.

## Result in one paragraph

No critical issue. Nothing about a user's tax data can leave the device: the app makes no network calls except loading its own files, and the only
server (payments, keys, support mail) never sees tax data. The audit found 2 medium and 5 low issues in code (all fixed, each with a regression test),
1 vulnerable dependency (fixed), and a handful of operational items for you (below). Residual risks are the ones inherent to a client-side paywall.

## Findings and fixes

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Medium | **Rate limits could be dodged.** The key server trusted the first `X-Forwarded-For` entry, which a visitor can write, so anyone could get unlimited "Find my key" or support-form requests (email bombing, spam). | Fixed: only the last entry (added by our own web server) counts. Test: `security.test.ts`. |
| 2 | Medium | **A damaged or hostile saved state blanked the app for good.** A wrongly shaped saved state (or a restored backup file) threw while drawing and left a white page until browser data was cleared by hand. | Fixed: everything read from storage or a backup is validated and repaired (`sanitizeState`); an error screen with Reload and "clear saved data" is the last safety net. Tests: `sanitize.test.ts`. |
| 3 | Medium | **Vulnerable dependency.** `nodemailer` 7.0.13 had 13 published advisories (address-parser denial of service, header injection, others). | Fixed: upgraded to 10.0.15; `npm audit` shows 0. CI now fails on high-severity advisories. |
| 4 | Low | A link ending in a malformed `#key=%` crashed the app to a blank page. | Fixed. |
| 5 | Low | The key server did not require `Content-Type: application/json`, so a cross-site HTML form could submit to `/api/support` and `/api/recover`. | Fixed: non-JSON posts get 415 (a browser must ask permission first and gets none). |
| 6 | Low | Email checks were loose (accepted commas and odd characters). | Fixed: strict ASCII check. Limit: addresses with non-ASCII characters (IDN) cannot use "Find my key" or the support form; they can write to info@bigtimedesign.ca. |
| 7 | Low | Server robustness: a malformed URL could throw outside the error handler; no request timeouts; no crash guards; unbounded rate-limit memory; no HEAD health check for uptime monitors. | Fixed. |
| 8 | Low | Accessibility: status text on the yellow current-year row failed contrast (3.4 to 4.1 against 4.5); the "Drop slips here" heading skipped a level; three small pages had content outside landmarks. | Fixed; axe now reports zero violations on the landing page and app start page. |
| 9 | Info | `security.txt` expiry was a day over a year; no disclosure policy file. | Fixed: expiry shortened, `SECURITY.md` added. |
| 10 | Info | The systemd unit allowed more than needed. | Hardened (no capabilities, own /tmp and /dev, kernel and cgroup protections, restricted address families, 512 MB memory cap). Takes effect when you run `sudo bash deploy/install-key-server.sh` after pulling. |

## What was checked and found sound

- **Secrets:** no key, password, webhook secret or private key anywhere in the working tree or in any git commit. `server/secrets/` is gitignored. CI now blocks a commit that contains a live Stripe key or private key.
- **Privacy claim ("nothing leaves your device"):** the app code makes exactly one kind of request, for its own static form PDFs, plus service worker registration. It never calls `/api`. Browser runs of the full user flow (desktop and mobile) recorded zero off-origin requests. Only `/thanks/`, `/recover/` and `/support/` talk to the key server, and they send only a payment reference or what the person types.
- **Content-Security-Policy** on every page and from the web server: scripts only from our own origin (no inline, no `eval`), no connections to other origins, no frames (`frame-ancestors 'none'`), `object-src 'none'`. The one relaxation is `style-src 'unsafe-inline'` (React inline styles), which is low risk. Verified by CI on every build.
- **Injection and XSS:** no `dangerouslySetInnerHTML`; the few `innerHTML` uses on the small pages take fixed strings, with user text set through `textContent`. Reflected-input attacks on every page (query strings, hash, session id parameter) did nothing. Mail is plain text; subject and address header injection is blocked and tested. Prototype-pollution payloads in JSON bodies and saved state do nothing (tested).
- **Payments:** the Stripe webhook is verified (signature, timing-safe compare, 5-minute window, rotation-safe); forged, unsigned, tampered, stale and wrong-secret webhooks are rejected and send nothing (tested). Keys are Ed25519-signed and deterministic; edited, re-signed, unknown-key-id and malformed keys are rejected (tested). The Stripe API key is read-only (Checkout Sessions: Read) and was confirmed to work and be limited.
- **Information leaks:** error responses are generic; logs hold method, path and status only (no emails, keys or bodies); `/api` answers carry `no-store`, `nosniff` and a locked-down CSP.
- **Live site (black box):** HTTP redirects to HTTPS; HSTS 1 year; TLS 1.0 and 1.1 refused, 1.2 and 1.3 accepted; Let's Encrypt certificate valid to 2027-01-03; `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` set; 30 probes for exposed files (`.git`, `.env`, `server/`, `deploy.sh`, `releases/`, logs, `node_modules`, source maps, directory listings, traversal) all returned 404 or 400; the live API rejected bad ids, unsigned webhooks, bad emails, non-JSON and a 200 KB body (413). The live key server also correctly reached Stripe (a made-up session id returned 404 from Stripe).
- **PDF and OCR handling:** pdf.js runs with `isEvalSupported: false` and the CSP forbids `eval`; OCR runs in a same-origin worker with self-hosted language data.
- **Service worker:** same-origin GET only; never touches `/api` or POSTs.
- **Server network exposure:** the key server listens on 127.0.0.1 only and is reachable solely through the web server's `/api/` proxy.

## Residual risks (accepted or yours to decide)

1. **A client-side paywall can be bypassed** by someone who edits the code (the code runs on their device). Accepted: the source-available license forbids hosting copies, and the price is far below a preparer's.
2. **Keys cannot be revoked and can be shared.** A refunded buyer or a leaked key keeps working. Mitigation if abuse appears: ship a revoke list in a release.
3. **Anyone holding a paid Stripe session id can claim the key.** Ids are unguessable and only the buyer's browser sees them; the page URL appears in the web server log for up to 14 days. Acceptable.
4. **A replayed valid webhook inside 5 minutes sends a duplicate email.** Harmless (same key).
5. **Support and "Find my key" are protected by rate limits, a hidden trap field and a speed check, not a CAPTCHA** (a CAPTCHA would mean a third-party script). If spam appears, tighten the limits or add an email confirmation step.
6. **Optional header hardening not applied:** `Cross-Origin-Opener-Policy: same-origin`, HSTS preload. Low value; add to the vhost if you want them.
7. **`pdfjs-dist` is pinned at 4.10.38** (past the 2024 arbitrary-script fix, and contained by the CSP). A newer major exists; plan an upgrade with a full re-test of slip reading.

## For you to do (operations)

- Pull and run `sudo bash deploy/install-key-server.sh`, then `./deploy.sh`, so the server fixes and the hardened service go live. Until then the live key server still has findings 1, 5, 6 and 7.
- **Rotate the secrets that were pasted into chat** (Stripe key, webhook secret, mailbox password) once everything works.
- Confirm certificate auto-renewal on the VPS: `systemctl list-timers | grep certbot` (the certificate expires 2027-01-03).
- Back up `/etc/lou-license/ed25519.pem` and `/etc/lou-license.env` (a password manager is fine). If the signing key is lost, new keys need a new key id (see STRIPE-SETUP.md); old keys keep working.
- VPS basics: SSH keys only, firewall allowing only 22, 80 and 443 (the key server's port is local), automatic security updates, and an uptime monitor on `https://lou.bigtimedesign.ca/api/health` (HEAD works) plus one on `/`.
- In Stripe: keep email alerts for failed webhook deliveries on; leave Radar at its defaults.
- Make one real purchase and refund it before announcing; confirm the key email lands in the inbox (SPF, DKIM and DMARC for bigtimedesign.ca).

## Production readiness checklist

| Area | Status |
|---|---|
| Type-check, lint (0 errors), production build | Pass |
| Tests | Pass: tax engine, extraction and PDF fills, plus new key, payment-flow, security and saved-data tests (328 tests in 27 files at the time of this audit) |
| Dependency vulnerabilities | 0 in the app and in the key server; CI enforces |
| Secrets and repository hygiene | Clean; CI enforces |
| Privacy claims verified in a browser | Pass |
| Security headers and CSP (live) | Pass |
| Offline use and updates (service worker) | Pass (checked with the install and offline script) |
| Accessibility (axe, WCAG 2.1 AA) | Pass on landing and app screens checked; known limits: slips screen colour-transition false positive |
| Error handling (blank-page protection, key server down, Stripe down) | Pass: error screen; thank-you page falls back to "your key is being emailed"; webhook retries |
| Legal pages | Updated for payment, 15-day refund, HST, support form. Lawyer review still recommended |
| Payments | Built and tested against a pretend Stripe. **Not yet exercised end to end with a real checkout, webhook and email** (your step above) |
| Tax correctness | Covered by automated tests against IRS tables and worksheets; not independently audited by a tax professional. The app flags its known limits to the user |

## Regression tests

`app/src/license/security.test.ts` (rate-limit evasion, content-type attacks, header and prototype injection, session-id abuse, fuzzing, oversize bodies, odd methods, webhook forgery, enumeration), `server.test.ts` (payment and support flows), `license.test.ts` (key signing and checking) and `app/src/state/sanitize.test.ts` (damaged saved state). CI runs them, an audit of both dependency sets, a CSP and inline-script check of every built page, and a secret scan.
