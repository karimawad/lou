# Deploying Lou

Lou is static files. There is no server code, no database and no secrets. Hosting is `app/dist/` behind HTTPS.

Target: **https://lou.bigtimedesign.ca** on the Hostinger VPS (OpenLiteSpeed), same server as MTGSL.

## One-time setup

1. **DNS.** In Hostinger DNS for bigtimedesign.ca, add an `A` record: `lou` pointing to the VPS IP.
2. **Folder.** On the VPS: `sudo mkdir -p /var/www/lou && sudo chown $USER /var/www/lou`.
3. **OpenLiteSpeed WebAdmin (port 7080).**
   - Virtual Hosts, Add: name `Lou`, root `/var/www/lou`, config `$SERVER_ROOT/conf/vhosts/$VH_NAME/vhconf.conf`.
   - General: Document Root `$VH_ROOT/`, domain `lou.bigtimedesign.ca`, Index Files `index.html`.
   - Error pages: 404 maps to `/404.html`.
   - Listeners: on the 80 and 443 listeners, add a mapping for `Lou` / `lou.bigtimedesign.ca`.
   - SSL: issue a Let's Encrypt certificate for `lou.bigtimedesign.ca` (WebAdmin, or `certbot`), then force HTTPS with a rewrite
     rule `RewriteCond %{HTTPS} !on` then `RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]`.
   - MIME: make sure `.webmanifest` is `application/manifest+json` and `.wasm` is `application/wasm`.
4. **Headers.** OpenLiteSpeed does not read `app/public/_headers`. Copy its rules into the vhost (Context `/`, "Extra Headers"):
   - `/sw.js`, `/index.html`, `/` and `/manifest.webmanifest`: `Cache-Control: no-cache`. If these are cached for long, updates reach people late.
   - `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`.
   - Everywhere: the security headers listed in `_headers` (HSTS, nosniff, referrer policy, frame denial, permissions policy, CSP).
5. **Check.** `curl -sI https://lou.bigtimedesign.ca/sw.js` shows `no-cache`; the page loads; the browser console shows no CSP errors;
   "Install" works. Run `node app/scripts/pwa-check.cjs` against the live URL.

## Each release

From your machine, in `app/`:

```
npm ci
npm run type-check && npm run lint && npm test
npm run build
```

Bump the version in `app/package.json` and add a line to `CHANGELOG.md` first. Then upload:

```
rsync -az --delete app/dist/ USER@VPS_IP:/var/www/lou/
```

The service worker version changes with the files, so open tabs show "A new version of Lou is ready".

## If you use Hostinger shared hosting instead

Create the subdomain `lou` in hPanel, upload the contents of `app/dist/` to its folder, enable the free SSL, and put the same
headers in `.htaccess` (`Header set ...`, requires `mod_headers`). Same checks as above.

## Moving the app to /app (when the landing page is built)

The landing page takes `/`. Then: set `base: '/app/'` in `vite.config.ts`; change `start_url`, `scope`, `id` and the
`.lou` file handler in `public/manifest.webmanifest` to `/app/`; update the service worker's `/index.html` fallback; update the
footer and legal links; keep `/legal/*` and `/.well-known/*` at the root; update `sitemap.xml`, canonical and og:url. People
who installed the app at `/` will need a redirect from `/` to the landing page and a one-time reinstall, so plan a notice.
