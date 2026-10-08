"""Lou blog: posts are Markdown files in guides-src/posts/*.md, built into app/public/blog/ by build.py.

Post file = front matter, a blank line, then the body:

    ---
    title: The headline
    slug: url-friendly-name        (optional, defaults to the file name without a leading date)
    date: 2026-10-08               (YYYY-MM-DD)
    updated: 2026-10-20            (optional)
    description: One sentence for search results and link previews (under 160 characters).
    summary: Optional short answer shown in the shaded box at the top. Defaults to the description.
    tags: Privacy, Product
    image: /blog/images/name.png   (optional, 1200x630: makes a large link preview)
    draft: true                    (optional: skipped by the build)
    ---

Body: `## Heading` starts a numbered part, `###` a sub-heading, `- ` and `1. ` lists, `> ` quote, **bold**, *italic*, `code`,
[links](url). `:::lou Title` ... `:::` makes a Lou box, `:::warn` ... `:::` a red-edged warning. Lines starting with `<` pass through.
Text before the first `##` shows under the summary box.
"""
import os, re, html as H, datetime as dt
from urllib.parse import quote
from frame import page, sections, esc, SITE, ORG, COLORS

HERE = os.path.dirname(os.path.abspath(__file__))
POSTS_DIR = os.path.join(HERE, "posts")
BANNED = ["—", "seamless", "leverage", "unlock", "elevate", "robust", "delve"]   # CLAUDE.md writing rule
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
NUL = chr(0)


def date_txt(iso):
    d = dt.date.fromisoformat(iso)
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def rfc822(iso):
    d = dt.date.fromisoformat(iso)
    return d.strftime("%a, %d %b %Y") + " 12:00:00 +0000"


# ------------------------------------------------------------------ markdown
def inline(t):
    codes = []

    def keep(m):
        codes.append(f"<code>{H.escape(m.group(1), quote=False)}</code>")
        return f"{NUL}{len(codes) - 1}{NUL}"

    t = re.sub(r"`([^`]+)`", keep, t)
    t = H.escape(t, quote=False)

    def link(m):
        url = m.group(2)
        ext = ' rel="noopener"' if url.startswith("http") and not url.startswith(SITE) else ""
        return f'<a href="{url}"{ext}>{m.group(1)}</a>'

    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    return re.sub(NUL + r"(\d+)" + NUL, lambda m: codes[int(m.group(1))], t)


def blocks(lines):
    """Markdown lines -> list of HTML blocks (## headings are split out before this)."""
    out, buf, i = [], [], 0

    def para():
        nonlocal buf
        if buf:
            out.append(f"<p>{inline(' '.join(buf))}</p>")
        buf = []

    while i < len(lines):
        s = lines[i].strip()
        if not s:
            para(); i += 1; continue
        m = re.match(r"^:::(lou|warn)\s*(.*)$", s)
        if m:
            para()
            j, inner = i + 1, []
            while j < len(lines) and lines[j].strip() != ":::":
                inner.append(lines[j]); j += 1
            body = "".join(blocks(inner))
            if m.group(1) == "lou":
                out.append(f'<aside class="lou" aria-label="Lou"><span class="n" aria-hidden="true">L</span><div class="b"><h3>{inline(m.group(2) or "From Lou")}</h3>{body}</div></aside>')
            else:
                out.append(f'<div class="warn">{body}</div>')
            i = j + 1; continue
        if s.startswith("<"):
            para(); out.append(s); i += 1; continue
        if s.startswith("### "):
            para(); out.append(f"<h3>{inline(s[4:])}</h3>"); i += 1; continue
        if re.match(r"^(-|\*) ", s) or re.match(r"^\d+\. ", s):
            para()
            ordered = bool(re.match(r"^\d+\. ", s))
            items = []
            while i < len(lines) and re.match(r"^(-|\*|\d+\.) ", lines[i].strip()):
                items.append(re.sub(r"^(-|\*|\d+\.) ", "", lines[i].strip())); i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue
        if s.startswith(">"):
            para()
            q = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q.append(lines[i].strip().lstrip(">").strip()); i += 1
            out.append(f"<blockquote><p>{inline(' '.join(q))}</p></blockquote>")
            continue
        buf.append(s); i += 1
    para()
    return out


def split_parts(body):
    """-> (intro_lines, [(title, lines)]) split on `## `."""
    intro, parts, cur = [], [], None
    for ln in body.splitlines():
        if ln.startswith("## "):
            cur = (ln[3:].strip(), [])
            parts.append(cur)
        elif cur is None:
            intro.append(ln)
        else:
            cur[1].append(ln)
    return intro, parts


