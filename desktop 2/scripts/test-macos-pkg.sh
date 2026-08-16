#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
PKG="dist/DominionStar-Meet-${VERSION}-mac-universal.pkg"
STAGED_APP="dist/mac-universal/DominionStar Meet.app"
STAGED_PLIST="$STAGED_APP/Contents/Info.plist"
TEST_APP="/Applications/DominionStar Meet.app"
TEST_PLIST="$TEST_APP/Contents/Info.plist"
AUDIT_DIR="dist/pkg-audit"
STALE_PLIST="/tmp/dominionstar-stale.plist"
PROBE="/tmp/dominionstar-startup-proof.jsonl"
APP_LOG="/tmp/dominionstar-startup.log"
SAMPLE_LOG="/tmp/dominionstar-startup.sample.txt"
INSTALL_LOG="/var/log/dominionstar-meet-installer.log"
SYSTEM_INSTALL_LOG="/var/log/install.log"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$APP_PID" >/dev/null 2>&1 || true
  fi
  sudo rm -rf "$TEST_APP" >/dev/null 2>&1 || true
  rm -rf "$AUDIT_DIR" "$STALE_PLIST" "$PROBE" "$APP_LOG" "$SAMPLE_LOG"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

show_startup_diagnostics() {
  echo "----- startup probe -----" >&2
  cat "$PROBE" >&2 2>/dev/null || echo "(probe was never created)" >&2
  echo "----- application output -----" >&2
  cat "$APP_LOG" >&2 2>/dev/null || echo "(no app output)" >&2
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    echo "----- process sample -----" >&2
    /usr/bin/sample "$APP_PID" 1 1 -file "$SAMPLE_LOG" >/dev/null 2>&1 || true
    tail -n 180 "$SAMPLE_LOG" >&2 2>/dev/null || true
  fi
}

show_installer_diagnostics() {
  echo "----- DominionStar installer hook log -----" >&2
  sudo cat "$INSTALL_LOG" >&2 2>/dev/null || echo "(hook log not created)" >&2
  echo "----- macOS install.log tail -----" >&2
  sudo tail -n 120 "$SYSTEM_INSTALL_LOG" >&2 || true
}

[ "$(uname -m)" = "x86_64" ] || fail "This acceptance test must run on Intel macOS; found $(uname -m)"
[ -f "$PKG" ] || fail "Replacement PKG is missing: $PKG"
[ -f "$STAGED_PLIST" ] || fail "Staged universal app Info.plist is missing"

STAGED_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$STAGED_PLIST")
STAGED_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$STAGED_PLIST")
[ "$STAGED_VERSION" = "$VERSION" ] || fail "Staged version mismatch: expected $VERSION, found $STAGED_VERSION"
[ "$STAGED_ID" = "com.dominionstar.desktop" ] || fail "Staged bundle ID mismatch: $STAGED_ID"

rm -rf "$AUDIT_DIR"
/usr/sbin/pkgutil --expand-full "$PKG" "$AUDIT_DIR"
PAYLOAD_PLIST=$(find "$AUDIT_DIR" -type f -path '*/Applications/DominionStar Meet.app/Contents/Info.plist' -print -quit)
PREINSTALL=$(find "$AUDIT_DIR" -type f -name preinstall -print -quit)
POSTINSTALL=$(find "$AUDIT_DIR" -type f -name postinstall -print -quit)
[ -n "$PAYLOAD_PLIST" ] || fail "Native PKG is missing the app payload"
[ -n "$PREINSTALL" ] || fail "Native PKG is missing preinstall"
[ -n "$POSTINSTALL" ] || fail "Native PKG is missing postinstall"
/bin/sh -n "$PREINSTALL"
/bin/sh -n "$POSTINSTALL"
PAYLOAD_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PAYLOAD_PLIST")
PAYLOAD_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PAYLOAD_PLIST")
[ "$PAYLOAD_VERSION" = "$VERSION" ] || fail "PKG payload version mismatch: $PAYLOAD_VERSION"
[ "$PAYLOAD_ID" = "com.dominionstar.desktop" ] || fail "PKG payload bundle ID mismatch: $PAYLOAD_ID"
grep -F "EXPECTED_VERSION=\"$VERSION\"" "$POSTINSTALL" >/dev/null || fail "postinstall does not attest $VERSION"
grep -F 'EXPECTED_ID="com.dominionstar.desktop"' "$POSTINSTALL" >/dev/null || fail "postinstall bundle attestation missing"

