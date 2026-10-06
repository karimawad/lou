# Deploying Lou

Lou is static files behind HTTPS, plus one small key server (`server/`) that only handles payments. The key server never sees tax data.
The app works without it: only buying a key and "Find my key" need it.

Target: **https://lou.bigtimedesign.ca** on the Hostinger VPS (OpenLiteSpeed), next to MTGSL.
Files: `deploy.sh` in the repo root (the one command that does a release) and `deploy/vhconf.conf` (the web server settings).
On the server the repo lives at `/var/www/lou`, and you run everything from there.

## One-time setup (about 15 minutes)

1. **DNS.** In Hostinger DNS for bigtimedesign.ca, add an `A` record: name `lou`, value = the VPS IP. Wait for it to resolve
   (`nslookup lou.bigtimedesign.ca`).
2. **Get the code.** SSH into the VPS:
   ```
   sudo mkdir -p /var/www/lou && sudo chown $USER /var/www/lou
   git clone https://github.com/karimawad/lou.git /var/www/lou
   chmod +x /var/www/lou/deploy.sh
   ```
   Node 22 or newer must be installed (check `node -v`). The repo is public, so no keys are needed.
3. **First deploy.** `cd /var/www/lou && ./deploy.sh`. It pulls, installs, builds and creates `/var/www/lou/current`.
4. **Virtual host.** In OpenLiteSpeed WebAdmin (port 7080):
   - Virtual Hosts, Add: name `Lou`, root `/var/www/lou`, config file `$SERVER_ROOT/conf/vhosts/$VH_NAME/vhconf.conf`,
     Restrained `Yes`, Enable Scripts `No`. Save and click to create the config file.
   - Put the contents of `deploy/vhconf.conf` into `/usr/local/lsws/conf/vhosts/Lou/vhconf.conf`
     (`sudo cp /var/www/lou/deploy/vhconf.conf /usr/local/lsws/conf/vhosts/Lou/vhconf.conf`), then
     `sudo chown lsadm:lsadm` it. It sets the document root to `current/`, the 404 page, the HTTPS redirect, 14-day log
     retention (matches the privacy policy), the cache rules and the security headers.
   - Listeners: on both the port 80 and port 443 listeners, add a virtual host mapping `Lou` for domain `lou.bigtimedesign.ca`.
5. **HTTPS certificate.** First prove the vhost answers on port 80:
   ```
   mkdir -p /var/www/lou/current/.well-known/acme-challenge && echo ok > /var/www/lou/current/.well-known/acme-challenge/test
   curl -i http://lou.bigtimedesign.ca/.well-known/acme-challenge/test     # must be 200 and "ok"
   ```
   A 404 here means the request is landing on another virtual host (usually MTGSL): the `Lou` mapping is missing on the **port 80**
   listener, or the domain is spelled differently there. Fix it, graceful restart, and test again. Then:
   `sudo certbot certonly --webroot -w /var/www/lou/current -d lou.bigtimedesign.ca`, and in WebAdmin Virtual Hosts, `Lou`, SSL set the
   private key file to `/etc/letsencrypt/live/lou.bigtimedesign.ca/privkey.pem` and the certificate file to `fullchain.pem`.
   Graceful restart. Note: a new deploy replaces `current`, so the test file disappears; certbot renewals recreate their own files.
   If the symlinked `current` folder gives 403, turn on "Follow Symbolic Link" for the vhost (or server).
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
2. On the server: `cd /var/www/lou && ./deploy.sh`. That is all: it pulls from git, builds and goes live.

The script checks Node, pulls, installs, builds into a new folder under `releases/`, checks the build, and switches `current` in one step. If the build fails, the live site is untouched.
Open tabs then show "A new version of Lou is ready". Roll back with
`ln -sfn /var/www/lou/releases/<older folder> /var/www/lou/current`.

If you change `app/public/_headers`, change `deploy/vhconf.conf` to match, copy it over and gracefully restart.

## If you use Hostinger shared hosting instead

Create the subdomain `lou` in hPanel, enable the free SSL, build on your computer (`npm run build` in `app/`), upload the contents
of `app/dist/` to the subdomain folder, and put the `_headers` rules in `.htaccess` (`Header set ...`, needs `mod_headers`).
Same checks as above.

## Landing page and /app (done in 1.2.0)

The site is two pages from one build: the landing page at `/` (`app/index.html`, `src/landing/`, plain TypeScript, no React)
and the tool at `/app/` (`app/app/index.html`, `src/main.tsx`). `vite.config.ts` lists both as build inputs; the service worker
caches both and falls back to `/app/index.html` for offline visits under `/app/`. The manifest `id`, `start_url`, `scope` and `.lou`
file handler are `/app/`, so an installed Lou opens straight into the tool. `/legal/*` stays at the root. Host rules: `/`, `/app/`
and their `index.html` must not be cached long (already in `_headers`; copy the same into `deploy/vhconf.conf` if you use the VPS).
People who installed Lou before 1.2.0 (scope `/`) keep working but are offered the new scope only after a reinstall.

## Key server (payments)

The key server turns a paid Stripe checkout into a signed key and emails it (see `STRIPE-SETUP.md` for the Stripe side). It is a
small Node program (`server/`, one dependency: nodemailer) that listens on 127.0.0.1:3001; the web server proxies `/api/` to it
(already in `deploy/vhconf.conf`). It keeps no database and logs only method, path and status.

