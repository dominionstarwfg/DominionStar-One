#!/usr/bin/env python3
"""Recover the exact publicly deployed DominionStar Meet source into this branch.

This is intentionally a one-way production-baseline recovery step. It only pulls
same-origin files that are either listed in the live release contract or loaded
by the Meet/Meet Home/Meet Login HTML entrypoints. It never reads secrets or
external origins.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

BASE = "https://dominionstarld.com"
CONTRACT_PATH = "meet/release-contract.json"
ENTRYPOINTS = {
    "meet/index.html",
    "meet-home/index.html",
    "meet-login/index.html",
}
ALLOWED_SUFFIXES = {".js", ".css", ".json", ".html", ".mjs", ".sql"}


def fetch(rel: str) -> bytes:
    rel = rel.lstrip("/")
    url = f"{BASE}/{rel}"
    req = Request(
        url,
        headers={
            "User-Agent": "DominionStar-Production-Source-Recovery/1.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    with urlopen(req, timeout=30) as response:
        return response.read()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_ref(value: str) -> str | None:
    value = (value or "").strip()
    if not value or value.startswith(("data:", "blob:", "mailto:", "tel:", "#")):
        return None
    if value.startswith("//"):
        value = "https:" + value
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        if parsed.netloc not in {"dominionstarld.com", "www.dominionstarld.com"}:
            return None
        value = parsed.path
    value = value.split("?", 1)[0].split("#", 1)[0]
    if not value.startswith("/"):
        return None
    rel = value.lstrip("/")
    if not rel or ".." in Path(rel).parts:
        return None
    if Path(rel).suffix.lower() not in ALLOWED_SUFFIXES:
        return None
    return rel


def discover_html_dependencies(html: str) -> set[str]:
    refs: set[str] = set()
    for match in re.finditer(r'''(?:src|href)\s*=\s*["']([^"']+)["']''', html, re.I):
        ref = normalize_ref(match.group(1))
        if ref:
            refs.add(ref)
    return refs


contract_bytes = fetch(CONTRACT_PATH)
contract = json.loads(contract_bytes.decode("utf-8"))
paths = set(contract.get("files", {}).keys()) | set(ENTRYPOINTS) | {CONTRACT_PATH}

# Discover the complete browser-loaded runtime, not only the subset currently
# represented in release-contract metadata.
for entry in sorted(ENTRYPOINTS):
    body = fetch(entry)
    paths.update(discover_html_dependencies(body.decode("utf-8", errors="replace")))

manifest = {
    "source": BASE,
    "releaseId": contract.get("releaseId"),
    "desktopBridge": contract.get("desktopBridge"),
    "files": {},
}

for rel in sorted(paths):
    if ".." in Path(rel).parts:
        raise SystemExit(f"Unsafe production path: {rel}")
    body = contract_bytes if rel == CONTRACT_PATH else fetch(rel)
    target = Path(rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    manifest["files"][rel] = sha256(body)

Path("PRODUCTION-MEET-SOURCE-MANIFEST.json").write_text(
    json.dumps(manifest, indent=2) + "\n",
    encoding="utf-8",
)

print(f"Recovered {len(manifest['files'])} production files")
print(f"releaseId={manifest['releaseId']}")
print(f"desktopBridge={manifest['desktopBridge']}")
for rel, digest in manifest["files"].items():
    print(digest, rel)
