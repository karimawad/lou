#!/bin/bash
# Read-only status of Lou's key server, layer by layer. Run on the VPS:   sudo bash deploy/check-key-server.sh
# To FIX whatever it finds, run:   sudo bash deploy/install-key-server.sh   (one command, safe to repeat)

SITE="${SITE_URL:-https://lou.bigtimedesign.ca}"
PORT="$(grep -E '^PORT=' /etc/lou-license.env 2>/dev/null | tail -1 | cut -d= -f2)"; PORT="${PORT:-3417}"
fail=0
ok()  { echo "  ok    $*"; }
bad() { echo "  FAIL  $*"; fail=1; }

echo "1. Files"
[ -f /etc/lou-license.env ] && ok "/etc/lou-license.env exists" || bad "/etc/lou-license.env is missing"
[ -f /etc/lou-license/ed25519.pem ] && ok "signing key exists" || bad "/etc/lou-license/ed25519.pem is missing"
[ -d "$(dirname "$(readlink -f "$0")")/../server/node_modules/nodemailer" ] && ok "server dependencies installed" || bad "server/node_modules is missing"

echo "2. Service"
UNIT=/etc/systemd/system/lou-license.service
if [ ! -f "$UNIT" ]; then bad "service not installed"; else
  systemctl is-enabled --quiet lou-license && ok "enabled (starts after a reboot)" || bad "not enabled"
  if systemctl is-active --quiet lou-license; then ok "running"; else
    bad "not running. Last log lines:"; journalctl -u lou-license -n 6 --no-pager 2>/dev/null | sed 's/^/          /'
  fi
fi

echo "3. The program itself (127.0.0.1:$PORT)"
body="$(curl -s -m 5 "http://127.0.0.1:$PORT/api/health")"
if [ "$body" = '{"ok":true}' ]; then ok "answers $body"
elif [ -n "$body" ]; then bad "something else answers on port $PORT ($body): the port is taken by another app"
else bad "nothing answers on port $PORT"; fi

echo "4. Through the web server (OpenLiteSpeed proxy at /api/)"
out="$(curl -sS -m 10 "$SITE/api/health" 2>&1)"
if [ "$out" = '{"ok":true}' ]; then ok "$SITE/api/health -> $out"; else bad "$SITE/api/health -> $(echo "$out" | head -c 200)"; fi

echo "5. Log retention (Privacy page promises up to 14 days)"
cur="$(systemd-analyze cat-config systemd/journald.conf 2>/dev/null | grep -i '^MaxRetentionSec=' | tail -1 | cut -d= -f2)"
us=""; [ -n "$cur" ] && us="$(systemd-analyze timespan "$cur" 2>/dev/null | awk '/s: *[0-9]+ *$/ {print $NF; exit}')"
if [ -n "$us" ] && [ "$us" -le 1209600000000 ]; then ok "MaxRetentionSec=$cur"; else bad "journal logs have no 14-day limit"; fi

echo
if [ "$fail" = 0 ]; then echo "All good."; else echo "To fix everything above in one go:  sudo bash $(dirname "$(readlink -f "$0")")/install-key-server.sh"; fi
exit $fail
