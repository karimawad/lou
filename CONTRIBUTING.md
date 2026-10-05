# Contributing

Thanks for helping. Lou is source-available (see `LICENSE`). By sending a contribution you agree to the grant in the
license, section "You may" item 3.

## Ground rules

1. **Nothing leaves the device.** No backend, no cloud OCR, no LLM API, no analytics, no third-party scripts or fonts.
2. **Cite a primary source.** Every tax constant or mapping needs an IRS or CRA source (form, instructions, publication,
   Revenue Procedure). Say which in the pull request. If a rule is uncertain, the app flags it instead of guessing.
3. **Tests against IRS numbers.** Never change a fixture in `app/src/tax/__fixtures__/` to make a test pass. Fixtures are
   parsed from the official IRS instructions.
4. **No Tailwind.** Plain CSS with the tokens in `app/src/index.css`.
5. **Writing.** Plain language for non-technical people first. No em dashes. Technical detail goes in "Advanced" sections.
6. **Not a preparer.** No "guarantee" language, and every output keeps its review reminder.

## Setup

```
cd app
npm ci
npm run dev
```

Before opening a pull request, all of these must pass from `app/`:

```
npm run type-check
npm run lint
npm test
npm run build
```

Never put real tax documents, SSNs or SINs in an issue, test or fixture. Use made-up data.
