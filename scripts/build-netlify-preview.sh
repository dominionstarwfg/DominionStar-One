#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.preview-package"
PUBLIC="$OUT/public"

rm -rf "$OUT"
mkdir -p "$PUBLIC"

# Deploy previews are deliberately independent from the production certification
# gate. Production still uses scripts/build-netlify-site.sh and its exact
# PRODUCTION-CUTOVER-APPROVAL + release-contract hashes. This preview packages
# the CURRENT PR candidate so physical-device QA can test new fixes before they
# are promoted into a certified production release.
rsync -a "$ROOT/" "$PUBLIC/" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.preview-package/' \
  --exclude 'dist/' \
  --exclude 'desktop/' \
  --exclude 'desktop 2/' \
  --exclude 'scripts/' \
  --exclude 'supabase/' \
  --exclude 'netlify/' \
  --exclude 'rc10s10/' \
  --exclude 'node_modules/' \
  --exclude '*.md' \
  --exclude '*.zip' \
  --exclude 'package.json' \
  --exclude 'package-lock.json' \
  --exclude 'netlify.toml' \
  --exclude 'PRODUCTION-MEET-SOURCE-MANIFEST.json' \
  --exclude 'PREVIEW-ACCEPTANCE-RC13.1.json' \
  --exclude 'PRODUCTION-CUTOVER-APPROVAL.json' \
  --exclude 'RECOVERED-PRODUCTION-STATIC-BASELINE.json'

# Preview-only indexing and cache protection. This modifies only the generated
# artifact, never source or production configuration.
cat >> "$PUBLIC/_headers" <<'EOF'

/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store
EOF

cat > "$PUBLIC/PREVIEW-NOT-PRODUCTION.txt" <<'EOF'
DominionStar acceptance preview only.
This artifact contains the current pull-request candidate.
It is not production-approved and cannot replace the production certification gate.
EOF

# Fail closed on structural completeness instead of comparing the PR candidate
# to an older certified release hash. The exact candidate is fingerprinted below
# so QA can prove which bytes were tested.
required_preview_paths=(
  "index.html"
  "_headers"
  "_redirects"
  "member-login/index.html"
  "member-dashboard/index.html"
  "meet-home/index.html"
  "meet/index.html"
  "assets/js/member-auth.js"
  "assets/js/member-login.js"
  "assets/js/meeting-engine.js"
  "assets/js/meet/desktop-share-picker.js"
  "assets/js/meet/operation-2030-bootstrap.js"
  "assets/js/meet/illustration-ui-parity.js"
)

for rel in "${required_preview_paths[@]}"; do
  if [ ! -s "$PUBLIC/$rel" ]; then
    echo "ERROR: preview candidate is incomplete: $rel" >&2
    exit 44
  fi
done

# Build a deterministic inventory of the exact preview candidate. If the branch
# still contains a certified production release contract, preserve its ID only
# as baseline metadata; do not pretend modified PR bytes are already certified.
python3 - "$ROOT" "$PUBLIC" "$OUT/PREVIEW-SHA256.json" <<'PY'
import hashlib, json, os, sys
from pathlib import Path
source=Path(sys.argv[1]); public=Path(sys.argv[2]); out=Path(sys.argv[3])
files={}
for p in sorted(x for x in public.rglob('*') if x.is_file()):
    rel=p.relative_to(public).as_posix()
    files[rel]=hashlib.sha256(p.read_bytes()).hexdigest()
baseline=None
contract=source/'meet/release-contract.json'
if contract.is_file():
    try:
        baseline=json.loads(contract.read_text()).get('releaseId')
    except Exception:
        baseline=None
payload={
  'kind':'DominionStar non-production acceptance preview',
  'productionApproved':False,
  'candidateCommit':os.environ.get('COMMIT') or os.environ.get('HEAD') or '',
  'baselineCertifiedRelease':baseline,
  'fileCount':len(files),
  'files':files,
}
out.write_text(json.dumps(payload,indent=2)+'\n')
print('DOMINIONSTAR_PREVIEW_CANDIDATE_INVENTORY_OK', len(files), payload['candidateCommit'] or 'local')
print('BASELINE_CERTIFIED_RELEASE', baseline or 'none')
PY

test -s "$PUBLIC/sw.js"
test -s "$PUBLIC/PREVIEW-NOT-PRODUCTION.txt"
test ! -e "$PUBLIC/.github"
test ! -e "$PUBLIC/desktop"
test ! -e "$PUBLIC/desktop 2"
test ! -e "$PUBLIC/scripts"
test ! -e "$PUBLIC/supabase"
test ! -e "$PUBLIC/netlify"
test ! -e "$PUBLIC/package.json"
test ! -e "$PUBLIC/netlify.toml"
test ! -e "$ROOT/dist"

echo "DOMINIONSTAR_PREVIEW_PACKAGE_READY=$PUBLIC"
