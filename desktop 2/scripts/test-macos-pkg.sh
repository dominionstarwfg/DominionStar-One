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
STARTUP_PROBE="/tmp/dominionstar-startup-proof.jsonl"
STARTUP_LOG="/tmp/dominionstar-startup-proof.log"
INSTALL_LOG="/var/log/dominionstar-meet-installer.log"
SYSTEM_INSTALL_LOG="/var/log/install.log"

cleanup() {
  sudo rm -rf "$TEST_APP" >/dev/null 2>&1 || true
  rm -rf "$AUDIT_DIR" "$STALE_PLIST" "$STARTUP_PROBE" "$STARTUP_LOG"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

show_installer_diagnostics() {
  echo "----- DominionStar installer hook log -----" >&2
  if sudo test -f "$INSTALL_LOG"; then
    sudo cat "$INSTALL_LOG" >&2 || true
  else
    echo "(hook log not created)" >&2
  fi
  echo "----- macOS install.log tail -----" >&2
  sudo tail -n 120 "$SYSTEM_INSTALL_LOG" >&2 || true
}

[ "$(uname -m)" = "x86_64" ] || fail "This proof must run on Intel macOS; runner architecture is $(uname -m)"
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
PACKAGE_INFO=$(find "$AUDIT_DIR" -type f -name PackageInfo -print -quit)

if [ -z "$PAYLOAD_PLIST" ]; then
  find "$AUDIT_DIR" -maxdepth 5 -print | sort
  fail "Native PKG is missing the DominionStar Meet application payload"
fi
if [ -z "$PREINSTALL" ]; then
  find "$AUDIT_DIR" -maxdepth 5 -print | sort
  fail "Native PKG is missing the preinstall hook"
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
if [ -n "$PACKAGE_INFO" ]; then
  grep -E 'relocat|overwrite|upgrade' "$PACKAGE_INFO" || true
fi
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

echo "Installing native PKG over synthetic stale DominionStar Meet v1.1.8 on Intel macOS..."
if ! sudo /usr/sbin/installer -verboseR -pkg "$PKG" -target /; then
  show_installer_diagnostics
  fail "macOS Installer rejected the native replacement PKG"
fi

[ -f "$TEST_PLIST" ] || { show_installer_diagnostics; fail "Installer did not create the DominionStar Meet Info.plist"; }
[ ! -e "$TEST_APP/STALE-1.1.8-SENTINEL" ] || { show_installer_diagnostics; fail "Stale v1.1.8 bundle survived package installation"; }

INSTALLED_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$TEST_PLIST")
INSTALLED_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$TEST_PLIST")
[ "$INSTALLED_VERSION" = "$VERSION" ] || { show_installer_diagnostics; fail "Installed version mismatch: expected $VERSION, found $INSTALLED_VERSION"; }
[ "$INSTALLED_ID" = "com.dominionstar.desktop" ] || { show_installer_diagnostics; fail "Installed bundle ID mismatch: $INSTALLED_ID"; }
[ -x "$TEST_APP/Contents/MacOS/DominionStar Meet" ] || { show_installer_diagnostics; fail "Installed executable is missing"; }

ARCHS=$(/usr/bin/lipo -archs "$TEST_APP/Contents/MacOS/DominionStar Meet")
echo "$ARCHS" | grep -F 'x86_64' >/dev/null || fail "Installed executable is missing x86_64 architecture"
echo "$ARCHS" | grep -F 'arm64' >/dev/null || fail "Installed executable is missing arm64 architecture"

sudo test -f "$INSTALL_LOG" || fail "Installer attestation log was not created"
sudo grep -F '[preinstall]' "$INSTALL_LOG" >/dev/null || fail "preinstall hook did not execute"
sudo grep -F 'Preparing existing app version 1.1.8' "$INSTALL_LOG" >/dev/null || fail "preinstall hook did not detect stale v1.1.8"
sudo grep -F 'Install attested successfully' "$INSTALL_LOG" >/dev/null || fail "postinstall attestation did not execute successfully"

echo "Package replacement passed. Launching the installed app on Intel to prove native startup responsiveness..."
rm -f "$STARTUP_PROBE" "$STARTUP_LOG"
DOMINIONSTAR_STARTUP_PROBE="$STARTUP_PROBE" "$TEST_APP/Contents/MacOS/DominionStar Meet" >"$STARTUP_LOG" 2>&1 &
APP_PID=$!

for _ in {1..30}; do
  if [ -f "$STARTUP_PROBE" ] && grep -F '"stage":"event-loop-responsive"' "$STARTUP_PROBE" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! wait "$APP_PID"; then
  cat "$STARTUP_LOG" >&2 || true
  fail "Installed DominionStar Meet exited with an error during Intel startup proof"
fi

[ -f "$STARTUP_PROBE" ] || { cat "$STARTUP_LOG" >&2 || true; fail "Installed app did not create a startup proof"; }
grep -F '"stage":"window-created"' "$STARTUP_PROBE" >/dev/null || fail "Native BrowserWindow was never created"
grep -F '"stage":"local-shell-shown"' "$STARTUP_PROBE" >/dev/null || fail "Local startup shell was never shown"
grep -F '"stage":"event-loop-responsive"' "$STARTUP_PROBE" >/dev/null || fail "Electron event loop did not remain responsive after startup"
grep -F "\"version\":\"$VERSION\"" "$STARTUP_PROBE" >/dev/null || fail "Startup proof did not execute the expected app version"
grep -F '"arch":"x64"' "$STARTUP_PROBE" >/dev/null || fail "Startup proof did not execute natively as x64 on Intel"

echo "macOS Intel end-to-end proof passed: stale 1.1.8 -> $INSTALLED_VERSION; app launched responsively; archs=$ARCHS"
