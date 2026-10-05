# Deploying Lou

Lou is static files. There is no server code, no database and no secrets. Hosting is a folder of files behind HTTPS.

Target: **https://lou.bigtimedesign.ca** on the Hostinger VPS (OpenLiteSpeed), next to MTGSL.
Files in `deploy/`: `deploy.sh` (release script) and `vhconf.conf` (the web server settings).

## One-time setup (about 15 minutes)

1. **DNS.** In Hostinger DNS for bigtimedesign.ca, add an `A` record: name `lou`, value = the VPS IP. Wait for it to resolve
   (`nslookup lou.bigtimedesign.ca`).
2. **Server folders and code.** SSH into the VPS:
   ```
   sudo mkdir -p /var/www/lou/logs && sudo chown -R $USER /var/www/lou
   cd /var/www/lou && git clone https://github.com/karimawad/lou.git repo
   chmod +x repo/deploy/deploy.sh
   ```
   Node 22 or newer must be installed (MTGSL's server already has it; check `node -v`). The repo is public, so no keys are needed.
3. **First build.** `cd /var/www/lou/repo && ./deploy/deploy.sh`. This creates `/var/www/lou/current`.
4. **Virtual host.** In OpenLiteSpeed WebAdmin (port 7080):
   - Virtual Hosts, Add: name `Lou`, root `/var/www/lou`, config file `$SERVER_ROOT/conf/vhosts/$VH_NAME/vhconf.conf`,
     Restrained `Yes`, Enable Scripts `No`. Save and click to create the config file.
   - Put the contents of `deploy/vhconf.conf` into `/usr/local/lsws/conf/vhosts/Lou/vhconf.conf`
     (`sudo cp /var/www/lou/repo/deploy/vhconf.conf /usr/local/lsws/conf/vhosts/Lou/vhconf.conf`), then
     `sudo chown lsadm:lsadm` it. It sets the document root to `current/`, the 404 page, the HTTPS redirect, 14-day log
     retention (matches the privacy policy), the cache rules and the security headers.
   - Listeners: on both the port 80 and port 443 listeners, add a virtual host mapping `Lou` for domain `lou.bigtimedesign.ca`.
5. **HTTPS certificate.** `sudo certbot certonly --webroot -w /var/www/lou/current -d lou.bigtimedesign.ca`, then in WebAdmin
   Virtual Hosts, `Lou`, SSL: set the private key file and certificate file to the Let's Encrypt paths. (If MTGSL already uses
   certbot with a different method, use the same one.) Graceful restart.
6. **MIME types.** Check `.webmanifest` is `application/manifest+json` and `.wasm` is `application/wasm` (Server, MIME settings).
7. **Check.**
   ```
   curl -sI https://lou.bigtimedesign.ca/sw.js | grep -i cache-control      # no-cache
   curl -sI https://lou.bigtimedesign.ca/ | grep -i content-security-policy  # present
   curl -sI http://lou.bigtimedesign.ca/ | head -1                          # 301
   curl -sI https://lou.bigtimedesign.ca/nope | head -1                     # 404
   ```
   Then open the site, confirm the console shows no CSP errors, the footer shows, Install works, and run
   `node app/scripts/pwa-check.cjs https://lou.bigtimedesign.ca` from your computer.
8. **Search and sharing.** Submit `https://lou.bigtimedesign.ca/sitemap.xml` in Google Search Console if you want it indexed
   (hold this until the landing page exists).

## Each release

1. On your computer: bump `version` in `app/package.json`, add a line to `CHANGELOG.md`, commit and push. GitHub CI must be green.
2. On the server: `cd /var/www/lou/repo && ./deploy/deploy.sh`.

The script pulls, installs, builds into a new folder under `releases/`, checks the build, and switches `current` in one step.
Open tabs then show "A new version of Lou is ready". Roll back with
`ln -sfn /var/www/lou/releases/<older folder> /var/www/lou/current`.

If you change `app/public/_headers`, change `deploy/vhconf.conf` to match, copy it over and gracefully restart.

## If you use Hostinger shared hosting instead

Create the subdomain `lou` in hPanel, enable the free SSL, build on your computer (`npm run build` in `app/`), upload the contents
of `app/dist/` to the subdomain folder, and put the `_headers` rules in `.htaccess` (`Header set ...`, needs `mod_headers`).
Same checks as above.

## Moving the app to /app (when the landing page is built)

The landing page takes `/`. Then: set `base: '/app/'` in `vite.config.ts`; change `start_url`, `scope`, `id` and the
`.lou` file handler in `public/manifest.webmanifest` to `/app/`; update the service worker's `/index.html` fallback; update the
footer and legal links; keep `/legal/*` and `/.well-known/*` at the root; update `sitemap.xml`, canonical and og:url.
People who installed the app at `/` will need a redirect from `/` to the landing page and a one-time reinstall, so plan a notice.
