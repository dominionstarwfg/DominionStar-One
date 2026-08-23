#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
APP="dist/mac-universal/DominionStar Meet.app"
PLIST="$APP/Contents/Info.plist"
SCRIPTS_DIR="build/pkg-scripts"
STAGE_ROOT="dist/native-pkg-root"
STAGE_APP="$STAGE_ROOT/Applications/DominionStar Meet.app"
COMPONENTS_PLIST="dist/native-pkg-components.plist"
PKG="dist/DominionStar-Meet-${VERSION}-mac-universal.pkg"

if [ ! -f "$PLIST" ]; then
  echo "ERROR: Universal DominionStar Meet app is missing: $PLIST" >&2
  exit 1
fi

APP_VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")
APP_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")

if [ "$APP_VERSION" != "$VERSION" ]; then
  echo "ERROR: Universal app version mismatch: expected $VERSION, found $APP_VERSION" >&2
  exit 1
fi

if [ "$APP_ID" != "com.dominionstar.desktop" ]; then
  echo "ERROR: Universal app bundle ID mismatch: $APP_ID" >&2
  exit 1
fi

chmod 0755 "$SCRIPTS_DIR/preinstall" "$SCRIPTS_DIR/postinstall"
rm -rf "$STAGE_ROOT" "$COMPONENTS_PLIST" "$PKG"
mkdir -p "$STAGE_ROOT/Applications"
/usr/bin/ditto "$APP" "$STAGE_APP"

cat > "$COMPONENTS_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
  <dict>
    <key>RootRelativeBundlePath</key>
    <string>Applications/DominionStar Meet.app</string>
    <key>BundleIsRelocatable</key>
    <false/>
    <key>BundleIsVersionChecked</key>
    <false/>
    <key>BundleHasStrictIdentifier</key>
    <true/>
    <key>BundleOverwriteAction</key>
    <string>upgrade</string>
  </dict>
</array>
</plist>
PLIST

/usr/bin/plutil -lint "$COMPONENTS_PLIST" >/dev/null

/usr/bin/pkgbuild \
  --root "$STAGE_ROOT" \
  --component-plist "$COMPONENTS_PLIST" \
  --identifier "com.dominionstar.desktop.pkg" \
  --version "$VERSION" \
  --install-location "/" \
  --ownership recommended \
  --scripts "$SCRIPTS_DIR" \
  "$PKG"

if [ ! -f "$PKG" ]; then
  echo "ERROR: Apple pkgbuild did not produce $PKG" >&2
  exit 1
fi

rm -rf "$STAGE_ROOT" "$COMPONENTS_PLIST"
echo "Built deterministic macOS replacement PKG: $PKG"
