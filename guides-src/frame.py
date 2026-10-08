"""Page frame for Lou's guides and FAQ. Content lives in pages_*.py; build.py writes the files."""
import json, html

SITE = "https://lou.bigtimedesign.ca"   # change once, rebuild, when the new domain is live
UPDATED_ISO = "2026-10-06"
UPDATED_TXT = "Oct 2026"
ORG = {"@type": "Organization", "name": "Big Time Design and Communication Inc.", "url": "https://bigtimedesign.ca"}
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
COLORS = ["c1", "c2", "c3", "c4"]

def esc(s):
    return html.escape(s, quote=True)

def lines(rows, head=None):
    """rows: (key, label, small, value, kind) where kind 'n' = amount, 't' = text."""
    out = ['<div class="lines">']
    if head:
        out.append('<div class="hd" aria-hidden="true"><span></span><span>%s</span><span>%s</span></div>' % head)
    for k, d, small, v, kind in rows:
        sm = f"<small>{small}</small>" if small else ""
        cls = "v t" if kind == "t" else "v"
        out.append(f'<div class="ln"><span class="k">{k}</span><span class="d">{d}{sm}</span><span class="{cls}">{v}</span></div>')
    out.append("</div>")
    return "\n".join(out)

def lou(title, body):
    return f'<aside class="lou" aria-label="How Lou handles it"><span class="n" aria-hidden="true">L</span><div class="b"><h3>{title}</h3>{body}</div></aside>'

def warn(body):
    return f'<div class="warn">{body}</div>'

def table(head, rows):
    th = "".join(f'<th scope="col">{h}</th>' for h in head)
    trs = []
    for r in rows:
        trs.append("<tr><th scope=\"row\">%s</th>%s</tr>" % (r[0], "".join(f"<td>{c}</td>" for c in r[1:])))
    return f'<div class="tblwrap"><table class="tbl"><thead><tr>{th}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>'

def sections(secs):
    out = []
    for i, (title, body) in enumerate(secs):
        sid = title.lower()
        sid = "".join(ch if ch.isalnum() else "-" for ch in sid).strip("-")
        while "--" in sid: sid = sid.replace("--", "-")
        out.append(f'<section class="sec" id="{sid}" aria-labelledby="{sid}-h"><div class="part {COLORS[i % 4]}"><b>Part {ROMAN[i]}</b><h2 id="{sid}-h">{title}</h2></div><div class="body">{body}</div></section>')
    return "\n".join(out)

def sources(items):
    lis = "".join(f'<li><a href="{u}">{t}</a>{(" " + n) if n else ""}</li>' for t, u, n in items)
    return f'<ol class="src">{lis}</ol>'

def related(slugs, guides):
    lis = "".join(f'<li><a href="/guides/{s}/">{guides[s]["short"]}</a></li>' for s in slugs)
    return f'<ul class="related">{lis}</ul>'

NAV_ITEMS = [("/guides/", "Guides"), ("/blog/", "Blog"), ("/faq/", "FAQ"), ("/guides/catch-up-filing/", "Catch up")]

def nav(active):
    links = []
    for href, label in NAV_ITEMS:
        cur = ' aria-current="page"' if href == active else ""
        cls = ' class="opt"' if href == "/guides/catch-up-filing/" else ""
        links.append(f'<a href="{href}"{cur}{cls}>{label}</a>')
    return ('<nav class="topnav" aria-label="Main"><a class="lg" href="/">Lou</a>' + "".join(links)
            + '<a class="go-btn" href="/app/">Start with Lou &middot; $49</a></nav>')

FOOT = ('<footer class="foot"><p>Lou is a tax-preparation tool, not a substitute for individualized professional tax advice. '
        'These guides explain general rules for US citizens and green card holders who live in Canada; they are not advice for your situation. '
        'Not affiliated with the IRS or the CRA.</p>'
        '<nav aria-label="About Lou"><a href="/guides/">Guides</a><a href="/blog/">Blog</a><a href="/faq/">FAQ</a><a href="/legal/terms.html">Terms</a>'
        '<a href="/legal/privacy.html">Privacy</a><a href="/legal/notices.html">Notices</a><a href="/support/">Report a problem</a>'
        '<a href="mailto:info@bigtimedesign.ca">Contact</a></nav>'
        '<span>&copy; 2026 Big Time Design and Communication Inc.</span></footer>')

