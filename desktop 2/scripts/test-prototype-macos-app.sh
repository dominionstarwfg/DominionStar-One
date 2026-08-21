#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
APP="dist/mac-universal/DominionStar Meet Prototype.app"
PLIST="$APP/Contents/Info.plist"
EXECUTABLE="$APP/Contents/MacOS/DominionStar Meet Prototype"
DMG="dist/DominionStar-Meet-Prototype-${VERSION}-mac-universal.dmg"
PORT=9222
APP_LOG="/tmp/dominionstar-prototype-meet.log"
MOUNT="/tmp/dominionstar-prototype-dmg"
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

[ "$(uname -m)" = "x86_64" ] || fail "Prototype acceptance must run on Intel macOS"
[ -f "$PLIST" ] || fail "Clean prototype app is missing: $PLIST"
[ -x "$EXECUTABLE" ] || fail "Clean prototype executable is missing"
[ -f "$DMG" ] || fail "Clean prototype DMG is missing: $DMG"

APP_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")
APP_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")
APP_NAME=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$PLIST")
[ "$APP_VERSION" = "$VERSION" ] || fail "Prototype version mismatch: $APP_VERSION"
[ "$APP_ID" = "com.dominionstar.desktop.prototype" ] || fail "Prototype bundle ID mismatch: $APP_ID"
[ "$APP_NAME" = "DominionStar Meet Prototype" ] || fail "Prototype app name mismatch: $APP_NAME"

ARCHS=$(/usr/bin/lipo -archs "$EXECUTABLE")
echo "$ARCHS" | grep -F 'x86_64' >/dev/null || fail "Universal prototype is missing x86_64"
echo "$ARCHS" | grep -F 'arm64' >/dev/null || fail "Universal prototype is missing arm64"

rm -rf "$MOUNT"
mkdir -p "$MOUNT"
hdiutil attach "$DMG" -nobrowse -readonly -mountpoint "$MOUNT" -quiet
DMG_APP="$MOUNT/DominionStar Meet Prototype.app"
[ -f "$DMG_APP/Contents/Info.plist" ] || fail "DMG does not contain DominionStar Meet Prototype.app"
DMG_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$DMG_APP/Contents/Info.plist")
[ "$DMG_ID" = "com.dominionstar.desktop.prototype" ] || fail "DMG payload bundle ID mismatch: $DMG_ID"
hdiutil detach "$MOUNT" -quiet

rm -f "$APP_LOG"
echo "Launching clean prototype against its bound Meet preview..."
"$EXECUTABLE" --remote-debugging-port="$PORT" >"$APP_LOG" 2>&1 &
APP_PID=$!

DEADLINE=$((SECONDS + 25))
until curl -fsS "http://127.0.0.1:${PORT}/json/list" >/dev/null 2>&1; do
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    fail "Prototype exited before renderer inspection"
  fi
  [ "$SECONDS" -lt "$DEADLINE" ] || fail "Prototype never exposed its renderer for Meet inspection"
  sleep 0.25
done

DOMINIONSTAR_CDP_PORT="$PORT" node scripts/test-live-meet-contract.mjs || fail "Prototype Meet release-contract acceptance failed"

echo "DOMINIONSTAR_CLEAN_PROTOTYPE_ACCEPTANCE_OK version=$VERSION bundle=$APP_ID archs=$ARCHS"