echo "PKG structure verified: version=$PAYLOAD_VERSION bundle=$PAYLOAD_ID"

sudo -n true || fail "Intel runner does not provide non-interactive sudo"
sudo rm -rf "$TEST_APP"
sudo mkdir -p "$TEST_APP/Contents"
cat > "$STALE_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.dominionstar.desktop</string>
  <key>CFBundleShortVersionString</key><string>1.1.8</string>
  <key>CFBundleVersion</key><string>1.1.8</string>
</dict></plist>
PLIST
sudo cp "$STALE_PLIST" "$TEST_PLIST"
sudo touch "$TEST_APP/STALE-1.1.8-SENTINEL"
sudo rm -f "$INSTALL_LOG"

if ! sudo /usr/sbin/installer -verboseR -pkg "$PKG" -target /; then
  show_installer_diagnostics
  fail "macOS Installer rejected the clean-runtime PKG"
fi

[ -f "$TEST_PLIST" ] || { show_installer_diagnostics; fail "Installer did not create Info.plist"; }
[ ! -e "$TEST_APP/STALE-1.1.8-SENTINEL" ] || { show_installer_diagnostics; fail "Stale v1.1.8 bundle survived installation"; }
INSTALLED_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$TEST_PLIST")
INSTALLED_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TEST_PLIST")
[ "$INSTALLED_VERSION" = "$VERSION" ] || { show_installer_diagnostics; fail "Installed version mismatch: $INSTALLED_VERSION"; }
[ "$INSTALLED_ID" = "com.dominionstar.desktop" ] || { show_installer_diagnostics; fail "Installed bundle ID mismatch: $INSTALLED_ID"; }

EXECUTABLE="$TEST_APP/Contents/MacOS/DominionStar Meet"
[ -x "$EXECUTABLE" ] || fail "Installed executable is missing"
ARCHS=$(/usr/bin/lipo -archs "$EXECUTABLE")
echo "$ARCHS" | grep -F 'x86_64' >/dev/null || fail "Universal executable is missing x86_64"
echo "$ARCHS" | grep -F 'arm64' >/dev/null || fail "Universal executable is missing arm64"
sudo grep -F 'Preparing existing app version 1.1.8' "$INSTALL_LOG" >/dev/null || fail "preinstall did not see stale 1.1.8"
sudo grep -F 'Install attested successfully' "$INSTALL_LOG" >/dev/null || fail "postinstall attestation did not pass"

echo "Replacement passed. Launching installed DominionStar Meet on Intel..."
rm -f "$PROBE" "$APP_LOG" "$SAMPLE_LOG"
DOMINIONSTAR_STARTUP_PROBE="$PROBE" "$EXECUTABLE" >"$APP_LOG" 2>&1 &
APP_PID=$!

DEADLINE=$((SECONDS + 20))
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  if [ -f "$PROBE" ] && grep -F '"stage":"event-loop-responsive"' "$PROBE" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    wait "$APP_PID" || true
    show_startup_diagnostics
    fail "Installed app exited before responsive startup"
  fi
  sleep 0.25
done

if [ ! -f "$PROBE" ] || ! grep -F '"stage":"event-loop-responsive"' "$PROBE" >/dev/null 2>&1; then
  show_startup_diagnostics
  fail "Installed app did not reach responsive startup within 20 seconds"
fi

for stage in entry-loaded app-ready window-created local-shell-shown event-loop-responsive; do
  grep -F "\"stage\":\"$stage\"" "$PROBE" >/dev/null || { show_startup_diagnostics; fail "Missing startup stage: $stage"; }
done
grep -F "\"version\":\"$VERSION\"" "$PROBE" >/dev/null || fail "Probe version does not match $VERSION"
grep -F '"arch":"x64"' "$PROBE" >/dev/null || fail "Installed app did not execute natively as x64"

kill "$APP_PID" >/dev/null 2>&1 || true
for _ in {1..20}; do
  kill -0 "$APP_PID" >/dev/null 2>&1 || break
  sleep 0.1
done
kill -9 "$APP_PID" >/dev/null 2>&1 || true
APP_PID=""

echo "macOS Intel acceptance passed: stale 1.1.8 -> $INSTALLED_VERSION; responsive native launch; archs=$ARCHS"