One-time setup on the VPS:

1. **User and folders.**
   ```
   sudo useradd --system --home /var/www/lou --shell /usr/sbin/nologin lou
   sudo mkdir -p /etc/lou-license
   ```
2. **Signing key and settings (copy from your computer).** Both files were made on your computer in `server/secrets/` (gitignored, never in git).
   In PowerShell on your computer (replace USER and VPS_IP):
   ```
   scp C:\Users\karim\Documents\Projects\Lou\server\secrets\license-ed25519.pem USER@VPS_IP:/tmp/
   scp C:\Users\karim\Documents\Projects\Lou\server\secrets\lou-license.env USER@VPS_IP:/tmp/
   ```
   Then on the VPS:
   ```
   sudo mv /tmp/license-ed25519.pem /etc/lou-license/ed25519.pem
   sudo chown -R lou:lou /etc/lou-license && sudo chmod 700 /etc/lou-license && sudo chmod 600 /etc/lou-license/ed25519.pem
   sudo mv /tmp/lou-license.env /etc/lou-license.env
   sudo chown root:root /etc/lou-license.env && sudo chmod 600 /etc/lou-license.env
   ```
   Keep a backup of the private key somewhere safe (a password manager). The matching public key is already in `app/src/license/key.ts`.
3. **Settings.** `/etc/lou-license.env` is the file you just copied (template: `server/.env.example`). To change a value later:
   `sudo nano /etc/lou-license.env`, then `sudo systemctl restart lou-license`.
4. **Install the service (so it runs all the time) and start it.** It is a systemd service: it starts on boot and restarts itself if it crashes.
   ```
   cd /var/www/lou/server && npm ci --omit=dev
   sed "s#/usr/bin/node#$(command -v node)#" /var/www/lou/deploy/lou-license.service | sudo tee /etc/systemd/system/lou-license.service >/dev/null
   sudo systemctl daemon-reload
   sudo systemctl enable --now lou-license
   systemctl is-enabled lou-license && systemctl is-active lou-license    # enabled, active
   ```
   Node must be reachable by the `lou` user, so it should be a system install at `/usr/bin/node` (not under `/home`, which is where nvm puts it).
   If `command -v node` prints a path under `/home`, install Node 22 system-wide first
   (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`).

   So `./deploy.sh` can restart the service itself on every release, allow that one command without a password. Run
   `sudo visudo -f /etc/sudoers.d/lou` and put this single line in it (replace YOUR_USER with the account you deploy with; check the
   path with `command -v systemctl`):
   ```
   YOUR_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart lou-license
   ```
   After that, `./deploy.sh` installs the server's dependencies, restarts the service, waits for it to answer and prints
   "Key server is running and healthy." (or a loud warning with what to run). If `deploy/lou-license.service` ever changes, deploy.sh tells you
   to re-run the `sed ... | sudo tee` line above (it never edits system files by itself).
5. **Web server: add the `/api/` proxy to the live vhost (do not overwrite the file).** The repo's `vhconf.conf` has no certificate lines
   (they were added later by the SSL step), so copying it over the live file would break HTTPS. Instead append only the proxy lines, once,
   then restart OpenLiteSpeed:
   ```
   VH=/usr/local/lsws/conf/vhosts/Lou/vhconf.conf
   sudo cp $VH $VH.bak                                        # a backup, just in case
   grep -q "extprocessor lou-license" $VH || sudo tee -a $VH < /var/www/lou/deploy/vhconf-api-proxy.txt >/dev/null
   sudo /usr/local/lsws/bin/lswsctrl restart
   ```
   Check that the live file still has its certificate block (`sudo grep -A4 vhssl $VH`). If it has none (for example you copied the repo file over it
   earlier), add this to the end of the file and restart again:
   ```
   vhssl  {
     keyFile                 /etc/letsencrypt/live/lou.bigtimedesign.ca/privkey.pem
     certFile                /etc/letsencrypt/live/lou.bigtimedesign.ca/fullchain.pem
     certChain               1
   }
   ```
6. **Log retention (the Privacy page promises 14 days).** The key server's logs go to systemd's journal, which by default keeps logs for months.
   Limit it (this applies to every service's journal on the VPS, which is fine):
   ```
   sudo mkdir -p /etc/systemd/journald.conf.d
   printf '[Journal]\nMaxRetentionSec=14day\n' | sudo tee /etc/systemd/journald.conf.d/lou.conf
   sudo systemctl restart systemd-journald
   sudo journalctl --vacuum-time=14d      # trim what is already older than that
   ```
   The web server's own logs are already limited to 14 days by `vhconf.conf`.
7. **Check everything.** Run `bash /var/www/lou/deploy/check-key-server.sh` on the VPS. It tests each layer in order (files, service, the program itself,
   the web server proxy, log retention) and says what to run for the first one that is broken. Or by hand:
   `curl -s https://lou.bigtimedesign.ca/api/health` should answer `{"ok":true}`, and `sudo journalctl -u lou-license -n 20 --no-pager` should show no errors.

If the key server is down, the rest of Lou is unaffected; Stripe retries payment notifications for days, so buyers still get their key by email.
