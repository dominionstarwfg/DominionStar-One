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

require_file() {
  local path="$1"
  local label="$2"
  if [ ! -s "$path" ]; then
    echo "ERROR: preview safety check failed: missing $label ($path)" >&2
    exit 45
  fi
}

forbid_path() {
  local path="$1"
  local label="$2"
  if [ -e "$path" ]; then
    echo "ERROR: preview safety check failed: forbidden $label present ($path)" >&2
    exit 46
  fi
}

require_file "$PUBLIC/sw.js" "service worker"
require_file "$PUBLIC/PREVIEW-NOT-PRODUCTION.txt" "preview marker"
forbid_path "$PUBLIC/.github" ".github directory"
forbid_path "$PUBLIC/desktop" "desktop directory"
forbid_path "$PUBLIC/desktop 2" "desktop 2 directory"
forbid_path "$PUBLIC/scripts" "scripts directory"
forbid_path "$PUBLIC/supabase" "supabase directory"
forbid_path "$PUBLIC/netlify" "netlify directory"
forbid_path "$PUBLIC/package.json" "package.json"
forbid_path "$PUBLIC/netlify.toml" "netlify.toml"
forbid_path "$PUBLIC/dist" "production dist directory"

echo "DOMINIONSTAR_PREVIEW_SAFETY_CHECKS_OK"
echo "DOMINIONSTAR_PREVIEW_PACKAGE_READY=$PUBLIC"
