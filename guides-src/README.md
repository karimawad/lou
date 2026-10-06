# Guides and FAQ source

Static pages (no JavaScript) in the Form LOU look. Edit the text here, then run `python guides-src/build.py` from the repo root. It writes
`app/public/faq/`, `app/public/guides/` (pages, `guides.css`, font copies from `app/src/fonts`) and `app/public/sitemap.xml`.

- Text: `pages_core.py` (catch-up guide and FAQ), `pages_accounts.py`, `pages_topics.py`. Sources: `srcs.py`. Page frame: `frame.py`. Styles: `guides.css`.
- Domain: change `SITE` in `frame.py` and rebuild.
- Keep in sync with the app: prices, the catch-up guide ("Which years apply right now" is dated; the app works the years out from today), exchange rate tables (add 2026 when published), the FAQ answers repeated on the home page (`app/index.html`, Part V).