# ------------------------------------------------------------------ posts
def load_posts():
    posts = []
    if not os.path.isdir(POSTS_DIR):
        return posts
    for name in sorted(os.listdir(POSTS_DIR)):
        if not name.endswith(".md"):
            continue
        raw = open(os.path.join(POSTS_DIR, name), encoding="utf-8").read().replace("\r\n", "\n")
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
        if not m:
            raise SystemExit(f"blog: {name} has no front matter")
        meta = {}
        for ln in m.group(1).splitlines():
            if ":" in ln:
                k, v = ln.split(":", 1)
                meta[k.strip()] = v.strip()
        if meta.get("draft", "").lower() == "true":
            continue
        for need in ("title", "date", "description"):
            if not meta.get(need):
                raise SystemExit(f"blog: {name} is missing '{need}'")
        dt.date.fromisoformat(meta["date"])
        body = m.group(2).strip()
        low = raw.lower()
        for bad in BANNED:
            if bad in low:
                raise SystemExit(f"blog: {name} contains '{bad}' (writing rule in CLAUDE.md)")
        if len(meta["description"]) > 170:
            print(f"blog: {name} description is {len(meta['description'])} characters; search results cut near 160")
        slug = meta.get("slug") or re.sub(r"^\d{4}-\d{2}-\d{2}-", "", name[:-3])
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
            raise SystemExit(f"blog: slug '{slug}' must be lowercase letters, numbers and hyphens")
        words = len(re.findall(r"\w+", body))
        posts.append(dict(meta, slug=slug, body=body, minutes=max(1, round(words / 220)),
                          tags=[t.strip() for t in meta.get("tags", "").split(",") if t.strip()]))
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    slugs = [p["slug"] for p in posts]
    if len(set(slugs)) != len(slugs):
        raise SystemExit("blog: two posts share a slug")
    return posts


def share_block(url, title):
    u, t = quote(url, safe=""), quote(title, safe="")
    links = [
        ("X", f"https://twitter.com/intent/tweet?text={t}&amp;url={u}"),
        ("LinkedIn", f"https://www.linkedin.com/sharing/share-offsite/?url={u}"),
        ("Facebook", f"https://www.facebook.com/sharer/sharer.php?u={u}"),
        ("Bluesky", f"https://bsky.app/intent/compose?text={quote(title + ' ' + url, safe='')}"),
        ("Reddit", f"https://www.reddit.com/submit?url={u}&amp;title={t}"),
        ("Email", f"mailto:?subject={t}&amp;body={quote(title + chr(10) + url, safe='')}"),
    ]
    a = "".join(
        f'<a href="{h}" target="_blank" rel="noopener noreferrer" aria-label="Share on {n}">{n}</a>' if n != "Email"
        else f'<a href="{h}" aria-label="Share by email">{n}</a>' for n, h in links)
    return (f'<aside class="share" aria-label="Share this article" data-url="{esc(url)}" data-title="{esc(title)}">'
            f'<b>Share</b><div class="row">{a}'
            '<button type="button" class="native" hidden>Share&hellip;</button>'
            '<button type="button" class="copy">Copy link</button></div>'
            '<span class="status" role="status" aria-live="polite"></span></aside>')


def tag_chips(tags):
    return "".join(f"<span>{esc(t)}</span>" for t in tags)


def build_post(p, posts, write, urls):
    path = f"/blog/{p['slug']}/"
    url = SITE + path
    intro, parts = split_parts(p["body"])
    intro_html = "".join(blocks(intro))
    summary = p.get("summary") or p["description"]
    short = f'<div class="short"><span class="n" aria-hidden="true">In short</span><div class="b"><p>{inline(summary)}</p></div></div>'
    if parts:
        body = sections([(inline(title), "".join(blocks(lines))) for title, lines in parts])
        # a link to each section, so one part of a post can be shared
        body = re.sub(r'<h2 id="([^"]+)">(.*?)</h2>',
                      lambda m: f'<h2 id="{m.group(1)}">{m.group(2)}<a class="anchor" href="#{m.group(1)}" aria-label="Link to this section">#</a></h2>', body)
    else:
        body = ""
    lead = f'<div class="byline"><span>{date_txt(p["date"])}</span><span>{p["minutes"]} min read</span>{tag_chips(p["tags"])}</div>'
    intro_block = f'<div class="intro">{intro_html}</div>' if intro_html.strip() else ""
    others = [o for o in posts if o["slug"] != p["slug"]][:3]
    more = ""
    if others:
        more = ('<section class="sec"><div class="part c3"><b>More</b><h2>More from the Lou blog</h2></div><div class="body"><ul class="related">'
                + "".join(f'<li><a href="/blog/{o["slug"]}/">{esc(o["title"])}</a></li>' for o in others) + "</ul></div></section>")
    head_extra = (f'<meta property="article:published_time" content="{p["date"]}" />\n'
                  f'<meta property="article:modified_time" content="{p.get("updated") or p["date"]}" />\n'
                  + "".join(f'<meta property="article:tag" content="{esc(t)}" />\n' for t in p["tags"])
                  + '<link rel="alternate" type="application/rss+xml" title="Lou blog" href="/blog/feed.xml" />')
    full = lead + short + intro_block + body + share_block(url, p["title"]) + more
    write(path, page(path=path, title=f"{p['title']} · Lou", h1=esc(p["title"]), description=p["description"], code="Blog", kicker="Lou blog",
                     lede=esc(p["description"]), body=full, crumbs=[("Lou", "/"), ("Blog", "/blog/"), (p["title"], path)],
                     active="/blog/", published=p["date"], modified=p.get("updated"), schema_type="BlogPosting",
                     right=("Published", date_txt(p["date"])), og_image=p.get("image"), head_extra=head_extra,
                     body_end='<script src="/blog/share.js" defer></script>'))
    urls.append((path, p.get("updated") or p["date"]))


