#!/usr/bin/env python3
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

BASE = "https://dominionstarld.com"
OUT = Path("production-audit")
LIVE = OUT / "live"
OUT.mkdir(exist_ok=True)
LIVE.mkdir(exist_ok=True)

HTML_ENTRYPOINTS = {
    "meet/index.html",
    "meet-home/index.html",
    "meet-login/index.html",
}


def fetch(path: str) -> tuple[bytes, dict]:
    url = BASE + (path if path.startswith("/") else "/" + path)
    req = Request(
        url,
        headers={
            "User-Agent": "DominionStar-Production-Audit/2.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    with urlopen(req, timeout=30) as r:
        body = r.read()
        headers = {k.lower(): v for k, v in r.headers.items()}
        return body, headers


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_reference(value: str) -> str | None:
    value = (value or "").strip()
    if not value or value.startswith(("data:", "blob:", "mailto:", "tel:", "#")):
        return None
    if value.startswith("//"):
        value = "https:" + value
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        if parsed.netloc not in {"dominionstarld.com", "www.dominionstarld.com"}:
            return None
        value = parsed.path
    value = value.split("?", 1)[0].split("#", 1)[0]
    if not value.startswith("/"):
        return None
    rel = value.lstrip("/")
    if not rel or rel.endswith("/"):
        return None
    if not re.search(r"\.(?:js|css|json|html|mjs|sql)$", rel, re.I):
        return None
    return rel


def discover_html_dependencies(html: str) -> set[str]:
    refs = set()
    for match in re.finditer(r'''(?:src|href)\s*=\s*["']([^"']+)["']''', html, re.I):
        ref = normalize_reference(match.group(1))
        if ref:
            refs.add(ref)
    return refs


contract_bytes, contract_headers = fetch("/meet/release-contract.json")
contract = json.loads(contract_bytes.decode("utf-8"))
(LIVE / "meet-release-contract.json").write_bytes(contract_bytes)

paths = set(contract.get("files", {}).keys()) | set(HTML_ENTRYPOINTS)

# Discover every same-origin JS/CSS/JSON dependency loaded by the actual Meet,
# Meet Home and Meet Login entrypoints. This closes the gap where release-contract
# metadata covered only part of the runtime that browsers were actually executing.
for page in sorted(HTML_ENTRYPOINTS):
    try:
        body, _ = fetch("/" + page)
        target = LIVE / page
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        paths.update(discover_html_dependencies(body.decode("utf-8", errors="replace")))
    except Exception:
        # The main fetch loop below records the exact failure.
        pass

report = {
    "base": BASE,
    "releaseId": contract.get("releaseId"),
    "desktopBridge": contract.get("desktopBridge"),
    "contractHeaders": contract_headers,
    "files": [],
    "summary": {},
}

for rel in sorted(paths):
    entry = {"path": rel, "inReleaseContract": rel in contract.get("files", {})}
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
            "contractHashMatchesLive": (
                contract.get("files", {}).get(rel) == live_hash
                if rel in contract.get("files", {})
                else None
            ),
            "headers": {
                k: headers.get(k)
                for k in ["etag", "last-modified", "cache-control", "age", "server", "content-type"]
                if headers.get(k)
            },
        })
    except Exception as exc:
        entry.update({"live": False, "error": repr(exc)})
        report["files"].append(entry)
        continue

    local = Path(rel)
    if local.exists() and local.is_file():
        local_body = local.read_bytes()
        local_hash = sha256(local_body)
        entry.update({
            "local": True,
            "localSha256": local_hash,
            "matchesLocal": local_hash == entry["liveSha256"],
        })
    else:
        entry.update({"local": False, "matchesLocal": False})

    text = body.decode("utf-8", errors="replace")
    entry["markers"] = {
        "cameraReleaseDelay": "lastVideoOffAt" in text or "cameraRelease" in text,
        "cameraRetry": "NotReadableError" in text and ("retry" in text.lower() or "attempt" in text.lower()),
        "rc13MediaRoomParity": "rc13-media-room-parity" in text,
        "dominionMeetQuality": "DominionMeetQuality" in text,
        "desktopUpdateRequired": "Desktop update required" in text,
        "couldNotStartVideoSource": "Could not start video source" in text,
        "meetingParam": "meeting=" in text or "searchParams.get('meeting')" in text or 'searchParams.get("meeting")' in text,
    }
    report["files"].append(entry)

matched = [f for f in report["files"] if f.get("local") and f.get("matchesLocal")]
diverged = [f for f in report["files"] if f.get("local") and not f.get("matchesLocal")]
missing_local = [f for f in report["files"] if f.get("live") and not f.get("local")]
missing_live = [f for f in report["files"] if not f.get("live")]
contract_mismatches = [
    f for f in report["files"]
    if f.get("inReleaseContract") and f.get("contractHashMatchesLive") is False
]
report["summary"] = {
    "checked": len(report["files"]),
    "matchedLocal": len(matched),
    "divergedFromLocal": len(diverged),
    "missingFromRepository": len(missing_local),
    "missingLive": len(missing_live),
    "releaseContractHashMismatches": len(contract_mismatches),
    "divergedPaths": [f["path"] for f in diverged],
    "missingRepositoryPaths": [f["path"] for f in missing_local],
    "contractMismatchPaths": [f["path"] for f in contract_mismatches],
}

Path(OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

print(json.dumps(report["summary"], indent=2))
print(f"LIVE_RELEASE_ID={report['releaseId']}")
print(f"LIVE_DESKTOP_BRIDGE={report['desktopBridge']}")

# Diagnostic workflow: fail only when production cannot be read or when the live
# release contract lies about bytes it claims to certify. Source divergence is
# reported explicitly and is handled as a separate deployment-alignment defect.
if missing_live:
    raise SystemExit(f"Production audit could not fetch {len(missing_live)} required files")
if contract_mismatches:
    raise SystemExit(f"Live release contract hash mismatch for {len(contract_mismatches)} files")
