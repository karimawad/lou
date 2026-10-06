# Changelog

Versions follow MAJOR.MINOR.PATCH. The version shows in the footer of the app. Bump it in `app/package.json`.

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
