#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
APP="dist/mac-universal/DominionStar Meet.app"
PLIST="$APP/Contents/Info.plist"
EXECUTABLE="$APP/Contents/MacOS/DominionStar Meet"
DMG="dist/DominionStar-Meet-${VERSION}-mac-universal.dmg"
PORT=9222
APP_LOG="/tmp/dominionstar-meet-clean-app.log"
MOUNT="/tmp/dominionstar-meet-clean-dmg"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$APP_PID" >/dev/null 2>&1 || true
  fi
  if mount | grep -F " on $MOUNT " >/dev/null 2>&1; then
    hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true
  fi
  rm -rf "$MOUNT" "$APP_LOG"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  cat "$APP_LOG" >&2 2>/dev/null || true
  exit 1
}

[ "$(uname -m)" = "x86_64" ] || fail "Clean desktop acceptance must run on Intel macOS"
[ -f "$PLIST" ] || fail "DominionStar Meet app is missing: $PLIST"
[ -x "$EXECUTABLE" ] || fail "DominionStar Meet executable is missing"
[ -f "$DMG" ] || fail "DominionStar Meet DMG is missing: $DMG"

APP_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")
APP_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")
APP_NAME=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$PLIST")
ATS_ARBITRARY=$(/usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$PLIST")
ATS_LOCAL=$(/usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsLocalNetworking' "$PLIST")
[ "$APP_VERSION" = "$VERSION" ] || fail "Version mismatch: $APP_VERSION"
[ "$APP_ID" = "com.dominionstar.desktop" ] || fail "Bundle ID mismatch: $APP_ID"
[ "$APP_NAME" = "DominionStar Meet" ] || fail "App name mismatch: $APP_NAME"
[ "$ATS_ARBITRARY" = "false" ] || fail "macOS transport security must reject arbitrary network loads"
[ "$ATS_LOCAL" = "true" ] || fail "macOS local networking must remain available"
[ ! -e "$APP/Contents/Resources/desktop-runtime/assets/js/meet/dock-polish-2030.js" ] || fail "Retired dock-polish authority was packaged"

ARCHS=$(/usr/bin/lipo -archs "$EXECUTABLE")
echo "$ARCHS" | grep -F 'x86_64' >/dev/null || fail "Universal app is missing x86_64"
echo "$ARCHS" | grep -F 'arm64' >/dev/null || fail "Universal app is missing arm64"

rm -rf "$MOUNT"
mkdir -p "$MOUNT"
hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MOUNT" -quiet
DMG_APP="$MOUNT/DominionStar Meet.app"
[ -f "$DMG_APP/Contents/Info.plist" ] || fail "DMG does not contain DominionStar Meet.app"
DMG_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$DMG_APP/Contents/Info.plist")
DMG_ATS=$(/usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$DMG_APP/Contents/Info.plist")
[ "$DMG_ID" = "com.dominionstar.desktop" ] || fail "DMG payload bundle ID mismatch: $DMG_ID"
[ "$DMG_ATS" = "false" ] || fail "DMG payload transport security is not hardened"
[ ! -e "$DMG_APP/Contents/Resources/desktop-runtime/assets/js/meet/dock-polish-2030.js" ] || fail "DMG contains retired dock-polish authority"
hdiutil detach "$MOUNT" -quiet

rm -f "$APP_LOG"
echo "Launching clean DominionStar Meet build against its packaged runtime..."
"$EXECUTABLE" --remote-debugging-port="$PORT" >"$APP_LOG" 2>&1 &
APP_PID=$!

DEADLINE=$((SECONDS + 30))
until curl -fsS "http://127.0.0.1:${PORT}/json/list" >/dev/null 2>&1; do
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    fail "DominionStar Meet exited before renderer inspection"
  fi
  [ "$SECONDS" -lt "$DEADLINE" ] || fail "DominionStar Meet never exposed its renderer for Meet inspection"
  sleep 0.25
done

DOMINIONSTAR_CDP_PORT="$PORT" node scripts/test-live-meet-contract.mjs || fail "DominionStar Meet release-contract acceptance failed"

echo "DOMINIONSTAR_MEET_CLEAN_APP_ACCEPTANCE_OK version=$VERSION bundle=$APP_ID archs=$ARCHS atsArbitrary=$ATS_ARBITRARY retiredDock=absent"
