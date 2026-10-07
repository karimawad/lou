# Lou - Canadian slips in, US tax forms out

Free public web app for **US persons living in Canada** (US citizens, dual citizens, green card holders).
User drops Canadian tax documents (PDF, CSV, photos). Lou reads them on-device, converts to USD,
computes the US return, fills official IRS PDFs, and produces a line-by-line Canada-to-US mapping
guide as a manual fallback.

## Non-negotiables

1. **Nothing leaves the device.** No backend, no cloud OCR, no LLM API, no analytics that see tax data.
   PDF parsing (pdf.js), OCR (tesseract.js with self-hosted language data), math, and PDF filling
   (pdf-lib) all run in the browser. Hosting is static files only. A new server or cloud call needs a
   fresh decision from Karim.
2. **99.9% confidence on tax rules.** Every constant and mapping cites an IRS/CRA primary source
   (form instructions, publications, Rev. Procs, CRA slip backs). Source PDFs live in `research/`.
   If a rule is uncertain, the app flags it to the user instead of guessing.
3. **Tests against IRS numbers, not our own.** Tax math is checked against official IRS tables and
   worksheets (`app/src/tax/__fixtures__/` is parsed from the IRS instructions). Never "fix" a fixture
   to make a test pass.
4. **Not a preparer.** Lou is software; the user signs their own return. No paid review, no
   "we guarantee" language. Every output carries a plain-language review reminder.
5. Writing: no em dashes, no AI-tell words (seamless, leverage, unlock, elevate, robust, delve).
   Plain language for non-technical people first; technical detail goes in "Advanced" sections.
6. **No Tailwind.** Plain CSS with tokens. Apply the global design skills (impeccable,
   design-taste-frontend, emil-design-eng, high-end-visual-design) for any new UI.

## Scope (decided 2026-10-03)

- Filers: US persons resident in Canada. Not 1040-NR, not dual-status, not snowbird Form 8840. **Not Quebec** (Karim, 2026-10-06): `state/quebec.ts` `looksQuebec` blocks About you, Results and catch-up readiness (province QC, T4 box 17/55, NOA QC432/44000). The old TP-1/abatement plumbing stays dormant and untested; lifting the block needs fixtures from Revenu Quebec/IRS numbers, RL slips and the Quebec notice.
- Tax years: 2023, 2024, 2025 returns; FBAR worksheets 2020-2025 (Streamlined Foreign Offshore window).
- Each year has its own constants (`app/src/tax/years.ts`) and its own PDF field maps.

## Hard-won tax facts (do not regress)

- Canadian wages (T4 box 14) -> Form 1040 **line 1h** "Other earned income" with a description.
  Line 1a is W-2 box 1 only.
- Form 1116 credit uses Canadian tax **actually paid/owed for the year** (T1 / Notice of Assessment),
  not T4 box 22 withholding. CPP/QPP/EI/PPIP are not creditable (Totalization Agreement).
- T5/T3 dividends: use **actual** amounts (T5 box 24 eligible, box 10 other; T3 box 49, 23),
  never the grossed-up taxable amounts.
- RRSP/RRIF growth: deferral automatic under Rev. Proc. 2014-55 (Form 8891 is obsolete). Still
  reportable on FBAR and Form 8938.
- Canadian mutual funds/ETFs are generally PFICs -> Form 8621. Flag them, never silently ignore.
- FBAR is filed only through FinCEN BSA E-Filing: Lou outputs a worksheet, and FBAR max values use
  Treasury year-end rates, not the IRS yearly average.
- Currency: income uses the IRS yearly average rate (CAD per USD; **divide** CAD by the rate).
- CPP/QPP/OAS: exempt by default with Form 8833 (Karim confirmed 2026-10-03); user can switch to include.
- Form 1116 category: pensions and RRSP/RRIF withdrawals = **general** (IRC 61(a)(9) annuities vs (11) pensions;
  passive under 904(d)(2)(B)/954(c) covers annuities only; treaty Art. XVIII(3) calls RRSP/RRIF payments pensions;
  practitioner consensus). True annuity boxes (T4A 024, T4RSP 16) = **passive**. No IRS ruling names RRSPs;
  the app shows an info note. Researched 2026-10-03 at Karim's request.

## Layout

