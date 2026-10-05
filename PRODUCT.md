# Product

## Register

product

## Users

US citizens, dual citizens and green card holders who live in Canada and must file a US return every year on top of their Canadian one. Many are not tax people: young families with Canadian salaries, retirees drawing CPP and RRIF payments, people catching up on years they didn't know they had to file. They arrive with a folder of CRA slips (T4, T5, T3, T4RSP, NOA) as PDFs or phone photos, mild dread, and limited patience. The job: turn those Canadian slips into a correct, signable US return without paying a cross-border accountant $500+.

## Product Purpose

Lou reads Canadian tax slips on the user's own device, converts them to US dollars, computes the US return (Form 1040, foreign tax credit, child tax credit, FEIE comparison), and fills the official IRS PDFs. A line-by-line mapping guide (which Canadian box goes on which US line, and why) is the fallback when anything needs manual entry. Success: a user finishes in one sitting, understands every number, and mails a return that is right.

## Brand Personality

Calm, exact, reassuring. A careful friend who happens to know cross-border tax: quiet confidence, plain words, shows its work, never hides a judgment call. References: Stripe Docs for clarity of explanation, Linear for precision and restraint, Wealthsimple Tax for approachable warmth. Emotional goal: dread at the start, relief at the end.

## Anti-references

- TurboTax-style upsell flows: no upgrade banners, no dark patterns, no confetti, no fake urgency.
- Generic AI/SaaS look: no purple gradients, glass cards, hero-metric templates, identical icon-card grids.
- Government-form coldness: Lou explains, it doesn't just collect fields.

## Design Principles

1. **Show the work.** Every US number links back to the Canadian slip box and the rule that moved it. No black boxes.
2. **Nothing leaves the device, and the UI says so.** Privacy is a visible feature, not a footer line.
3. **One question at a time.** Ask only what changes the return, in plain words, with a sensible default.
4. **Flag, never guess.** When a rule is uncertain (PFICs, CPP treaty position), say so clearly and route it to the guide.
5. **Familiar over clever.** Standard controls and layouts; the tool disappears into the task.

## Accessibility & Inclusion

Baseline WCAG 2.1 AA: 4.5:1 text contrast, full keyboard use, visible focus, labelled inputs, reduced-motion respected. Amounts use tabular figures. Bilingual slip labels (EN/FR) shown as printed by CRA.
