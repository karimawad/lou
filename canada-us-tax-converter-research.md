# Research: Canadian-to-US Tax Document Conversion App

**Date:** October 3, 2026  
**Purpose:** Research existing apps/services that convert Canadian tax documents to US tax forms, delivering filled PDFs or detailed form instructions.

---

## TL;DR

No single consumer app purely converts Canadian tax slips into filled US PDFs automatically. The market splits into two categories: **full-service CPA firms** (you upload docs, they return completed PDF returns) and **self-service expat tax software** (you enter Canadian data, software generates US forms). There is a clear gap for an automated converter product.

---

## Category 1: Full-Service Platforms (CPA-Reviewed, Returns Delivered as PDF)

These services accept uploaded Canadian documents and produce completed, signed US returns.

### Greenback Expat Tax Services
- **URL:** greenbacktaxservices.com
- **What it does:** US-citizen-abroad specialist. You upload T4s, T3s, T5s via secure portal; a CPA maps them to Form 1040 + supporting schedules and delivers filled PDFs.
- **Canada specifics:** Dual-filing support (T1 + 1040), foreign tax credit optimization, RRSP treaty elections.
- **Cost:** ~$499 for federal 1040; add-ons for FBAR, state returns, Canadian T1.
- **Verdict:** Best polish and process for Americans living in Canada. Overkill if you just need the mapping logic.

### TaxesForExpats (TFX)
- **URL:** taxesforexpats.com
- **What it does:** Full-service CPA firm, strong Canada-specific guides. You upload documents; they produce completed US returns as downloadable PDFs.
- **Cost:** ~$350+ federal only.
- **Verdict:** Slightly cheaper than Greenback, similar quality.

### Cross-Border Financial Professional Corp (CBFPC)
- **URL:** cbfinpc.com
- **What it does:** Specializes exclusively in Canada-US cross-border. Prepares both T1 (Canadian) and 1040 (US) returns. Understands RRSP, TFSA, and treaty elections in depth.
- **Verdict:** Best for complex dual-resident situations or Canadians with US filing obligations.

### CBTA (Cross-Border Tax Accountants)
- **URL:** cbta.cpa
- **What it does:** CPA firm focused solely on Canada-US cross-border tax. Similar to CBFPC.

---

## Category 2: Self-Service Expat Tax Software (User Enters Data, Software Fills Forms)

These apps guide you through entering data from Canadian slips; they generate the US forms themselves.

### MyExpatTaxes
- **URL:** myexpattaxes.com
- **What it does:** Web app for US citizens abroad. You manually enter figures from Canadian slips; it maps to Form 1040, Form 1116 (Foreign Tax Credit), Form 2555 (FEIE), Form 8938 (FATCA), FBAR. Multi-currency built in.
- **Supported forms:** 50+ IRS forms.
- **Output:** Downloadable PDF of completed return.
- **Cost:** ~$189/year.
- **Canada gap:** No direct T4 import — you type the numbers in. But the guidance on where each box maps is clear.
- **Verdict:** Best self-service option for most Canada-US filers.

### Expatfile
- **URL:** expatfile.com
- **What it does:** Simpler, cheaper alternative to MyExpatTaxes. Covers Form 1040, 2555, 1116, 8938.
- **Cost:** ~$99 flat.
- **Verdict:** Good for straightforward cases (employment income only, no RRSP complexities).

### Sprintax
- **URL:** sprintax.com
- **What it does:** Best for **nonresidents** (students, temporary workers on F/J visas). Files Form 1040-NR + Form 8843.
- **Canada relevance:** Canadian residents temporarily in the US on visas would use this, not expats abroad.
- **Cost:** ~$50–$80.
- **Verdict:** Wrong tool if the user is a Canadian citizen with US obligations abroad; right tool for Canadian students/workers in the US on visas.

### TurboTax (US)
- **What it does:** Supports Form 1116 and Form 2555 in Deluxe/Premier/Self-Employed editions.
- **Limitation:** Does not support dual-status returns (1040 + 1040-NR attachment). Poor guidance for RRSP, TFSA, or Canadian-specific slips.
- **Verdict:** Usable for simple cases only; not recommended for anyone with Canadian retirement accounts or complex cross-border situations.

### TaxSlayer Pro (professional software)
- **URL:** taxslayerpro.com
- **What it does:** Tax professional software. Has a dedicated T4 / T4A-NR entry screen under Foreign Employer Compensation. Maps directly to Form 1040, Line 1.
- **Verdict:** Only accessible if you have a TaxSlayer Pro subscription (CPA/preparer tool, not consumer-facing).

---

## Category 3: Canadian Tax Software That Handles US Side (Limited)

No Canadian tax software (UFile, Wealthsimple Tax, GenuTax, TurboTax Canada) produces US IRS forms. They are CRA-only tools. The conversion must happen on the US side.

---

## The Gap: What Doesn't Exist Yet

There is **no app** that:
1. Accepts uploaded Canadian tax slips (T4, T3, T5, T4RSP, NOA) via OCR or PDF upload
2. Automatically maps Canadian fields to US form fields
3. Produces pre-filled, ready-to-sign US IRS PDFs