```
app/                 Vite + React 19 + TypeScript (the product)
  src/tax/           Pure tax engine (no DOM). years.ts, taxComputation.ts, ... + *.test.ts
  src/tax/__fixtures__/  Parsed official IRS tables
guides-src/          Python source for /guides/ and /faq/ (python guides-src/build.py writes into app/public)
research/            Source PDFs + text (IRS forms/instructions, CRA slips) and extraction scripts
  dumpfields.mjs     Lists every fillable PDF field with its printed line number
  taxtable.mjs       Parses the official Tax Table into fixtures
```

## Commands (from app/)

```
npm run dev          # local dev server
npm test             # vitest (tax engine)
npm run type-check
npm run build
```

## Status (2026-10-03, end of session 1)

Working end to end for 2025 (verified with a Playwright walkthrough, desktop + mobile, zero console errors,
zero off-origin requests): year -> about you -> drop slips -> side-by-side review -> questions -> results
with filled IRS PDFs (1040, Sch 1, 1-A, 2, 3, B, 8812, 1116 per category) and a printable mapping guide.

- Tax engine: `app/src/tax/` (taxComputation, income, compute). 96 tests incl. every IRS Tax Table row 2023-2025.
- Slip reading: `app/src/extract/` PDF form fields -> PDF text layer (amounts must have cents) -> template OCR
  for photos/scans (`templates/*.json` built by `research/make_templates.py` from official CRA slips).
  OCR guarantee (tested): a value marked confident (>0.5) is exact; uncertain reads are flagged "Please check".
- PDF filling: `app/src/pdf/` maps verified by `maps.test.ts` against printed line numbers + visual render check.
- UI: `app/src/screens/`, tokens in `index.css`, components in `app.css`. Design brief in PRODUCT.md.
- Visual check: `npm run dev` then `node scripts/walkthrough.mjs` (screenshots to research/render_check/ui).

## Session 2 (2026-10-03) added

- Form 2555 (Parts I, II, IV, VII, VIII) with its own questions; Form 8833 (voluntary, see below);
  Schedule B (Form 1116) with carryovers tracked by year of origin (used oldest first, 10th year expires);
  accounts list -> FBAR worksheet + Form 8938 (Parts I-VI, extra page-2 copies as attached statements).
- Production Content-Security-Policy in vite.config.ts: no connections to other origins. OCR verified working under it.
- OCR fix: a cents group that isn't exactly two digits is "ambiguous" and always flagged
  (the browser check caught "5000 0" being read as 500.00 with high confidence).
- `node scripts/ocr-check.mjs` checks photo OCR in a real browser against the production build (`vite preview --port 5180`).

## More hard-won facts

- Form 8833 is NOT required for CPP/OAS: Treas. Reg. 301.6114-1(c)(1)(iv) waives social security and pension
  positions, and (c)(1)(v) waives treaty re-sourcing. Lou includes it voluntarily (Karim chose "exempt with 8833").
- Exchange rates: the IRS "accepts any posted exchange rate that is used consistently"; the yearly average is fine for wages.
  FBAR and Form 8938 use the Treasury rate for Dec 31 (2020 1.275, 2021 1.277, 2022 1.354, 2023 1.326, 2024 1.438,
  2025 1.369). FBAR rounds UP to the next dollar.
- RRSP/RRIF/TFSA/RESP/FHSA held at an institution are Form 8938 Part V accounts; an employer pension is Part VI.
  Only US persons file an FBAR (no FBAR for a non-US spouse); joint owners each report the full value.
- Form 8938 living-abroad thresholds: $200k year end / $300k any time ($400k / $600k MFJ); MFS counts half of joint assets.
- Unused foreign tax is carried back one year first (IRC 904(c)); Lou enters 0 on Schedule B line 7 and flags it.
- Type-check: check `npx tsc -b` exit code, not just its output (an empty output once hid errors).

## Session 3 (2026-10-03): prior-year PDFs

- Filled PDFs for 2024 and 2023: `app/src/pdf/mapsPrior.ts` (keys use 2025 engine numbering; on these years
  '7a' = line 7, '11a' = 11, '12e' = 12, '13a' = 13, '27a' = 27; no 11b/13b/Schedule 1-A). Form 2555, Schedule B
  (Form 1116), 8833 and 8938 reuse the 2025 maps (same fields). `fillReturn(input, r)` picks maps by year.
