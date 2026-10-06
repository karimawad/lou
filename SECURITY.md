# Security policy

Lou handles sensitive tax information, so its main promise is structural: everything runs in the user's browser, and
the production build refuses connections to any other origin (see the Content-Security-Policy in `app/vite.config.ts`).
One small server (`server/`) handles payments, license keys and support messages; it never sees tax data.

## Report a problem

Email **info@bigtimedesign.ca** with "Lou security" in the subject. Please include steps to reproduce and the browser.
Do not post details publicly until we have had a chance to fix it. We aim to reply within 5 business days.

Things we especially want to hear about:

- Any way tax data could leave the device (a network request, a log, a third-party script).
- A way to read another person's saved data from the same browser, or to break the password on a `.lou` backup.
- Cross-site scripting or anything that weakens the Content-Security-Policy.
- A way to get a license key without paying, or to read other people's keys or payment details through the key server (`/api/`).

A wrong tax number is not a security issue. Please open a regular issue with the tax year and the official source.
That a determined person can edit the code to skip the paywall is known and accepted (see `SECURITY-AUDIT.md`).

## Please don't

Access other people's data, run denial-of-service or load tests against the live site, or send spam through the support form.
Third parties (Stripe, Hostinger) are out of scope; report problems with them to those companies.

## Supported versions

Only the latest deployed version at https://lou.bigtimedesign.ca.

## Audits

The last full audit and pen test is in `SECURITY-AUDIT.md`.
