#!/bin/bash
# Deploys Lou. On the VPS, from this folder (the repo root, /var/www/lou):   ./deploy.sh
# Pulls from git, installs, builds into a new folder under releases/, checks the build, then switches the
# "current" link in one step (visitors never see a half-built site). Keeps the last 5 releases.
# Rollback:  ln -sfn /var/www/lou/releases/<older folder> /var/www/lou/current
# The web server's document root is <this folder>/current (see deploy/vhconf.conf).

# Restarts Lou's key server (a systemd service, so it also starts on boot and restarts itself if it crashes) and checks that it
# answers. The site is already live by now: a problem here is reported loudly but does not undo the release.
key_server() {
  local root="$1" unit_src unit_dst node_bin ok=0 port
  unit_src="$root/deploy/lou-license.service"
  unit_dst=/etc/systemd/system/lou-license.service
  node_bin="$(command -v node)"
  port="$(grep -E '^PORT=' /etc/lou-license.env 2>/dev/null | tail -1 | cut -d= -f2)"; port="${port:-3417}"
  if [ ! -f "$unit_dst" ]; then
    echo "!! The key server service is not installed yet, so buying a key will not work. Run once:  sudo bash $root/deploy/install-key-server.sh"
    return 0
  fi
  if ! diff -q <(sed "s#/usr/bin/node#$node_bin#" "$unit_src") "$unit_dst" >/dev/null; then
    echo "!! deploy/lou-license.service changed since it was installed. Update it:  sudo bash $root/deploy/install-key-server.sh"
  fi
  systemctl is-enabled --quiet lou-license || echo "!! lou-license is not enabled, so it will not start after a reboot: sudo systemctl enable lou-license"
  if ! sudo -n systemctl restart lou-license 2>/dev/null; then
    echo "!! Could not restart lou-license without a password. Run: sudo systemctl restart lou-license"
    echo "   (To make deploy.sh do it itself, see DEPLOY.md, step 4: the sudoers line.)"
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if node -e "fetch('http://127.0.0.1:$port/api/health').then(r=>r.json()).then(j=>process.exit(j.ok===true?0:1)).catch(()=>process.exit(1))"; then ok=1; break; fi
    sleep 1
  done
  if [ "$ok" = 1 ]; then echo "Key server is running and healthy."
  else
    echo "!! KEY SERVER IS NOT ANSWERING. Buying and 'Find my key' will not work until it is fixed."
    echo "   Run:  sudo bash $root/deploy/install-key-server.sh      (sets up or repairs it, and prints what is wrong)"
  fi
}

main() {
  set -euo pipefail
  cd "$(dirname "$(readlink -f "$0")")"
  ROOT="$PWD"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  RELEASE="$ROOT/releases/$STAMP"

  echo "========================================="
  echo "Deploying Lou ($STAMP)"
  echo "========================================="

  command -v git >/dev/null || { echo "ERROR: git is not installed."; exit 1; }
  command -v node >/dev/null || { echo "ERROR: node is not installed (need 22 or newer)."; exit 1; }
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 22 ] || { echo "ERROR: node $NODE_MAJOR is too old (need 22 or newer)."; exit 1; }

  echo "Pulling latest changes from git..."
  git pull --ff-only

  mkdir -p "$ROOT/releases" "$ROOT/logs"

  echo "Installing dependencies..."
  cd "$ROOT/app"
  npm ci --no-audit --no-fund

  echo "Building into $RELEASE ..."
  npx tsc -b
  npx vite build --outDir "$RELEASE" --emptyOutDir

  # A build with no index or service worker is broken: stop before switching.
  if [ ! -f "$RELEASE/index.html" ] || [ ! -f "$RELEASE/sw.js" ]; then
    echo "ERROR: build is incomplete, not switching. Live site is unchanged."
    exit 1
  fi

  echo "Switching to the new release..."
  ln -sfn "$RELEASE" "$ROOT/current.new"
  mv -Tf "$ROOT/current.new" "$ROOT/current"

  echo "Key server (server/)..."
  (cd "$ROOT/server" && npm ci --omit=dev --no-audit --no-fund)
  key_server "$ROOT"

  echo "Removing old releases (keeping 5)..."
  ls -1dt "$ROOT"/releases/* | tail -n +6 | xargs -r rm -rf

  echo "========================================="
  echo "Done. Live version: $(node -p "require('./package.json').version")"
  echo "Check: curl -sI https://lou.bigtimedesign.ca/sw.js | grep -i cache-control"
  echo "========================================="
}

# Everything runs inside main so bash has read the whole script before git pull can replace this file.
main "$@"
exit $?
