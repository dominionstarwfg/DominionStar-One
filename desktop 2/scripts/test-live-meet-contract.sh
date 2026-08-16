#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
PKG="dist/DominionStar-Meet-${VERSION}-mac-universal.pkg"
APP="/Applications/DominionStar Meet.app"
EXECUTABLE="$APP/Contents/MacOS/DominionStar Meet"
PORT=9222
APP_LOG="/tmp/dominionstar-live-meet.log"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$APP_PID" >/dev/null 2>&1 || true
  fi
  sudo rm -rf "$APP" >/dev/null 2>&1 || true
  rm -f "$APP_LOG"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  cat "$APP_LOG" >&2 2>/dev/null || true
  exit 1
}

[ "$(uname -m)" = "x86_64" ] || fail "Live Meet acceptance must run on Intel macOS"
[ -f "$PKG" ] || fail "Release PKG missing: $PKG"

sudo rm -rf "$APP"
sudo /usr/sbin/installer -pkg "$PKG" -target / >/dev/null
[ -x "$EXECUTABLE" ] || fail "Installed DominionStar executable is missing"

echo "Launching installed DominionStar Meet $VERSION against the live Meet page..."
"$EXECUTABLE" --remote-debugging-port="$PORT" "dominionstar://meet?meeting=1234567890" >"$APP_LOG" 2>&1 &
APP_PID=$!

DEADLINE=$((SECONDS + 20))
until curl -fsS "http://127.0.0.1:${PORT}/json/list" >/dev/null 2>&1; do
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    fail "Installed app exited before live Meet inspection"
  fi
  [ "$SECONDS" -lt "$DEADLINE" ] || fail "Installed app never exposed its renderer for live Meet inspection"
  sleep 0.25
done

DOMINIONSTAR_CDP_PORT="$PORT" node scripts/test-live-meet-contract.mjs || fail "Live Meet desktop release contract acceptance failed"

echo "Installed DominionStar Meet passed the live hosted release-contract acceptance test."
