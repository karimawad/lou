#!/bin/bash
# Deploys Lou. On the VPS, from this folder (the repo root, /var/www/lou):   ./deploy.sh
# Pulls from git, installs, builds into a new folder under releases/, checks the build, then switches the
# "current" link in one step (visitors never see a half-built site). Keeps the last 5 releases.
# Rollback:  ln -sfn /var/www/lou/releases/<older folder> /var/www/lou/current
# The web server's document root is <this folder>/current (see deploy/vhconf.conf).

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
  if systemctl list-unit-files 2>/dev/null | grep -q '^lou-license.service'; then
    sudo -n systemctl restart lou-license && echo "Restarted lou-license." || echo "NOTE: run 'sudo systemctl restart lou-license' yourself."
  else
    echo "NOTE: lou-license.service is not installed yet (see DEPLOY.md). Payments will not work until it is."
  fi

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
