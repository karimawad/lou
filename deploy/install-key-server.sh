#!/bin/bash
# One command that sets up (or repairs) Lou's key server on the VPS. Safe to run again any time.   Run:  sudo bash deploy/install-key-server.sh
# It: creates the service user, picks a free port, installs the always-on service, adds the /api/ proxy to the web server
# (restoring the HTTPS certificate lines if they went missing), limits log retention, restarts everything, and checks the result.
# It never touches your secrets: it needs /etc/lou-license.env and /etc/lou-license/ed25519.pem to be there already.
set -uo pipefail
[ "$(id -u)" = 0 ] || exec sudo bash "$0" "$@"

ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
ENVF=/etc/lou-license.env
KEYF=/etc/lou-license/ed25519.pem
UNIT=/etc/systemd/system/lou-license.service
VH=/usr/local/lsws/conf/vhosts/Lou/vhconf.conf
DOMAIN=lou.bigtimedesign.ca
DEFAULT_PORT=3417
say()  { echo "==> $*"; }
die()  { echo; echo "STOPPED: $*"; exit 1; }
busy() { ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .; }

# ---- 1. what must already be in place ----
[ -f "$ENVF" ] || die "$ENVF is missing. Copy lou-license.env up from your computer (DEPLOY.md, Key server, step 2), then run this again."
[ -f "$KEYF" ] || die "$KEYF is missing. Copy license-ed25519.pem up from your computer (DEPLOY.md, Key server, step 2), then run this again."
[ -f "$VH" ]   || die "$VH not found. Is the Lou virtual host set up in OpenLiteSpeed? (DEPLOY.md, one-time setup, step 4)"
NODE="$(command -v node)" || die "node is not installed."
case "$NODE" in /home/*|/root/*) die "node is at $NODE, where the service user cannot run it. Install Node 22 system-wide: curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs   then run this again.";; esac

# ---- 2. service user, permissions, dependencies ----
say "Service user and permissions"
id lou >/dev/null 2>&1 || useradd --system --home "$ROOT" --shell /usr/sbin/nologin lou
chown -R lou:lou /etc/lou-license && chmod 700 /etc/lou-license && chmod 600 "$KEYF"
chown root:root "$ENVF" && chmod 600 "$ENVF"
say "Server dependencies"
(cd "$ROOT/server" && npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1) || die "npm ci failed in $ROOT/server."

# ---- 3. a port nobody else is using ----
say "Choosing a port"
systemctl stop lou-license 2>/dev/null || true          # so anything still listening is someone else
PORT="$(grep -E '^PORT=' "$ENVF" | tail -1 | cut -d= -f2)"
if [ -z "$PORT" ] || [ "$PORT" = 3001 ] || busy "$PORT"; then
  PORT="$DEFAULT_PORT"; while busy "$PORT"; do PORT=$((PORT + 1)); done
fi
if grep -qE '^PORT=' "$ENVF"; then sed -i "s/^PORT=.*/PORT=$PORT/" "$ENVF"; else echo "PORT=$PORT" >> "$ENVF"; fi
echo "    Lou's key server will use 127.0.0.1:$PORT"

# ---- 4. the always-on service ----
say "Installing the service (starts on boot, restarts itself if it crashes)"
sed "s#/usr/bin/node#$NODE#" "$ROOT/deploy/lou-license.service" > "$UNIT"
systemctl daemon-reload
systemctl enable lou-license >/dev/null 2>&1

# ---- 5. web server: the /api/ proxy, and the certificate lines ----
say "Web server settings"
cp "$VH" "$VH.bak.$(date +%Y%m%d-%H%M%S)"
if grep -q '^extprocessor lou-license' "$VH"; then
  sed -i "/^extprocessor lou-license/,/^}/ s#^\([[:space:]]*address[[:space:]]*\).*#\1127.0.0.1:$PORT#" "$VH"
else
  cat >> "$VH" <<EOF

# Lou's key server runs on localhost and is reached only through /api/ (see DEPLOY.md).
extprocessor lou-license {
  type                    proxy
  address                 127.0.0.1:$PORT
  maxConns                20
  pcKeepAliveTimeout      30
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}
EOF
fi
if ! grep -q '^context /api/' "$VH"; then
  cat >> "$VH" <<'EOF'

context /api/ {
  type                    proxy
  handler                 lou-license
  addDefaultCharset       off
}
EOF
fi
if ! grep -q '^vhssl' "$VH" && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "    The HTTPS certificate lines were missing from the virtual host: adding them back."
  cat >> "$VH" <<EOF

vhssl  {
  keyFile                 /etc/letsencrypt/live/$DOMAIN/privkey.pem
  certFile                /etc/letsencrypt/live/$DOMAIN/fullchain.pem
  certChain               1
}
EOF
fi
chown lsadm:lsadm "$VH" 2>/dev/null || true

# ---- 6. log retention (the Privacy page says up to 14 days) ----
say "Log retention"
cur="$(systemd-analyze cat-config systemd/journald.conf 2>/dev/null | grep -i '^MaxRetentionSec=' | tail -1 | cut -d= -f2)"
us=""; [ -n "$cur" ] && us="$(systemd-analyze timespan "$cur" 2>/dev/null | awk '/s: *[0-9]+ *$/ {print $NF; exit}')"
if [ -n "$us" ] && [ "$us" -le 1209600000000 ]; then
  echo "    Already limited to $cur (14 days or less): leaving it."
else
  mkdir -p /etc/systemd/journald.conf.d
  printf '[Journal]\nMaxRetentionSec=14day\n' > /etc/systemd/journald.conf.d/99-lou.conf
  systemctl restart systemd-journald && journalctl --vacuum-time=14d >/dev/null 2>&1
  echo "    Set to 14 days."
fi

# ---- 7. start everything and check ----
say "Starting"
systemctl restart lou-license
/usr/local/lsws/bin/lswsctrl restart >/dev/null 2>&1 || systemctl restart lsws >/dev/null 2>&1 || echo "    (could not restart OpenLiteSpeed automatically: restart it from WebAdmin)"
local_ok=0; web_ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  body="$(curl -s -m 3 "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"
  [ "$body" = '{"ok":true}' ] && { local_ok=1; break; }
  sleep 1
done
for _ in 1 2 3 4 5 6; do
  body="$(curl -s -m 5 "https://$DOMAIN/api/health" 2>/dev/null)"
  [ "$body" = '{"ok":true}' ] && { web_ok=1; break; }
  sleep 2
done

echo
if [ "$local_ok" = 1 ] && [ "$web_ok" = 1 ] && systemctl is-active --quiet lou-license && systemctl is-enabled --quiet lou-license; then
  echo "ALL DONE. Lou's key server is running, starts on boot, and https://$DOMAIN/api/health answers."
  exit 0
fi
echo "NOT WORKING YET:"
[ "$local_ok" = 1 ] || { echo " - The key server itself is not answering on port $PORT. Its log:"; journalctl -u lou-license -n 15 --no-pager 2>/dev/null | sed 's/^/     /'; }
[ "$web_ok" = 1 ]   || { echo " - https://$DOMAIN/api/health did not return the key server's answer. What came back:"; curl -sS -m 8 -i "https://$DOMAIN/api/health" 2>&1 | head -8 | sed 's/^/     /'; }
echo "Send me this whole output."
exit 1
