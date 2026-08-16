#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_SCRIPT="$REPO_ROOT/scripts/build-netlify-site.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/scripts"
cp "$BUILD_SCRIPT" "$TMP/scripts/build-netlify-site.sh"
chmod +x "$TMP/scripts/build-netlify-site.sh"

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

for rel in "${required_paths[@]}"; do
  mkdir -p "$TMP/$(dirname "$rel")"
  printf 'placeholder\n' > "$TMP/$rel"
done

set +e
output=$(bash "$TMP/scripts/build-netlify-site.sh" 2>&1)
status=$?
set -e
printf '%s\n' "$output"
test "$status" -eq 43
echo "$output" | grep -F "cutover approval is intentionally withheld" >/dev/null

echo '{"approved":false,"baseline":"RC12.26","meetReleaseId":"2026.08.16-rc13.0-media-share-link-stability","previewAccepted":true}' > "$TMP/PRODUCTION-CUTOVER-APPROVAL.json"
set +e
output=$(bash "$TMP/scripts/build-netlify-site.sh" 2>&1)
status=$?
set -e
printf '%s\n' "$output"
test "$status" -eq 43
echo "$output" | grep -F "production cutover approval is invalid or incomplete" >/dev/null

rm -f "$TMP/index.html"
set +e
output=$(bash "$TMP/scripts/build-netlify-site.sh" 2>&1)
status=$?
set -e
printf '%s\n' "$output"
test "$status" -eq 42
echo "$output" | grep -F "refusing to build an incomplete DominionStar production deploy" >/dev/null

echo "NETLIFY_CUTOVER_GATE_TESTS_PASSED"