def final(line1, line2, note):
    return (f'<div class="final"><div><div class="tl">{line1}<span>{line2}</span></div><p>{note}</p></div>'
            '<a class="cta" href="/app/">Start with Lou &middot; $49<i aria-hidden="true">&rarr;</i></a></div>')

DEFAULT_FINAL = final("Already did your Canadian taxes?", "Let Lou do the US paperwork.",
                      "Free to try. $49 CAD plus tax covers your 2023, 2024 and 2025 returns; each new tax year after that is $49. Your documents stay on your device.")

def page(*, path, title, h1, description, code, kicker, lede, body, crumbs, schema_extra=None, final_html=None, active=None, og_type="article",
         published=None, modified=None, right=None, og_image=None, head_extra="", schema_type="Article", body_end=""):
    url = SITE + path
    ld = [{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + h} for i, (n, h) in enumerate(crumbs)],
    }]
    if og_type == "article":
        art = {"@context": "https://schema.org", "@type": schema_type, "headline": h1, "description": description,
               "url": url, "mainEntityOfPage": url, "dateModified": modified or published or UPDATED_ISO,
               "datePublished": published or UPDATED_ISO, "inLanguage": "en", "author": ORG, "publisher": ORG}
        if og_image:
            art["image"] = og_image if og_image.startswith("http") else SITE + og_image
        ld.append(art)
    if schema_extra:
        ld.extend(schema_extra)
    ld_html = "\n".join('<script type="application/ld+json">%s</script>' % json.dumps(x, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") for x in ld)
    right_label, right_value = right or ("Updated", UPDATED_TXT)
    image = og_image or "/icons/icon-512.png"
    image = image if image.startswith("http") else SITE + image
    card = "summary_large_image" if og_image else "summary"
    crumb_html = "".join(f'<li><a href="{h}">{n}</a></li>' if i < len(crumbs) - 1 else f'<li aria-current="page">{n}</li>' for i, (n, h) in enumerate(crumbs))
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}" />
<link rel="canonical" href="{url}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="preload" href="/guides/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/guides/guides.css" />
<meta property="og:type" content="{og_type}" />
<meta property="og:site_name" content="Lou" />
<meta property="og:title" content="{esc(h1)}" />
<meta property="og:description" content="{esc(description)}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{image}" />
<meta name="twitter:card" content="{card}" />
<meta name="twitter:title" content="{esc(h1)}" />
<meta name="twitter:description" content="{esc(description)}" />
{head_extra}
{ld_html}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="stage">
<div class="sheet">
<div class="ribbon" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
{nav(active or path)}
<header class="head">
  <div class="l"><div class="fn">{kicker}<b>{code}</b></div></div>
  <div class="m"><span class="dot d1" aria-hidden="true"></span><span class="dot d2" aria-hidden="true"></span><h1>{h1}</h1><p class="lede">{lede}</p></div>
  <div class="r"><small>{right_label}</small><b>{right_value}</b></div>
</header>
<nav class="crumbs" aria-label="Breadcrumb"><ol>{crumb_html}</ol></nav>
<main id="main">
{body}
</main>
{final_html or DEFAULT_FINAL}
{FOOT}
</div>
</div>
{body_end}
</body>
</html>
"""

def guide_body(short, secs, lou_html, srcs, rel):
    short_html = f'<div class="short"><span class="n" aria-hidden="true">Short answer</span><div class="b">{short}</div></div>'
    parts = list(secs)
    parts.append(("How Lou handles it", lou_html))
    parts.append(("Sources and related guides", srcs + "<h3>Related guides</h3>" + rel))
    return short_html + sections(parts)