- Verified: maps.test.ts checks every line field against the printed number for all three years; all 154 prior-year
  checkbox on-values checked against the PDFs (2023 Form 1116 uses text values "Paid"/"Accrued"); rendered and inspected.
- Prior-year form PDFs: research/irs-pdfs/<year>/ and app/public/forms/<year>/ (from irs.gov/pub/irs-prior).

## Session 4 (2026-10-03): multi-year workspace

- One household, up to three tax years. Shared: taxpayer, spouse, address, dependents. Per year (`YEAR_KEYS` in
  state/store.ts): filing status, slips, docs, accounts, elections, answers, carryover, step. The active year's
  fields are flat on AppState (so screens are unchanged); other years live in `state.years`. `switchYear`,
  `addToYear`, `stateForYear`, `yearData` handle the swap.
- Slips printed with another supported year are routed to that year's workspace on upload.
- Carryovers: if a year has no typed-in carryover, `autoCarryover` computes the previous year's return in Lou
  (only once all its slips are checked) and uses its Schedule B (Form 1116) line 8 by year of origin. Chains.
- Year switcher in the rail (status per year) and a year select in the mobile top bar.
- Checks: src/state/years.test.ts; `node scripts/multiyear-check.mjs` in a real browser.

## Session 5 (2026-10-04): alternative minimum tax

- `app/src/tax/amt.ts`: Form 6251 Parts I-III line by line (2023-2025 constants read off each form), Exemption Worksheet
  (incl. the MFS line 4 add-on), Foreign Earned Income Tax Worksheet for line 7 (Form 2555 capital gain excess rules),
  AMT foreign tax credit via a separate AMT Form 1116 per category (no standard deduction; QD factors 0.5357/0.7143;
  AMT Worksheet for Line 18 factors 0.2857/0.4643/0.1071). Runs after the regular FTC; feeds Schedule 2 line 2 before
  Schedule 8812 so Credit Limit Worksheet A sees it.
