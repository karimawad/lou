# Third-party software

Lou ships these packages. Each is used under its own license; the full license text is in the package.

| Package | Use | License |
| --- | --- | --- |
| React, React DOM | User interface | MIT |
| pdf-lib | Filling the official IRS PDFs | MIT |
| pdfjs-dist (pdf.js) | Reading PDF slips | Apache-2.0 |
| tesseract.js, tesseract.js-core | Reading photos and scans (OCR) | Apache-2.0 |
| Tesseract English language data (`eng.traineddata`) | OCR | Apache-2.0 |
| JSZip | Backup and package files | MIT or GPL-3.0-or-later (Lou uses it under MIT) |

Official IRS forms and instructions (`app/public/forms/`, `research/irs-pdfs/`, `research/instr/`) are US government
works and are in the public domain. Bank of Canada exchange rates (`app/src/tax/data/boc-usdcad.json`) come from the
Bank of Canada's published Valet data. IRS interest rates come from the published Revenue Rulings.

Dev tools (Vite, Vitest, TypeScript, Playwright, oxlint) are not shipped to users.
