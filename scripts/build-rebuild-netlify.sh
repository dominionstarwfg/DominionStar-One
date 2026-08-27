#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/meet-desktop/ui"
DIST="$ROOT/rebuild-dist"

for required in index.html styles.css auth.css meeting.css media-controller.js app.js share-controller.js share-integration.js share.css share-picker.html share-picker.css share-picker.js presenter-toolbar.html presenter-toolbar.css presenter-toolbar.js; do
  if [ ! -s "$SOURCE/$required" ]; then
    echo "ERROR: shared desktop UI source is incomplete: $required" >&2
    exit 41
  fi
done

rm -rf "$DIST"
mkdir -p "$DIST"
rsync -a --delete "$SOURCE/" "$DIST/"
cat > "$DIST/_headers" <<'HEADERS'
/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
HEADERS

for forbidden in desktop 'desktop 2' meet meet-home meet-login .github supabase netlify; do
  if [ -e "$DIST/$forbidden" ]; then
    echo "ERROR: forbidden legacy path reached rebuild-dist: $forbidden" >&2
    exit 42
  fi
done

for file in index.html styles.css auth.css meeting.css media-controller.js app.js share-controller.js share-integration.js share.css share-picker.html share-picker.css share-picker.js presenter-toolbar.html presenter-toolbar.css presenter-toolbar.js; do
  cmp "$SOURCE/$file" "$DIST/$file"
done
echo "DOMINIONSTAR_REBUILD_NETLIFY_SHARED_UI_OK"