This is the product opportunity. The closest analog would be a mapping layer on top of IRS fillable PDFs or a direct-filing API (Sprintax/TaxSlayer infrastructure).

---

## Key Canadian → US Form Mappings

For anyone building this or needing manual instructions:

| Canadian Document | US Form | Mapping Notes |
|---|---|---|
| T4 Box 14 (employment income) | Form 1040, Line 1a | Convert CAD → USD at IRS annual average rate |
| T4 Box 22 (income tax withheld) | Form 1116 (foreign tax credit) | Reduces US tax owed |
| T4A (pension/other income) | Form 1040, Line 5b or Line 8 | Depends on income type |
| T4A-NR (non-resident payments) | Form 1040-NR | For non-residents only |
| T5 Box 10 (eligible dividends) | Schedule B, Part II | Convert CAD → USD |
| T5 Box 13 (interest) | Schedule B, Part I | Convert CAD → USD |
| T3 (trust/fund distributions) | Schedule B | Breakdown by income type |
| T4RSP (RRSP withdrawal) | Form 1040, Line 5b | Treated as pension income; gross up for CAD→USD |
| RRSP (no withdrawal) | Form 8891 (defunct) or treaty election via Form 8833 | Tax-deferred under Article XVIII of US-Canada treaty; must elect annually or it's taxable |
| TFSA | No direct US equivalent | IRS treats as a foreign trust — technically requires Forms 3520 & 3520-A; enforcement unclear but risk is real |
| Canadian federal+provincial tax paid | Form 1116 | Claim as foreign tax credit to offset US liability |
| Capital gains (T5008 or T3) | Schedule D + Form 8949 | Convert CAD → USD; US may tax gains Canada treats differently |
| NOA (Notice of Assessment) | Reference only | Useful for verifying Canadian tax paid figures for Form 1116 |

---

## Exchange Rate

IRS accepts: **annual average exchange rate** published by IRS (Revenue Procedure or IRS website) or the Bank of Canada rate. Most filers use the IRS average for the tax year.

For 2025 tax year: ~1 CAD = ~0.72 USD (approximate — verify with IRS published rate before using).

---

## Recommended Approach for a New App

1. **Input:** Upload Canadian slips as PDF or image; OCR extracts box numbers and values.
2. **Mapping engine:** Apply the table above; flag edge cases (TFSA, RRSP elections, dual-status).
3. **Output options:**
   - **Option A:** Filled IRS PDF forms (use IRS fillable PDFs or pdf-lib/PDFKit to fill programmatically).
   - **Option B:** Step-by-step instructions ("Enter $X on Form 1040, Line 1a; enter $Y on Schedule B...").
4. **Currency conversion:** Auto-apply IRS annual average rate for the tax year.
5. **Out of scope for v1:** TFSA foreign trust reporting, dual-status returns, FBAR (FinCEN 114), FATCA (Form 8938) — these require legal/CPA review.

---

## Sources

- [US-Canada Tax Treaty Guide 2026 — TaxesForExpats](https://www.taxesforexpats.com/country-guides/canada/us-canada-tax-treaty.html)
- [How to Report T4 on US Tax Return — SAL Accounting](https://salaccounting.ca/blog/report-t4-us-taxes/)
- [How to Report Canadian Income on US Return — SAL Accounting](https://salaccounting.ca/blog/report-canadian-income-us-tax-return/)
- [Entering T4 & T4A-NR in TaxSlayer Pro Desktop](https://support.taxslayerpro.com/hc/en-us/articles/4404231063194-Desktop-Entering-Canadian-Income-Form-T4-T4A-NR)
- [Entering T4 & T4A-NR in TaxSlayer ProWeb](https://support.taxslayerpro.com/hc/en-us/articles/4404231506970-ProWeb-Entering-Canadian-Income-Form-T4-T4A-NR)
- [Best Tax Software for US Expats 2026 — SavvyNomad](https://blog.savvynomad.io/best-tax-software-for-us-expats/)
- [MyExpatTaxes vs Expatfile Comparison](https://www.myexpattaxes.com/expat-tax-tips/expat-news/myexpattaxes-vs-expatfile-which-expat-tax-software-is-right-for-you/)
- [How to File US Tax Returns in Canada — Beacon Hill WM](https://beaconhillwm.ca/how-to-file-us-tax-returns-in-canada/)
- [Greenback: US Expat Tax Guide for Canada](https://www.greenbacktaxservices.com/country-guide/us-expat-taxes-in-canada/)
- [Greenback: Filing Both US and Canada Returns — Process FAQ](https://www.greenbacktaxservices.com/faq/what-is-process-filing-both-my-us-canada-expat-tax-returns/)
- [Sprintax: Nonresident Federal Tax E-Filing](https://www.sprintax.com/returns/)
- [CBFPC: Cross-Border Tax Service](https://cbfinpc.com/)
- [CBTA: Cross-Border Tax Accountants](https://cbta.cpa/)
