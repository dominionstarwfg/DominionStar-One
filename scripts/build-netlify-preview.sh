#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.preview-package"
PUBLIC="$OUT/public"

rm -rf "$OUT"
mkdir -p "$PUBLIC" "$OUT/functions"

# Preview is intentionally independent from the production cutover gate. It
# never creates dist/, never reads PRODUCTION-CUTOVER-APPROVAL.json, and is not
# connected to a deployment action. Its only purpose is acceptance testing.
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
  --exclude 'PRODUCTION-CUTOVER-APPROVAL.json' \
  --exclude 'RECOVERED-PRODUCTION-STATIC-BASELINE.json'

# Preview-only indexing and cache protection. This modifies only the generated
# artifact, never the recovered source files.
cat >> "$PUBLIC/_headers" <<'EOF'

/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store
EOF

cat > "$OUT/netlify.toml" <<'EOF'
[build]
  publish = "public"
  functions = "functions"
EOF

# Make the artifact unmistakably non-production even when inspected outside CI.
cat > "$PUBLIC/PREVIEW-NOT-PRODUCTION.txt" <<'EOF'
DominionStar acceptance preview only.
This package is not approved for production deployment.
Production requires explicit preview acceptance and PRODUCTION-CUTOVER-APPROVAL.json.
EOF

# Verify the protected Meet release survives composition byte-for-byte.
python3 - "$PUBLIC" <<'PY'
import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1])
contract=json.loads((root/'meet/release-contract.json').read_text())
release='2026.08.16-rc13.0-media-share-link-stability'
if contract.get('releaseId') != release:
    raise SystemExit(f"Unexpected preview Meet release: {contract.get('releaseId')!r}")
for rel in ['meet/index.html','assets/js/meeting-engine.js','assets/js/meet-next/executive6.js']:
    wanted=contract.get('files',{}).get(rel)
    actual=hashlib.sha256((root/rel).read_bytes()).hexdigest()
    if not wanted or actual != wanted:
        raise SystemExit(f'{rel}: preview {actual} != certified {wanted}')
    print('PREVIEW_MEET_HASH_OK', rel, actual)
PY

# Build a deterministic inventory for review. The preview-only _headers and
# marker are intentionally included so the exact artifact can be audited.
python3 - "$PUBLIC" "$OUT/PREVIEW-SHA256.json" <<'PY'
import hashlib, json, sys
from pathlib import Path
root=Path(sys.argv[1]); out=Path(sys.argv[2])
files={}
for p in sorted(x for x in root.rglob('*') if x.is_file()):
    rel=p.relative_to(root).as_posix()
    files[rel]=hashlib.sha256(p.read_bytes()).hexdigest()
payload={
  'kind':'DominionStar non-production acceptance preview',
  'productionApproved':False,
  'meetReleaseId':'2026.08.16-rc13.0-media-share-link-stability',
  'fileCount':len(files),
  'files':files,
}
out.write_text(json.dumps(payload,indent=2)+'\n')
print('PREVIEW_STATIC_FILE_COUNT', len(files))
PY

test -s "$PUBLIC/index.html"
test -s "$PUBLIC/member-login/index.html"
test -s "$PUBLIC/member-dashboard/index.html"
test -s "$PUBLIC/meet/index.html"
test -s "$PUBLIC/sw.js"
test -s "$PUBLIC/_headers"
test -s "$PUBLIC/_redirects"
test ! -e "$PUBLIC/.github"
test ! -e "$PUBLIC/desktop"
test ! -e "$PUBLIC/desktop 2"
test ! -e "$PUBLIC/scripts"
test ! -e "$PUBLIC/supabase"
test ! -e "$PUBLIC/netlify"
test ! -e "$PUBLIC/package.json"
test ! -e "$PUBLIC/netlify.toml"
test ! -e "$ROOT/dist"

echo "DOMINIONSTAR_PREVIEW_PACKAGE_READY=$OUT"
