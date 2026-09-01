#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/public-dist"
MEET_SOURCE="$ROOT/meet-desktop/ui"
MEET_DIST="$DIST/meet"

# Production domain boundary:
# - The public DominionStar website owns `/`.
# - Browser Meet is published only at `/meet/`.
# - Desktop Meet source must never become the production homepage.
required_paths=(
  "index.html"
  "styles.css"
  "_headers"
  "_redirects"
  "financial-services/index.html"
  "opportunity/index.html"
  "institute/index.html"
  "academy/index.html"
  "member-login/index.html"
  "meet-desktop/ui/index.html"
)

for rel in "${required_paths[@]}"; do
  if [ ! -s "$ROOT/$rel" ]; then
    echo "ERROR: refusing public deploy; missing required file: $rel" >&2
    exit 41
  fi
done

rm -rf "$DIST"
mkdir -p "$DIST"

# Build the public website first. Desktop source is explicitly excluded.
rsync -a "$ROOT/" "$DIST/" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude 'public-dist/' \
  --exclude 'rebuild-dist/' \
  --exclude 'meet-desktop/' \
  --exclude 'desktop/' \
  --exclude 'desktop 2/' \
  --exclude 'scripts/' \
  --exclude 'supabase/' \
  --exclude 'netlify/' \
  --exclude 'node_modules/' \
  --exclude '*.md' \
  --exclude '*.zip'

# Browser Meet is an isolated route, never the public root.
rm -rf "$MEET_DIST"
mkdir -p "$MEET_DIST"
rsync -a --delete "$MEET_SOURCE/" "$MEET_DIST/"

# The public homepage must be the public DominionStar site, never Meet.
grep -Fq 'DominionStar | Financial Education & Career Development' "$DIST/index.html"
if grep -Fq 'DominionStar Meet' "$DIST/index.html"; then
  echo "ERROR: Meet content reached the public homepage." >&2
  exit 42
fi

# Browser Meet must exist only at its dedicated route.
grep -Fq 'DominionStar Meet' "$MEET_DIST/index.html"
test ! -e "$DIST/meet-desktop"
test ! -e "$DIST/rebuild-dist"

echo "DOMINIONSTAR_PUBLIC_ROOT_OK"
echo "DOMINIONSTAR_BROWSER_MEET_ROUTE_OK /meet/"
