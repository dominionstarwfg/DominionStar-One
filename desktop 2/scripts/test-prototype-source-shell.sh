#!/bin/bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

PORT=9224
APP_LOG="/tmp/dominionstar-prototype-source-shell.log"
USER_DATA="/tmp/dominionstar-prototype-source-shell-profile"
APP_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$APP_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$USER_DATA"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  echo "--- DominionStar source-shell log ---" >&2
  cat "$APP_LOG" >&2 2>/dev/null || true
  echo "--- end source-shell log ---" >&2
  exit 1
}

rm -rf "$USER_DATA"
rm -f "$APP_LOG"
mkdir -p "$USER_DATA"

ELECTRON_ENABLE_LOGGING=1 ./node_modules/.bin/electron . \
  --user-data-dir="$USER_DATA" \
  --remote-debugging-port="$PORT" >"$APP_LOG" 2>&1 &
APP_PID=$!

DEADLINE=$((SECONDS + 20))
until curl -fsS "http://127.0.0.1:${PORT}/json/list" >/dev/null 2>&1; do
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    fail "Prototype source shell exited before renderer inspection"
  fi
  [ "$SECONDS" -lt "$DEADLINE" ] || fail "Prototype source shell never exposed a renderer"
  sleep 0.25
done

if ! DOMINIONSTAR_CDP_PORT="$PORT" node scripts/test-live-meet-contract.mjs; then
  fail "Prototype source shell failed hosted Meet navigation/contract acceptance"
fi

echo "DOMINIONSTAR_PROTOTYPE_SOURCE_SHELL_OK"
