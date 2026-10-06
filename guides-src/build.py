"""Builds Lou's guides and FAQ straight into app/public. Run from anywhere: python guides-src/build.py"""
import os, re, shutil, json, html as H
LF = chr(10)
import frame
from frame import page, guide_body, related, SITE, UPDATED_ISO, esc, sections, final
from registry import GUIDES
import pages_accounts, pages_topics, pages_core

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "app", "public")
FONTS_SRC = os.environ.get("LOU_FONTS", os.path.join(HERE, "..", "app", "src", "fonts"))

def write(path, text):
    full = os.path.join(OUT, path.lstrip("/"), "index.html") if path.endswith("/") else os.path.join(OUT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline=LF) as f:
        f.write(text)

def plain(h):
    t = re.sub(r"<[^>]+>", "", h)
    return H.unescape(re.sub(r"\s+", " ", t)).strip()

urls = []

def guide(p):
    g = GUIDES[p["slug"]]
    path = f"/guides/{p['slug']}/"
    body = guide_body(p["short"], p["secs"], p["lou_html"], pages_accounts.src(*p["srcs"]), related(p["rel"], GUIDES))
    write(path, page(path=path, title=p["title"], h1=p["h1"], description=p["description"], code=g["code"], kicker="Lou guide",
                     lede=p["lede"], body=body, crumbs=[("Lou", "/"), ("Guides", "/guides/"), (g["short"], path)],
                     final_html=p.get("final_html"), active="/guides/catch-up-filing/" if p["slug"] == "catch-up-filing" else "/guides/"))
    urls.append(path)

for p in [pages_core.CATCHUP] + pages_accounts.PAGES + pages_topics.PAGES:
    guide(p)

# ---------------------------------------------------------------- guides index
cards = []
for slug, g in GUIDES.items():
    wide = " wide" if slug == "catch-up-filing" else ""
    cards.append(f'<a class="card{wide}" href="/guides/{slug}/"><span class="k">{g["code"]}</span><span class="b"><b>{g["short"]}</b><span>{g["card"]}</span></span></a>')
index_body = ('<div class="short"><span class="n" aria-hidden="true">Start here</span><div class="b">'
              '<p>If you are a US citizen or green card holder living in Canada, you file a US return every year on top of your Canadian one. '
              'These guides explain how each Canadian account, slip and benefit is treated on that return, in plain language, with the official sources linked.</p>'
              '<p>Never filed before? Start with <a href="/guides/catch-up-filing/">Catching up on missed years</a>. Quick questions about Lou itself are in the <a href="/faq/">FAQ</a>.</p></div></div>'
              f'<div class="part c1"><b>Index</b><h2>Guides for Americans in Canada</h2></div><nav class="cards" aria-label="Guides">{"".join(cards)}</nav>')
itemlist = {"@context": "https://schema.org", "@type": "ItemList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": f"{SITE}/guides/{s}/", "name": g["short"]} for i, (s, g) in enumerate(GUIDES.items())]}
write("/guides/", page(path="/guides/", title="US tax guides for Americans living in Canada · Lou",
      h1="US tax guides for Americans in Canada",
      description="Plain-language guides to US taxes for Americans living in Canada: TFSA, RRSP, FBAR, Form 8938, PFICs, CPP and OAS, the foreign tax credit, exchange rates and catching up.",
      code="Index", kicker="Lou guides", lede="Everything a Canadian return doesn't tell you about the US one, one topic at a time.",
      body=index_body, crumbs=[("Lou", "/"), ("Guides", "/guides/")], schema_extra=[itemlist], og_type="website"))
urls.insert(0, "/guides/")

# ---------------------------------------------------------------- FAQ
toc, blocks, qa = [], [], []
for gi, (group, items) in enumerate(pages_core.FAQ):
    gid = "".join(ch if ch.isalnum() else "-" for ch in group.lower()).strip("-")
    toc.append(f'<li><a href="#{gid}">{group}</a></li>')
    qs = []
    for q, a in items:
        qid = re.sub(r"-+", "-", "".join(ch if ch.isalnum() else "-" for ch in q.lower())).strip("-")[:60]
        qs.append(f'<div class="faq" id="{qid}"><h3>{q}</h3>{a}</div>')
        qa.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(a)}})
    blocks.append(f'<section id="{gid}" aria-labelledby="{gid}-h"><div class="part {frame.COLORS[gi % 4]}"><b>Part {frame.ROMAN[gi]}</b><h2 id="{gid}-h">{group}</h2></div>{"".join(qs)}</section>')
faq_body = ('<div class="short"><span class="n" aria-hidden="true">Quick</span><div class="b"><p>Short answers about Lou and US filing from Canada. '
            'For the tax details, see the <a href="/guides/">guides</a>.</p></div></div>'
            f'<nav class="toc" aria-label="FAQ sections"><ol>{"".join(toc)}</ol></nav>' + "".join(blocks))
faqld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": qa}
write("/faq/", page(path="/faq/", title="Lou FAQ: US taxes from Canada, privacy, price and filing · Lou",
      h1="Questions about Lou", code="FAQ", kicker="Form LOU",
      description="Answers about Lou, the app that turns your Canadian tax return into a draft US return: who it's for, privacy, price, filing from Canada and catching up.",
      lede="Who Lou is for, where your documents go, what it costs, and how filing from Canada works.",
      body=faq_body, crumbs=[("Lou", "/"), ("FAQ", "/faq/")], schema_extra=[faqld], og_type="website"))
urls.insert(1, "/faq/")

# ---------------------------------------------------------------- assets, sitemap
os.makedirs(os.path.join(OUT, "guides", "fonts"), exist_ok=True)
if os.path.isdir(FONTS_SRC):
  for f in os.listdir(FONTS_SRC):
    if f.endswith((".woff2", ".txt")):
      shutil.copy(os.path.join(FONTS_SRC, f), os.path.join(OUT, "guides", "fonts", f))

existing = ["/", "/legal/terms.html", "/legal/privacy.html", "/legal/notices.html"]
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in existing + urls:
    lm = f"<lastmod>{UPDATED_ISO}</lastmod>" if u not in existing[1:] else ""
    sm.append(f"  <url><loc>{SITE}{u}</loc>{lm}</url>")
sm.append("</urlset>")
shutil.copy(os.path.join(HERE, "guides.css"), os.path.join(OUT, "guides", "guides.css"))
with open(os.path.join(OUT, "sitemap.xml"), "w", newline=LF) as f:
    f.write("\n".join(sm) + "\n")
print("built", len(urls), "pages")
