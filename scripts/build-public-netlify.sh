#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/public-dist"
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
  "meet/index.html"
  "meet/release-contract.json"
  "assets/js/meeting-engine.js"
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

# Browser Meet is an isolated browser-native route copied from the certified
# browser source tree above. Never overwrite it with desktop Electron UI.
test -s "$MEET_DIST/index.html"
test -s "$MEET_DIST/release-contract.json"
grep -Fq 'id="joinForm"' "$MEET_DIST/index.html"
grep -Fq '/assets/js/meeting-engine.js' "$MEET_DIST/index.html"

# The public homepage must be the public DominionStar site, never Meet.
grep -Fq 'DominionStar | Financial Education & Career Development' "$DIST/index.html"
if grep -Fq 'DominionStar Meet' "$DIST/index.html"; then
  echo "ERROR: Meet content reached the public homepage." >&2
  exit 42
fi

# Browser Meet must exist only at its dedicated route and must remain the
# browser-native meeting surface, not the Electron workspace shell.
grep -Fq 'DominionStar Meet' "$MEET_DIST/index.html"
grep -Fq 'SECURE VIDEO MEETING' "$MEET_DIST/index.html"
if grep -Fq 'Start, join, or schedule in one place.' "$MEET_DIST/index.html"; then
  echo "ERROR: obsolete standalone Meet launcher was republished at /meet/." >&2
  exit 44
fi
if grep -Fq '<h1>Meetings</h1>' "$MEET_DIST/index.html"; then
  echo "ERROR: obsolete Meetings home is still present in browser Meet." >&2
  exit 45
fi
if grep -Fq 'DESKTOP WORKSPACE' "$MEET_DIST/index.html"; then
  echo "ERROR: desktop workspace was published at /meet/." >&2
  exit 43
fi
test ! -e "$DIST/meet-desktop"
test ! -e "$DIST/rebuild-dist"
test ! -e "$DIST/meet-home"

echo "DOMINIONSTAR_PUBLIC_ROOT_OK"
echo "DOMINIONSTAR_BROWSER_MEET_ROUTE_OK /meet/"
