#!/usr/bin/env python3
import hashlib
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "https://dominionstarld.com"
OUT = Path("production-audit")
LIVE = OUT / "live"
OUT.mkdir(exist_ok=True)
LIVE.mkdir(exist_ok=True)


def fetch(path: str) -> tuple[bytes, dict]:
    url = BASE + (path if path.startswith("/") else "/" + path)
    req = Request(url, headers={"User-Agent": "DominionStar-Production-Audit/1.0", "Cache-Control": "no-cache"})
    with urlopen(req, timeout=30) as r:
        body = r.read()
        headers = {k.lower(): v for k, v in r.headers.items()}
        return body, headers


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

contract_bytes, contract_headers = fetch("/meet/release-contract.json")
contract = json.loads(contract_bytes.decode("utf-8"))
(LIVE / "meet-release-contract.json").write_bytes(contract_bytes)

paths = set(contract.get("files", {}).keys())
paths.update({
    "meet/index.html",
    "assets/js/meeting-engine.js",
    "assets/js/meet-next/executive6.js",
    "assets/js/meet/dock-layout-v2.js",
    "assets/css/meet/dock-layout-v2.css",
})

report = {
    "base": BASE,
    "releaseId": contract.get("releaseId"),
    "desktopBridge": contract.get("desktopBridge"),
    "contractHeaders": contract_headers,
    "files": [],
    "summary": {},
}

for rel in sorted(paths):
    entry = {"path": rel}
    try:
        body, headers = fetch("/" + rel)
        target = LIVE / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        live_hash = sha256(body)
        entry.update({
            "live": True,
            "liveSha256": live_hash,
            "contractSha256": contract.get("files", {}).get(rel),
            "headers": {k: headers.get(k) for k in ["etag", "last-modified", "cache-control", "age", "server", "content-type"] if headers.get(k)},
        })
    except Exception as exc:
        entry.update({"live": False, "error": repr(exc)})
        report["files"].append(entry)
        continue

    local = Path(rel)
    if local.exists() and local.is_file():
        local_body = local.read_bytes()
        local_hash = sha256(local_body)
        entry.update({"local": True, "localSha256": local_hash, "matchesLocal": local_hash == entry["liveSha256"]})
    else:
        entry.update({"local": False, "matchesLocal": False})

    text = ""
    try:
        text = body.decode("utf-8", errors="replace")
    except Exception:
        pass
    entry["markers"] = {
        "rc13MediaRoomParity": "rc13-media-room-parity" in text,
        "dominionMeetQuality": "DominionMeetQuality" in text,
        "couldNotStartVideoSource": "Could not start video source" in text,
        "dockRuntimeHardening": "RC13 quality hardening" in text,
        "meetingParam": "meeting=" in text or "searchParams.get('meeting')" in text or 'searchParams.get("meeting")' in text,
    }
    report["files"].append(entry)

matched = [f for f in report["files"] if f.get("local") and f.get("matchesLocal")]
diverged = [f for f in report["files"] if f.get("local") and not f.get("matchesLocal")]
missing_local = [f for f in report["files"] if f.get("live") and not f.get("local")]
missing_live = [f for f in report["files"] if not f.get("live")]
report["summary"] = {
    "checked": len(report["files"]),
    "matchedLocal": len(matched),
    "divergedFromLocal": len(diverged),
    "missingFromRepository": len(missing_local),
    "missingLive": len(missing_live),
    "divergedPaths": [f["path"] for f in diverged],
    "missingRepositoryPaths": [f["path"] for f in missing_local],
}

Path(OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

print(json.dumps(report["summary"], indent=2))
print(f"LIVE_RELEASE_ID={report['releaseId']}")
print(f"LIVE_DESKTOP_BRIDGE={report['desktopBridge']}")

# The audit is diagnostic. It fails only if production cannot be read at all.
if missing_live:
    raise SystemExit(f"Production audit could not fetch {len(missing_live)} required files")