- Form 6251 is attached when line 7 > line 10 (Who Must File #1); AMT Forms 1116 follow it only when the AMT credit
  differs from the regular credit (i6251 Step 6), stamped "AMT - ... category income" in the top margin.
- For Lou's filers (standard deduction, Canadian income, Canadian tax) AMT is almost always $0; a high salary still
  needs Form 6251 attached because the regular credit drives line 10 to 0.
- AMT foreign tax credit carryovers are not tracked (line 10 of the AMT 1116 = 0); flagged when AMT > 0 and regular carryovers exist.

## Session 6 (2026-10-04): all earlier open items closed

- Dependents are per year (`YEAR_KEYS`); a new year starts with a copy. `switchYear` fills missing per-year keys for old saves.
- AMT foreign tax credit carryover: AMT Forms 1116 are always figured (line 20 = 0 when line 6 is 0), with their own Schedule B
  vintages (`carryover.amtVintages`, auto-carried from last year's return in Lou, typed-in wins).
- Self-employment (`tax/business.ts`): Schedule C from T2125 figures; car = standard mileage only (65.5/67/70 cents);
  home office = simplified $5/sq ft up to 300; assets = ADS straight line (IRC 168(g)(1)(A), no section 179 per 179(d)(1)/50(b)),
  half-year or mid-quarter (>40% in Q4), de minimis safe harbor $2,500 with election statement; Form 4562 when an asset is placed
  in service (vehicle then goes on 4562 Part V). No SE tax: totalization Art. V; Schedule 2 line 4 "Exempt, see attached statement"
  (2025 box 3; 2023/2024 drawn on the line) + CPT56 page. No QBI (199A(c)(3)(A)(i)).
- Form 2555: physical presence test (`tax/feie.ts`, best 12-month window, only days up to today count), partial-year bona fide
  residence (qualifies once the next full year has passed), housing exclusion (Part VI; employer amounts include wages) and
  deduction (Part IX -> Schedule 1 line 24j), Canadian city limits from Notices 2023-26/2024-31/2025-16; line 44 business expenses.
- T4A amount fields are named "Line16" etc. (reader and template builder were missing them: fixed, fixtures added).
  NOA: text-layer reading fixed (amount column is far right) and tilt-corrected row matching for photos; NOA reads stay "Please check".
- Daily FX: Bank of Canada rates 2007-05-01..2025-12-31 bundled (`tax/data/boc-usdcad.json`, `tax/fx.ts`).
- Sales (`tax/capital.ts`): Form 8949 box C/F, Schedule D (loss limit, carryover worksheet, auto carry-in), daily rates per date.
- PFIC (`tax/pfic.ts`, Form 8621 Rev. 12-2025 for all years): section 1291 (125% test, daily allocation, top rates by year,
  interest at IRC 6621 rates compounded daily from `tax/data/irs-interest.json` = Rev. Rul. 2025-22 table + 2026 quarters),
  MTM (incl. 1296(j) first-year rule), QEF; $25k/$50k exception; RRSP/RRIF exempt. 1291 tax -> 1040 line 16 box 3 "1291TAX",
  interest -> Schedule 2 line 17p; kept out of the Form 1116 line 20 limit and (conservatively) the child credit limit.
- TFSA/FHSA/RESP (`tax/foreignTrust.ts`): income inside reported each year; TFSA/FHSA get Form 3520 + substitute 3520-A
  (Rev. Dec 2023, same PDF all years) as a separate package (Ogden, UT; due June 15 abroad). RESP/RDSP exempt (Rev. Proc. 2020-17).
- Fixed: 2023 Schedule 2 had no AMT field (AMT is line 1 on 2023); Schedule 2 line 3 now mapped all years.
- Checks: `node scripts/sections-check.mjs [url]` (every new section, desktop or MOBILE=1); walkthrough is year-aware (YEAR=2023/2024).

## More hard-won facts (session 6)

- Self-employment income exempt from SE tax under a totalization agreement is NOT earned income for the refundable child credit
  (Schedule 8812 Earned Income Worksheet line 2b).
- A US citizen with a Canadian tax home has foreign-source stock gains only if Canada taxes them at 10%+ (IRC 865(g)(2), Pub 514);
  Lou tests average Canadian rate x 50% inclusion; under 10% the gain is US source (treaty re-sourcing not done, flagged).
- TFSA/FHSA: default file 3520 + 3520-A (Karim, 2026-10-04); user can switch off with a warning.
- Form 3520 for people abroad is due June 15; 3520-A substitute rides with it.
- Spouse with no SSN/ITIN is never blocked. MFS + nonresident spouse: print "NRA" (i1040 Filing Status). MFJ by election: box blank,
  Form W-7 (reason e) on the front, passport, whole package to ITIN Operation, P.O. Box 149342, Austin TX 78714-9342 (iW7 Rev. 12-2024).
  A US-person spouse can't get an ITIN (needs an SSN): box blank + warning, never "NRA".
- T1 return PDFs from tax software (`extract/t1.ts`): detected by "5006-R" + "Income Tax and Benefit Return" (checked before slip
  signatures: a T1 names T4A(OAS) etc. in its labels). Read into an NOA-type record with payer "T1 return": CRA fillable fields
  `Line_NNNNN_Amount`, or flattened text where dollars and cents are separate tokens (Wealthsimple). Fixtures: research/make_t1_fixture.py.
  Rows mentioning "their return" (page 1 spouse lines) are skipped.
- T1 as income source (`state/t1.ts`, Karim 2026-10-04): per owner and line, if no uploaded slip feeds a T1 income line, Lou makes a
  slip from it (10100 T4 14, 11300/11400/11500/11900, 12100 T5 13, 12900 T4RSP 22 or 16 by question, 12000/12010 T5 24/10 with the
  gross-up removed: /1.38 and /1.15). If slips feed it, slips win and the T1 total is checked. Never both. Lines Lou can't convert
  (12700 sales, self-employment, rental, 13000, ...) are flagged. Income lines must sum to 15000 or the return is blocked (misread guard).
  Made slips are rebuilt every time (`incomeSlips(state)`); their answers live on the T1 record (`derivedAnswers` by line).
- Provenance (2026-10-05): `screens/destination.ts` gives each treatment a primary `source` (shown under every box in Check the
  numbers and in the mapping guide); `screens/provenance.ts` turns each read into a level (Exact = form field/CSV, High = PDF text,
  Good = photo, Low <= 0.5 = please check, You entered, From T1 line). Wages on line 1h cite i1040 lines 1a/1h + Pub. 54 (2025) FAQ 3.
- Review package (`pdf/reviewPackage.ts`, Results "Review package for a tax professional"): summary, every number with read level,
  destination and source, choices, all warnings, the filled forms, then the uploaded page images. SSN masked on Lou's pages.
  Standard fonts are WinAnsi only: pass all text through `winAnsi()`.
- Backup/restore (`state/backup.ts`, `screens/Backup.tsx`; rail, Start, Results): one `.lou` JSON file with the whole state (all years)
  and every page image; optional password = PBKDF2-SHA-256 600k -> AES-256-GCM (Web Crypto). Restore clears, writes blobs, saves at once.
  The rail now has a hidden file input too: scripts must target `main input[type=file]`.
- Results: FBAR worksheet and mapping guide are `details.fold` (closed by default); `usePrintOpensFolds` opens them for printing.
- Accounts: "Another account at X" and "Use an institution you already entered" (names + addresses from every year's accounts).

## Reuse across years (2026-10-05, `state/carry.ts`)

- Shared (one copy): taxpayer, spouse, address. A new year is seeded from the nearest year with data (tie: the earlier year):
  filing situation, elections, dependents (not born yet: skipped), accounts, businesses, funds, Form 2555 background. Slips never.
- Copied items keep identity, drop yearly amounts, and get `carried: <source year>` until the user enters a balance / income /
  value or clicks "The YYYY figures are in". Questions' "See my US return" and a Results block flag wait for that.
- Direction rules: forward drops closed accounts, TFSA start = last year-end, fund history shifts ([this year, ...prior].slice(0,3));
  backward drops accounts opened / funds bought / assets placed later, and the earlier year-end = the later start value.
- Existing years get a "Bring in your X from YYYY?" offer (`CarryOffer`, dedupe keys in carry.ts, "No thanks" kept in
  `carryDismissed`). Form 2555 prefills from another year until edited. A fund copied forward takes a new slip with its payer name.
- Check: `node scripts/carry-check.cjs` (dev server).

## Installable web app (2026-10-05, Karim chose option B over a desktop installer)

- Manifest `public/manifest.webmanifest` (icons from `scripts/make-icons.mjs`; `.lou` file handler + `launchQueue` -> restore prompt).
- Service worker: template `sw/sw.js`; the build plugin in vite.config.ts fills PRECACHE with every dist file (all forms, OCR engine
  and language data, ~25 MB) and VERSION with a hash of them plus the template. Cache-first for files, network-first for the page.
  Lookups use `ignoreVary` (module scripts send Origin; stored copies were fetched without it). Never skipWaiting on install:
  the "A new version of Lou is ready" banner sends SKIP_WAITING, and the page reloads only after that click (not on first install).
  Registered only in production builds (`src/pwa.ts`, `startPwa()` in main.tsx before React).
- Auto-save to a folder (Chrome/Edge desktop, File System Access API, `state/folderSync.ts`): handle kept in IndexedDB key
  `__folder`; writes `Lou-autosave.lou` + a dated `Lou-backup-YYYY-MM-DD.lou` 2.5 s after changes; after a browser restart one
  click ("Keep saving to X") re-grants permission. Safari/Firefox: backup files only.
- Hosting: HTTPS, and `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest` must not be cached long (`public/_headers` for
  Cloudflare Pages/Netlify; `_*` files are excluded from the precache). Check: `node scripts/pwa-check.cjs` against `vite preview`.

## Landing page + Form LOU look (2026-10-06, v1.2.0)

- Two pages, one build: landing at `/` (`app/index.html`, `src/landing/landing.ts` + `landing.css`, no React) and the tool at `/app/`
  (`app/app/index.html`). Manifest scope/start_url, service worker fallback, sitemap, scripts' default URLs all moved to `/app/`.
- Look ("Form LOU"): a printed tax form. Tokens in `index.css` (paper, ink, shaded entry boxes `--shade`, ballpoint `--blue`, print
  inks `--sun/--poppy/--sky`, spruce accent), skin in `src/brand.css` layered over `app.css`. Archivo (variable width) + Courier Prime
  (amounts) are self-hosted in `src/fonts` (Latin subset): never load a font service.
- Landing copy is Karim's (hero, how it works, why Lou, $49 CAD pricing, edited 2026-10-06 to "one payment, 2023 to 2025"). "Start with Lou" goes to `/app/`. A "Continue your return"
  button shows when saved state has a year. FAQ link not built (no FAQ page exists).

## Paid keys (2026-10-06, v1.3.0; Karim decided)

- Pricing: $49 CAD once, one key covers tax years 2023-2025; 2026+ needs a new key. Gate is at the END: everything through the results
  screen is free; a key unlocks the filled PDFs, review package, mapping guide, FBAR worksheet (`screens/Unlock.tsx`, gated in Results.tsx).
- Key = `LOU1.<payload>.<Ed25519 signature>`, minted by `server/` after Stripe payment, verified OFFLINE in the app (`license/key.ts`,
  public keys by id in `PUBLIC_KEYS`). Deterministic (same payment, same key), no database. Stored in `state.licenses`: kept in backups,
  survives "Clear my data". Arrives via `/app/#key=...` (thank-you page or email link), then the hash is removed.
- Exception to non-negotiable 1, accepted by Karim: ONE small key server on his Hostinger VPS (`server/`, port 3417 on localhost, proxied at `/api/`; set up or repaired by `sudo bash deploy/install-key-server.sh`). It sees
  only payment/email data, never tax data. The app itself never calls it (CSP `connect-src 'self'` unchanged); only `/thanks/` and
  `/recover/` do. If it is down, existing keys and the rest of Lou work; Stripe webhook retries email the key later.
- Stripe: Payment Link redirects to `/thanks/?session_id={CHECKOUT_SESSION_ID}`; webhook `/api/webhook`; restricted read-only key.
  "Find my key" emails the key to the paid email (always the same reply, rate limited). Mail sent from karim@bigtimedesign.ca (Hostinger SMTP), Reply-To info@bigtimedesign.ca.
- "Report a problem" = standalone `/support/` page (not in the app, so the app stays zero-network) -> `POST /api/support` on the key server -> emails
  `SUPPORT_TO` (karim@bigtimedesign.ca), reply-to = sender. Honeypot field + too-fast check + rate limits (5/hour/IP, 3/day/email); nothing stored.
  Footer links: Terms, Privacy, Notices, Report a problem, Contact (mailto info@). No Version/Source links.
- Setup steps: STRIPE-SETUP.md; server install: DEPLOY.md "Key server". Private signing key lives only in `server/secrets/` (gitignored) and on the VPS.
- Not done yet / needs Karim: create the Stripe product, Payment Link and webhook; put `PAYMENT_LINK` in `license/config.ts`; install the key server;
  register for GST/HST in Stripe Tax (Karim decided to charge HST, 2026-10-06; price is $49 CAD plus tax, tax behavior must be "exclusive"). Refund window is 15 days (Karim, 2026-10-06). Karim is happy with the Terms/Privacy text for now.
- Security audit + pen test 2026-10-06: SECURITY-AUDIT.md (findings, fixes, residual risks, ops to-do). Regression tests: `license/security.test.ts`,
  `state/sanitize.test.ts`. Saved state and backups always go through `sanitizeState`; `ErrorBoundary` is the blank-page safety net.
- Anyone can bypass a client-side paywall by editing the code. Accepted: it is an honest paywall (source-available license forbids hosting copies).

## Catch-up filing (2026-10-06, v1.4.0): IRS Streamlined Foreign Offshore Procedures (SFOP)

- Entry: rail link "Catch-up filing" + a card on Start; `StepId` 'catchup' (not in `STEPS`). State: `state.catchup` (shared, not per year; `sanitizeCatchup`).
- Rules in `tax/catchup.ts` (pure; sources cited at the top). Years are never hardcoded: `sfopPlan(today, extension)` gives the 3 return years
  (due date passed: June 15 for people abroad = automatic 2 months, Oct 15 if Form 4868; interest runs from April 15) and the 6 FBAR years (late after Oct 15).
  Between Jun 16 and Oct 15 the page asks whether Form 4868 was filed. The newest FBAR (not late until Oct 15) is listed as "file it too". Years Lou has
  no rules or Treasury rate for (return years outside 2023-2025, FBAR years before 2019) block the page with a message instead of guessing.
- Interest: `catchUpInterest` = IRC 6621 rates compounded daily (`pfic.ts interestFactor`, `data/irs-interest.json`) from April 15 to the planned mail date; estimate only.
- Screening (`SCREEN_QUESTIONS`, `evaluateScreening`): stop = exam/investigation, illegal income, no SSN (SFOP FAQ 10), deliberate choice, a year already filed (needs 1040-X, not built),
  under 330 full days in every year. refer = IRS contact, knew the rules, was told, earlier wrong return, US abode, balances over US$1,000,000 (Lou's own cutoff, not an IRS rule);
  a refer finding is lifted by the "talked to a professional" checkbox, a stop never is.
- Form 14653 (Rev. 3-2025) is an XFA form: pdf-lib cannot fill it and browsers show a stub. Lou ships the blank (`public/forms/f14653.pdf`, text in `research/instr/f14653_text.txt`)
  and a worksheet PDF. The statement of facts is the person's own words (`STATEMENT_PROMPTS` + one prompt per account), printed verbatim; Lou never writes or checks the certifications.
- Package (`pdf/catchupPackage.ts`): red "Streamlined Foreign Offshore" stamp on page 1 of the 1040 and each information return (8938, 8621, 3520, 3520-A); Form 3520 forms ride
  in the same Austin package (IRS: information returns go with the returns; they do not go to Ogden in SFOP). Cover sheet + checklist, worksheet, FBAR worksheets
  ("Other" / "Streamlined Filing Compliance Procedures" as the late reason). Address: IRS, 3651 South I-H 35, Stop 6063 AUSC, Attn: Streamlined Foreign Offshore, Austin, TX 78741.
  Original Form 14653 once, copies attached to each return and information return; SSN on the check; paper only.
- FBAR-only years (before 2023) keep accounts in `catchup.fbar[year]`; return years use their workspace's accounts (`state/catchup.ts fbarYear`). Treasury Dec 31 2019 = 1.300 added.
- Same $49 key: the package is gated on every return year being covered by a key (Karim: FBAR years are only data entry, included).
- Not built (flagged on the page): Form 1040-X for already-filed years, the domestic procedure (5% penalty), joint-certification specifics, non-US-person spouse substantial presence computation.
- Checks: `catchup.test.ts` (tax, state, pdf), `node scripts/catchup-check.cjs` (real browser, needs the test key in server/secrets).

## Known limits (the app flags each one)

1. Treaty re-sourcing of low-taxed gains (separate Form 1116 basket) not done.
2. PFIC: holding periods before 1987, green card holders who bought before becoming US persons, QEF purging elections: flagged for review.
3. Car expenses: standard mileage only; listed-property depreciation and passenger auto caps not computed.
4. Housing deduction carryover (Form 2555 line 49) not carried automatically.

## Earlier year after a later one (2026-10-07)

- One $49 key covers 2023-2025 and lives in shared `state.licenses` (not per year), so doing 2024 after paying for 2025 never asks for payment again.
- `state/staleness.ts`: `state.reviewed[year]` = snapshot of what carries into that year (FTC/AMT FTC/capital loss vintages + refund), taken when Results
  is first shown (year ready: slips checked + NOA) and on every PDF download or "I have reviewed it". `staleYears` compares to now; a mismatch shows a
  "Review your YYYY return again" callout on Results (any year), "Review again" in the rail year list. Lou already recomputes the new numbers; the user is told to re-download.
- Carryback (IRC 904(c), i1116 line 10, i1116sb line 7; Karim chose level 1, 2026-10-07): `autoCarryover` also returns the prior year's unused Form 1116 limit
  (line 23 less line 24, per category) as `room`; `toReturnInput` passes it as `priorYearRoom`. `scheduleB1116(.., room)` puts min(line 6, room) on line 7
  (negative), the rest on line 8. `Form1116.carryback` + warn flag `carryback-<cat>` tell the user to amend the prior year (1040-X, revised 1116: line 10 and 24 up,
  Schedule 3 line 1 up, same refund). Prior year not in Lou: old info flag, line 7 = 0. The prior year's review snapshot has `back`, so it is flagged "review again".
  NOT built: Form 1040-X; the prior year's other effects (child credit limits, AMT, AMT FTC carryback) are not recomputed; 2023 -> 2022 (no 2022 rules).
