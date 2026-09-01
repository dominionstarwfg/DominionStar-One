#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/public-dist"

# Production domain boundary:
# - The public DominionStar website owns `/`.
# - Browser/member surfaces may remain at their existing routes.
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
)

for rel in "${required_paths[@]}"; do
  if [ ! -s "$ROOT/$rel" ]; then
    echo "ERROR: refusing public deploy; missing required public file: $rel" >&2
    exit 41
  fi
done

rm -rf "$DIST"
mkdir -p "$DIST"

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

# The public homepage must be the public DominionStar site, never the desktop UI.
grep -Fq 'DominionStar | Financial Education & Career Development' "$DIST/index.html"
if grep -Fq 'DominionStar Meet' "$DIST/index.html"; then
  echo "ERROR: desktop Meet content reached the public homepage." >&2
  exit 42
fi

# Desktop source must never be present in the public production package.
test ! -e "$DIST/meet-desktop"
test ! -e "$DIST/rebuild-dist"

echo "DOMINIONSTAR_PUBLIC_NETLIFY_OK"