def build_index(posts, write, urls):
    if posts:
        rows = []
        for i, p in enumerate(posts):
            rows.append(
                f'<a class="post" href="/blog/{p["slug"]}/"><span class="k {COLORS[i % 4]}"><b>{date_txt(p["date"]).split(",")[0]}</b><small>{p["date"][:4]}</small></span>'
                f'<span class="b"><b>{esc(p["title"])}</b><span>{esc(p["description"])}</span>'
                f'<em>{p["minutes"]} min read</em><span class="tags">{tag_chips(p["tags"])}</span></span></a>')
        listing = f'<nav class="posts" aria-label="Articles">{"".join(rows)}</nav>'
    else:
        listing = ('<div class="short"><span class="n" aria-hidden="true">Soon</span><div class="b"><p>The first articles are on their way. '
                   'In the meantime, the <a href="/guides/">guides</a> cover how each Canadian account is treated on a US return.</p></div></div>')
    intro = ('<div class="short"><span class="n" aria-hidden="true">About</span><div class="b">'
             '<p>Notes from the people building Lou: what we learn about US taxes for Americans in Canada, and how Lou works. '
             'For step-by-step explanations of each account and slip, see the <a href="/guides/">guides</a>.</p>'
             '<p><a href="/blog/feed.xml">Subscribe with RSS</a></p></div></div>')
    ld = [{"@context": "https://schema.org", "@type": "Blog", "name": "Lou blog", "url": SITE + "/blog/", "publisher": ORG,
           "blogPost": [{"@type": "BlogPosting", "headline": p["title"], "url": f'{SITE}/blog/{p["slug"]}/', "datePublished": p["date"]} for p in posts]}]
    write("/blog/", page(path="/blog/", title="Lou blog: US taxes for Americans living in Canada", h1="The Lou blog", code="Blog", kicker="Form LOU",
          description="Articles on US taxes for Americans living in Canada, and on how Lou turns Canadian tax slips into a US return without your documents leaving your device.",
          lede="US taxes for Americans in Canada, and how Lou works.", body=intro + listing, crumbs=[("Lou", "/"), ("Blog", "/blog/")],
          schema_extra=ld, og_type="website", active="/blog/", right=("Articles", str(len(posts))),
          head_extra='<link rel="alternate" type="application/rss+xml" title="Lou blog" href="/blog/feed.xml" />'))
    urls.insert(0, ("/blog/", (posts[0].get("updated") or posts[0]["date"]) if posts else None))


def feed(posts):
    items = []
    for p in posts[:20]:
        url = f'{SITE}/blog/{p["slug"]}/'
        items.append(f'<item><title>{esc(p["title"])}</title><link>{url}</link><guid isPermaLink="true">{url}</guid>'
                     f'<pubDate>{rfc822(p["date"])}</pubDate><description>{esc(p["description"])}</description>'
                     + "".join(f"<category>{esc(t)}</category>" for t in p["tags"]) + "</item>")
    last = rfc822(posts[0]["date"]) if posts else rfc822(dt.date.today().isoformat())
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
            f'<title>Lou blog</title><link>{SITE}/blog/</link><description>US taxes for Americans living in Canada, and how Lou works.</description>'
            f'<language>en</language><lastBuildDate>{last}</lastBuildDate><atom:link href="{SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>'
            + "".join(items) + "</channel></rss>\n")


def build_all(write, urls):
    posts = load_posts()
    for p in posts:
        build_post(p, posts, write, urls)
    build_index(posts, write, urls)
    write("/blog/feed.xml", feed(posts))
    return posts
