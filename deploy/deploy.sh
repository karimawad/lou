#!/bin/bash
# Deploys Lou on the VPS. Run from the repo folder on the server: ./deploy/deploy.sh
# Static files only: builds into a new release folder, then switches the "current" link in one step,
# so visitors never see a half-written site. Keeps the last 5 releases for a quick rollback:
#   ln -sfn /var/www/lou/releases/<older> /var/www/lou/current
set -euo pipefail

ROOT="/var/www/lou"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE="$ROOT/releases/$STAMP"

echo "Pulling latest changes..."
cd "$REPO"
git pull --ff-only

echo "Installing dependencies..."
cd "$REPO/app"
npm ci

echo "Building into $RELEASE ..."
mkdir -p "$ROOT/releases"
npx tsc -b
npx vite build --outDir "$RELEASE" --emptyOutDir

# A build with no index or service worker is broken: stop before switching.
[ -f "$RELEASE/index.html" ] && [ -f "$RELEASE/sw.js" ] || { echo "ERROR: build is incomplete, not switching."; exit 1; }

echo "Switching to the new release..."
ln -sfn "$RELEASE" "$ROOT/current.new"
mv -Tf "$ROOT/current.new" "$ROOT/current"

echo "Removing old releases (keeping 5)..."
ls -1dt "$ROOT"/releases/* | tail -n +6 | xargs -r rm -rf

echo "Done. Live: $(grep -o '"version": *"[^"]*"' package.json)"
echo "Check: curl -sI https://lou.bigtimedesign.ca/sw.js | grep -i cache-control"
