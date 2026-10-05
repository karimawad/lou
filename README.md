# Lou

Canadian tax slips in, US tax forms out. A free web app for US citizens, dual citizens and green card holders who live in Canada.

Drop your Canadian documents (T4, T5, T3, T4A, T4RSP, NOA, T1, as PDFs, CSVs or phone photos). Lou reads them,
converts to US dollars, works out your US return, fills the official IRS PDFs, and gives you a line-by-line
guide from each Canadian box to each US line.

**Live: https://lou.bigtimedesign.ca**

## Nothing leaves your device

No backend, no account, no cloud OCR, no AI service, no analytics. PDF reading (pdf.js), photo reading
(tesseract.js, self-hosted), the tax math and PDF filling (pdf-lib) all run in your browser. The production build sets a
Content-Security-Policy that blocks connections to any other site. This repo is public so you can check.

## Not a tax preparer

Lou is software. You check every number and sign your own return. See the [terms](app/public/legal/terms.html) and
[notices](app/public/legal/notices.html).

## What it covers

- Filers: US persons resident in Canada (not 1040-NR, dual-status or snowbird Form 8840).
- Tax years 2023, 2024 and 2025; FBAR worksheets 2020 to 2025.
- Forms 1040, Schedules 1, 1-A, 2, 3, B, C, D, 8812, 1116 (and AMT), 2555, 6251, 8833, 8938, 8949, 8621,
  3520/3520-A, plus an FBAR worksheet.
- Every constant and mapping cites an IRS or CRA primary source (see `research/`). Known limits are listed in
  [CLAUDE.md](CLAUDE.md) and flagged in the app.

## Develop

```
cd app
npm ci
npm run dev          # local dev server
npm test             # tax engine, extraction, PDF maps
npm run type-check
npm run lint
npm run build        # production build to app/dist
```

Layout: `app/src/tax` (pure tax engine), `app/src/extract` (slip reading), `app/src/pdf` (form filling),
`app/src/screens` (UI), `research/` (source PDFs and extraction scripts). Product brief: [PRODUCT.md](PRODUCT.md).

## Deploy

Static files only. See [DEPLOY.md](DEPLOY.md).

## Contributing, security, license

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [LICENSE](LICENSE) (source-available) ·
[THIRD_PARTY.md](THIRD_PARTY.md)

Made in Toronto by [Big Time](https://bigtimedesign.ca).
