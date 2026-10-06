# Changelog

Versions follow MAJOR.MINOR.PATCH. The version shows in the footer of the app. Bump it in `app/package.json`.

## 1.4.0 (2026-10-06)

Catch-up filing: the IRS Streamlined Foreign Offshore Procedures. A new Catch-up filing page (rail link and a card on the first screen) works
out which 3 return years and 6 FBAR years apply from today's date, screens for risk (examination, IRS contact, knowing the rules, a US home,
large balances, no SSN, under 330 days, years already filed) and stops or sends people to a professional, collects FBAR accounts for years before
2023, asks the Form 14653 questions in the person's own words, estimates interest on any tax owed, and builds the package: returns with
"Streamlined Foreign Offshore" in red on page 1 of each return and information return, cover sheet and mailing checklist, Form 14653 worksheet
(the official form only fills in Adobe Reader, so a blank copy ships too), and FBAR worksheets. Included in the same key. Notices page updated.
Treasury year-end rate for 2019 added.

Quebec: Lou now says plainly that it does not do Quebec returns yet (About you, Results, catch-up, Start, FAQ, Notices) and stops a Quebec household instead of guessing.

Guides and FAQ: `/guides/` (10 guides) and `/faq/` are static pages built from `guides-src/` into `app/public/`, with a new sitemap. The home page gets Guides and FAQ links and a Part V "Questions" section.

## 1.3.2 (2026-10-06)

Security audit and pen test (see SECURITY-AUDIT.md). Key server: rate limits can no longer be dodged with a made-up X-Forwarded-For, JSON-only posts,
strict email check, timeouts and crash guards, HEAD health check, nodemailer upgraded to 10.0.15 (13 advisories), hardened systemd unit.
App: saved data and backups are validated (a damaged state can no longer blank the app), an error screen replaces any blank page, a malformed
`#key=` link no longer crashes. Accessibility fixes. CI now audits dependencies, checks CSP on every page and scans for committed secrets.

## 1.3.1 (2026-10-06)

Footer: "Made in Toronto" moved to the bottom; Version and Source code links removed; "Report a problem" is now a small email form at `/support/`
(delivered to karim@bigtimedesign.ca by the key server; spam-protected, nothing stored); Contact opens an email to info@bigtimedesign.ca.
Refund window 15 days; HST charged on top of the $49 CAD price.

## 1.3.0 (2026-10-06)

Paid keys. Everything up to the results screen stays free; a one-time $49 CAD key (2023 to 2025) unlocks the filled forms, review package,
mapping guide and FBAR worksheet. Keys are signed (Ed25519) and checked on the device, so Lou still works offline. New `server/` key server
(Stripe payment to key, emailed; "Find my key"), `/thanks/` and `/recover/` pages, updated Terms and Privacy. See STRIPE-SETUP.md.

## 1.2.0 (2026-10-06)

Landing page at `/`, the tool moves to `/app/`. New look across the app (Form LOU): Archivo and Courier Prime bundled in `src/fonts`,
printed-form styling in `src/brand.css`, new icon. Installed Lou opens at `/app/`.

## 1.1.1 (2026-10-05)

Start page order: who Lou is for, what to have ready, install, then choose the year, restore, continue.

## 1.1.0 (2026-10-05)

Start page is now only the tax year step (no marketing). Backup, auto-save, install and clear moved into one "Your data" panel, reachable from the rail card and the mobile top bar.

## 1.0.4 (2026-10-05)

An "Install Lou" button always shows; when the browser gives no install prompt it opens that browser's install steps.

## 1.0.3 (2026-10-05)

When Chrome or Edge shows no install prompt (already installed, or dismissed), say where to find install.

## 1.0.2 (2026-10-05)

Fix: the install note was hidden in browsers that cannot install Lou (Opera, Firefox, Android browsers).

## 1.0.1 (2026-10-05)

Say plainly when a browser (Opera and Firefox on a computer, and others) cannot install Lou or save to a folder, and what to do instead.

## 1.0.0 (2026-10-05)

First public release. Tax years 2023, 2024 and 2025 (FBAR worksheets 2020 to 2025), on-device slip reading,
filled IRS PDFs, mapping guide, review package, backup and restore, installable offline app, terms and privacy policy.
