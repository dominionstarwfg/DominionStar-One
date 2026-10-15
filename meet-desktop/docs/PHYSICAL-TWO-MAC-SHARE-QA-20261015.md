# DominionStar Meet — isolated physical two-Mac screen-share gate

**Branch only:** `cleanup/meeting-ownership-audit-20261014`. Never merge or release based solely on automated test results.

## Setup

1. Install or launch the **same tested branch build** on two physical Macs. If no such build exists, do not claim the test was run.
2. Join the same meeting as presenter (Mac A) and participant (Mac B). Verify the meeting identity manually; diagnostics intentionally exclude participant/room identifiers.
3. On Mac A share a visibly moving test source (e.g. a timer or moving window). On Mac B confirm the source is legible.
4. For each device, open the **meeting renderer's** developer console if available. Do not use the console in the browser hosting GitHub.
5. While the moving source is actively shared, run the line below on Mac A and Mac B within 15 seconds of each other:

```js
copy(JSON.stringify(await window.DominionWebRTCController.diagnosticWindow(4500), null, 2))
```

If the console does not support `copy()`, run:

```js
JSON.stringify(await window.DominionWebRTCController.diagnosticWindow(4500), null, 2)
```

Copy the returned JSON from the console manually. Save the full JSON as `sender.json` (Mac A) and `receiver.json` (Mac B). If the controller is undefined, stop: the meeting renderer or instrumented build is not ready. Do not fabricate JSON. Avoid sharing room IDs, tokens or credentials.

## Offline verification

From the repository root of the matching branch:

```bash
node meet-desktop/scripts/verify-live-share-gate-20261014.mjs --self-test
node meet-desktop/scripts/verify-live-share-gate-20261014.mjs --pair sender.json receiver.json --confirm-same-meeting
node meet-desktop/scripts/audit-two-device-media-evidence-20261014.mjs sender.json receiver.json
```

The confirmation flag is the operator's assertion that both clients were in the same meeting. It is **not** cryptographic or automatic proof. The audit deliberately reports `TECHNICAL_PROGRESS_ONLY` even on good counters; its exit status 3 is not a release failure or a release approval.

## Manual acceptance (required)

- A shared moving timer/window renders smoothly on Mac B with legible content and no flicker, repeated black frames or freeze.
- Start sharing, pause, resume and stop work; screen and companion controls remain responsive.
- Participants, chat and video dock remain interactive during share with the approved sizes and identities.
- Briefly interrupt/recover networking; verify sender/receiver progress again and that stale chrome/windows do not remain.
- End meeting for all (host) or leave (guest); capture stops; app can reopen and quit normally.
- Repeat on the supported macOS targets and capture screenshots/video of any failure.

**Do not approve production** until physical acceptance is documented with real evidence.
