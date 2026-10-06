#!/bin/bash
# Checks every layer of Lou's key server and says which one is broken. Run on the VPS:   ./deploy/check-key-server.sh
# It only reads things (no changes, no secrets printed). Layers: files -> service -> local answer -> web server proxy.

SITE="${SITE_URL:-https://lou.bigtimedesign.ca}"
fail=0
ok()   { echo "  ok    $*"; }
bad()  { echo "  FAIL  $*"; fail=1; }
hint() { echo "        -> $*"; }

echo "1. Files"
[ -f /etc/lou-license.env ] && ok "/etc/lou-license.env exists" || { bad "/etc/lou-license.env is missing"; hint "copy it up from your computer (DEPLOY.md, Key server, step 2)"; }
[ -f /etc/lou-license/ed25519.pem ] && ok "signing key exists" || { bad "/etc/lou-license/ed25519.pem is missing"; hint "copy it up from your computer (DEPLOY.md, Key server, step 2)"; }
[ -d "$(dirname "$(readlink -f "$0")")/../server/node_modules/nodemailer" ] && ok "server dependencies installed" || { bad "server/node_modules is missing"; hint "cd /var/www/lou/server && npm ci --omit=dev"; }

echo "2. Service"
UNIT=/etc/systemd/system/lou-license.service
if [ ! -f "$UNIT" ]; then
  bad "service not installed"; hint "sed \"s#/usr/bin/node#\$(command -v node)#\" /var/www/lou/deploy/lou-license.service | sudo tee $UNIT >/dev/null && sudo systemctl daemon-reload && sudo systemctl enable --now lou-license"
else
  NODE_IN_UNIT="$(grep '^ExecStart=' "$UNIT" | sed 's/^ExecStart=//; s/ .*//')"
  [ -x "$NODE_IN_UNIT" ] && ok "unit runs $NODE_IN_UNIT" || { bad "unit points at $NODE_IN_UNIT, which does not exist"; hint "reinstall the unit with the sed command above so it uses $(command -v node)"; }
  case "$NODE_IN_UNIT" in /home/*) bad "node lives under /home; the service user cannot reach it"; hint "install Node 22 system-wide (NodeSource) so it is /usr/bin/node, then reinstall the unit";; esac
  systemctl is-enabled --quiet lou-license && ok "enabled (starts after a reboot)" || { bad "not enabled"; hint "sudo systemctl enable lou-license"; }
  if systemctl is-active --quiet lou-license; then ok "running"; else
    bad "not running"; hint "sudo systemctl start lou-license ; then: sudo journalctl -u lou-license -n 30 --no-pager"
    echo "        last log lines:"; journalctl -u lou-license -n 8 --no-pager 2>/dev/null | sed 's/^/          /'
  fi
fi

echo "3. Answers locally (the program itself)"
if node -e "fetch('http://127.0.0.1:3001/api/health').then(async r=>{console.log('  ok    '+r.status+' '+await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.log('  FAIL  '+e.message);process.exit(1)})"; then :; else
  fail=1; hint "if the service is running but this fails, check PORT in /etc/lou-license.env (must be 3001) and the log: sudo journalctl -u lou-license -n 30 --no-pager"
fi

echo "4. Answers through the web server (OpenLiteSpeed proxy at /api/)"
CODE="$(curl -sS -o /tmp/lou-health.$$ -w '%{http_code}' "$SITE/api/health" 2>/tmp/lou-health-err.$$)"
BODY="$(cat /tmp/lou-health.$$ 2>/dev/null)"; CERR="$(head -c 300 /tmp/lou-health-err.$$ 2>/dev/null)"; rm -f /tmp/lou-health.$$ /tmp/lou-health-err.$$
if [ "$CODE" = 200 ] && echo "$BODY" | grep -q '"ok":true'; then ok "$SITE/api/health -> 200 $BODY"; else
  bad "$SITE/api/health -> HTTP ${CODE:-none}"
  case "$CODE" in
    404) hint "OpenLiteSpeed is not proxying /api/. Copy the vhost file and restart (DEPLOY.md, step 5); check the file contains 'extprocessor lou-license' and 'context /api/'" ;;
    502|503|504) hint "the web server cannot reach 127.0.0.1:3001: the service is down (step 2 or 3 above)" ;;
    000|"") hint "could not connect over HTTPS: ${CERR:-no detail}"
            hint "if this mentions a certificate or SSL, the vhost lost its vhssl block: see DEPLOY.md, Key server, step 5" ;;
    *) hint "unexpected answer; look at /usr/local/lsws/logs/error.log and the vhost's logs/error.log" ;;
  esac
fi

echo "5. Log retention (Privacy page promises 14 days)"
ret="$(journalctl --disk-usage >/dev/null 2>&1; systemd-analyze cat-config systemd/journald.conf 2>/dev/null | grep -i '^MaxRetentionSec' | tail -1)"
[ -n "$ret" ] && ok "$ret" || { bad "journald keeps logs with no time limit"; hint "see DEPLOY.md, Key server, step 6"; }

echo
[ "$fail" = 0 ] && echo "All good." || echo "Something needs fixing: read the FAIL lines above, top to bottom (an earlier one usually causes the later ones)."
exit $fail
