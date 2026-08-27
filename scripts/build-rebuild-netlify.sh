#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/rebuild-preview"
DIST="$ROOT/rebuild-dist"

if [ ! -f "$SOURCE/index.html" ]; then
  echo "ERROR: rebuild preview source is incomplete." >&2
  exit 41
fi

rm -rf "$DIST"
mkdir -p "$DIST"
rsync -a --delete "$SOURCE/" "$DIST/"

# Fail closed: the rebuild deploy may only contain explicitly authored preview
# files. Legacy website, Meet, desktop, QA, and recovery files never enter it.
for forbidden in desktop 'desktop 2' meet meet-home meet-login .github supabase netlify; do
  if [ -e "$DIST/$forbidden" ]; then
    echo "ERROR: forbidden legacy path reached rebuild-dist: $forbidden" >&2
    exit 42
  fi
done

test -s "$DIST/index.html"
echo "DOMINIONSTAR_REBUILD_NETLIFY_CLEAN_OK"
