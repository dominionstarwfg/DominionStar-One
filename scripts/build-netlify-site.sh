#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

# Safety boundary: a Netlify production deploy is atomic. Never replace the
# current working site with a repository snapshot that only contains Meet.
# These files/functions are present in the certified RC12.26 production bundle
# and must be recovered into Git before continuous deployment is allowed.
required_paths=(
  "index.html"
  "styles.css"
  "_headers"
  "_redirects"
  "member-login/index.html"
  "member-dashboard/index.html"
  "assets/js/supabase-config.js"
  "netlify/functions/founder-data.mjs"
  "netlify/functions/meet-intelligence.mjs"
  "netlify/functions/meet-rtc-config.mjs"
  "netlify/functions/meet-translate.mjs"
  "netlify/functions/meeting-host-alert.mjs"
  "netlify/functions/process-email-outbox.mjs"
  "netlify/functions/resolve-meeting-join.mjs"
  "netlify/functions/scheduled-email-outbox.mjs"
  "netlify/functions/workspace-weather.mjs"
  "package.json"
)

missing=()
for rel in "${required_paths[@]}"; do
  if [ ! -s "$ROOT/$rel" ]; then
    missing+=("$rel")
  fi
done

if [ "${#missing[@]}" -ne 0 ]; then
  echo "ERROR: refusing to build an incomplete DominionStar production deploy." >&2
  echo "The current live site remains the safety baseline. Missing source:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Recover and certify the complete production surface before linking Netlify production to this repository." >&2
  exit 42
fi

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

test -s "$DIST/index.html"
test -s "$DIST/styles.css"
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
