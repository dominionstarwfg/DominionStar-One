#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST"

rsync -a "$ROOT/" "$DIST/" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude 'dist/' \
  --exclude 'desktop/' \
  --exclude 'desktop 2/' \
  --exclude 'scripts/' \
  --exclude 'supabase/' \
  --exclude 'netlify/' \
  --exclude 'rc10s10/' \
  --exclude '*.md' \
  --exclude '*.zip' \
  --exclude 'PRODUCTION-MEET-SOURCE-MANIFEST.json'

test -s "$DIST/meet/index.html"
test -s "$DIST/meet/release-contract.json"
test -s "$DIST/assets/js/meeting-engine.js"
test -s "$DIST/assets/js/meet-next/executive6.js"

python3 - "$DIST" <<'PY'
import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1])
contract=json.loads((root/'meet/release-contract.json').read_text())
for rel in ['assets/js/meeting-engine.js','assets/js/meet-next/executive6.js','meet/index.html']:
    actual=hashlib.sha256((root/rel).read_bytes()).hexdigest()
    expected=contract['files'][rel]
    if actual != expected:
        raise SystemExit(f'{rel}: {actual} != {expected}')
    print('HASH OK', rel, actual)
print('NETLIFY_RELEASE', contract['releaseId'])
PY

echo "Netlify publish directory ready: $DIST"
