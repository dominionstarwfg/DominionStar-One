#!/bin/bash
set -euo pipefail

MEET_URL="https://dominionstarld.com/meet/?desktop=1"
CONTRACT_URL="https://dominionstarld.com/meet/release-contract.json"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

HTML="$TMP_DIR/meet.html"
CONTRACT="$TMP_DIR/release-contract.json"
echo "Auditing live DominionStar Meet runtime: $MEET_URL"
curl -fsSL --retry 2 --connect-timeout 10 --max-time 30 "$MEET_URL" -o "$HTML"

echo "Auditing live desktop release contract: $CONTRACT_URL"
curl -fsSL --retry 2 --connect-timeout 10 --max-time 30 "$CONTRACT_URL" -o "$CONTRACT"
python3 - "$CONTRACT" <<'PY'
from pathlib import Path
import json, sys
path=Path(sys.argv[1])
try:
    contract=json.loads(path.read_text())
except Exception as exc:
    raise SystemExit(f'ERROR: release-contract.json is invalid JSON: {exc}')
release_id=str(contract.get('releaseId') or '').strip()
bridge=contract.get('desktopBridge')
if not release_id:
    raise SystemExit('ERROR: release-contract.json has no releaseId')
try:
    bridge_num=int(bridge)
except Exception:
    raise SystemExit(f'ERROR: release-contract.json has invalid desktopBridge: {bridge!r}')
print('LIVE_RELEASE_CONTRACT '+json.dumps(contract,sort_keys=True,separators=(',',':')))
print(f'LIVE_RELEASE_ID {release_id}')
print(f'LIVE_DESKTOP_BRIDGE {bridge_num}')
PY

python3 - "$HTML" > "$TMP_DIR/scripts.txt" <<'PY'
from html.parser import HTMLParser
from pathlib import Path
import sys

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls=[]
    def handle_starttag(self, tag, attrs):
        if tag.lower() != 'script':
            return
        values=dict(attrs)
        src=values.get('src')
        if src:
            self.urls.append(src)

parser=Scripts()
parser.feed(Path(sys.argv[1]).read_text(errors='replace'))
for url in parser.urls:
    print(url)
PY

if [ ! -s "$TMP_DIR/scripts.txt" ]; then
  echo "ERROR: Live Meet page exposed no script sources; deployment is not auditable." >&2
  exit 1
fi

BLOCKER_FOUND=0
UNTRACKED=0
INDEX=0
while IFS= read -r SRC; do
  [ -n "$SRC" ] || continue
  case "$SRC" in
    http://*|https://*) URL="$SRC" ;;
    /*) URL="https://dominionstarld.com$SRC" ;;
    *) URL="https://dominionstarld.com/${SRC#./}" ;;
  esac

  INDEX=$((INDEX + 1))
  FILE="$TMP_DIR/script-$INDEX.js"
  if ! curl -fsSL --retry 1 --connect-timeout 10 --max-time 30 "$URL" -o "$FILE"; then
    echo "LIVE_FETCH_FAILED $URL"
    continue
  fi

  CLEAN_PATH=${SRC%%\?*}
  if [[ "$CLEAN_PATH" == /assets/js/* ]] && [ ! -f "../${CLEAN_PATH#/}" ]; then
    echo "UNTRACKED_HOSTED_SCRIPT $CLEAN_PATH"
    UNTRACKED=$((UNTRACKED + 1))
  fi

  if grep -Einq 'Desktop update required|certified meeting release|update[-_ ]required|installed app does not match the certified' "$FILE"; then
    echo "HOSTED_DESKTOP_BLOCKER $URL"
    MATCH_LINE=$(grep -Ein 'Desktop update required|certified meeting release|update[-_ ]required|installed app does not match the certified' "$FILE" | head -n 1 | cut -d: -f1)
    START=$(( MATCH_LINE > 20 ? MATCH_LINE - 20 : 1 ))
    END=$(( MATCH_LINE + 20 ))
    echo "----- blocker context lines ${START}-${END} -----"
    nl -ba "$FILE" | sed -n "${START},${END}p"
    echo "----- end blocker context -----"
    BLOCKER_FOUND=1
  fi
done < "$TMP_DIR/scripts.txt"

echo "Live scripts inspected: $INDEX"
echo "Live scripts absent from repository source: $UNTRACKED"

if [ "$BLOCKER_FOUND" -ne 0 ]; then
  echo "ERROR: The live hosted runtime still contains a desktop update-lockout implementation." >&2
  exit 2
fi

echo "Live hosted runtime contains no known DominionStar desktop update-lockout phrase."
