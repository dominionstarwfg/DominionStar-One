#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
PKG="dist/DominionStar-Meet-${VERSION}-mac-universal.pkg"
STAGED_PLIST="dist/mac-universal/DominionStar Meet.app/Contents/Info.plist"
TEST_APP="/Applications/DominionStar Meet.app"
TEST_PLIST="$TEST_APP/Contents/Info.plist"
AUDIT_DIR="dist/pkg-audit"
STALE_PLIST="/tmp/dominionstar-stale.plist"
INSTALL_LOG="/var/log/dominionstar-meet-installer.log"

cleanup() {
  sudo rm -rf "$TEST_APP" >/dev/null 2>&1 || true
  rm -rf "$AUDIT_DIR" "$STALE_PLIST"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[ -f "$PKG" ] || fail "Replacement PKG is missing: $PKG"
[ -f "$STAGED_PLIST" ] || fail "Staged universal app Info.plist is missing"

STAGED_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$STAGED_PLIST")
STAGED_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$STAGED_PLIST")
[ "$STAGED_VERSION" = "$VERSION" ] || fail "Staged app version mismatch: expected $VERSION, found $STAGED_VERSION"
[ "$STAGED_ID" = "com.dominionstar.desktop" ] || fail "Staged app bundle ID mismatch: $STAGED_ID"
echo "Staged app identity verified: version=$STAGED_VERSION bundle=$STAGED_ID"

rm -rf "$AUDIT_DIR"
/usr/sbin/pkgutil --expand-full "$PKG" "$AUDIT_DIR"

PAYLOAD_PLIST=$(find "$AUDIT_DIR" -type f -path '*/Applications/DominionStar Meet.app/Contents/Info.plist' -print -quit)
PREINSTALL=$(find "$AUDIT_DIR" -type f -name preinstall -print -quit)
POSTINSTALL=$(find "$AUDIT_DIR" -type f -name postinstall -print -quit)

if [ -z "$PAYLOAD_PLIST" ]; then
  find "$AUDIT_DIR" -maxdepth 5 -print | sort
  fail "Native PKG is missing the DominionStar Meet application payload"
fi
if [ -z "$PREINSTALL" ]; then
  find "$AUDIT_DIR" -maxdepth 5 -print | sort
  fail "Native PKG is missing the preinstall stale-app replacement hook"
fi
if [ -z "$POSTINSTALL" ]; then
  find "$AUDIT_DIR" -maxdepth 5 -print | sort
  fail "Native PKG is missing the postinstall version-attestation hook"
fi

/bin/sh -n "$PREINSTALL"
/bin/sh -n "$POSTINSTALL"
PAYLOAD_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PAYLOAD_PLIST")
PAYLOAD_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PAYLOAD_PLIST")
[ "$PAYLOAD_VERSION" = "$VERSION" ] || fail "PKG payload version mismatch: $PAYLOAD_VERSION"
[ "$PAYLOAD_ID" = "com.dominionstar.desktop" ] || fail "PKG payload bundle ID mismatch: $PAYLOAD_ID"
grep -F '/Applications/DominionStar Meet.app' "$PREINSTALL" >/dev/null
grep -F "EXPECTED_VERSION=\"$VERSION\"" "$POSTINSTALL" >/dev/null
grep -F 'EXPECTED_ID="com.dominionstar.desktop"' "$POSTINSTALL" >/dev/null
echo "Native PKG structure verified: payload=$PAYLOAD_VERSION hooks=present"

sudo -n true || fail "macOS runner does not provide non-interactive sudo required for installer smoke test"
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

echo "Installing native PKG over synthetic stale DominionStar Meet v1.1.8..."
sudo /usr/sbin/installer -pkg "$PKG" -target /

[ -f "$TEST_PLIST" ] || fail "Installer did not create the DominionStar Meet Info.plist"
[ ! -e "$TEST_APP/STALE-1.1.8-SENTINEL" ] || fail "Stale v1.1.8 bundle survived package installation"

INSTALLED_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$TEST_PLIST")
INSTALLED_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TEST_PLIST")
[ "$INSTALLED_VERSION" = "$VERSION" ] || fail "Installed version mismatch: expected $VERSION, found $INSTALLED_VERSION"
[ "$INSTALLED_ID" = "com.dominionstar.desktop" ] || fail "Installed bundle ID mismatch: $INSTALLED_ID"
[ -x "$TEST_APP/Contents/MacOS/DominionStar Meet" ] || fail "Installed executable is missing"

ARCHS=$(/usr/bin/lipo -archs "$TEST_APP/Contents/MacOS/DominionStar Meet")
echo "$ARCHS" | grep -F 'x86_64' >/dev/null || fail "Installed executable is missing x86_64 architecture"
echo "$ARCHS" | grep -F 'arm64' >/dev/null || fail "Installed executable is missing arm64 architecture"

sudo test -f "$INSTALL_LOG" || fail "Installer attestation log was not created"
sudo grep -F '[preinstall]' "$INSTALL_LOG" >/dev/null || fail "preinstall hook did not execute"
sudo grep -F 'Removing existing app version 1.1.8' "$INSTALL_LOG" >/dev/null || fail "preinstall hook did not detect/remove stale v1.1.8"
sudo grep -F 'Install attested successfully' "$INSTALL_LOG" >/dev/null || fail "postinstall attestation did not execute successfully"

echo "macOS native PKG replacement smoke test passed: 1.1.8 -> $INSTALLED_VERSION; archs=$ARCHS"
