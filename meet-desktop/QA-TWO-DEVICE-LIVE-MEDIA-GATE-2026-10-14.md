# DominionStar Meet — Physical two-device media and approved UI gate

**Candidate:** `cleanup/meeting-ownership-audit-20261014` (source-only, currently release-blocked).
**Status:** NOT RUN on real devices. No installer is authorized by this document.
**Reference:** `QA-APPROVED-MULTIPARTICIPANT-SHARING-STANDARD-2026-10-14.md` and user-provided reference screenshots.

## Objective

Establish that a sender's **real** screen-sharing video reaches another Mac/browser, is decoded over time, and remains visible at the same time as stable camera tiles and a clean Participants roster. A connected ICE peer, an active screen-share banner, test-suite pass or a one-frame image is **not** enough.

## Test setup

- Two physically separate devices, A (host Mac desktop) and B (guest Mac or browser), on the **same source revision/build**. Record macOS, browser/app build identifier, display resolution, and local screen-sharing permission on each. If these cannot be checked, mark NOT TESTED.
- Both join the **same actual room** with consent for testing; confirm participant counts on both bottom toolbar and Participants window.
- Use a source with motion and changing pixels: a video playing on the host display plus several slide changes. A static photograph alone does not demonstrate decoded motion.
- Begin with 2 people and repeat the UI/roster test with 7 participants (Host, Co-host, and 5 ordinary guests) where available.
- Never rely on an old 2.0.52 installation whose binary identity is ambiguous. Do not package or install a candidate until expressly approved for a controlled QA run.

## Live screen-share procedure (perform while actively sharing)

1. A joins and turns camera on, B joins with camera on. Confirm **each** can see the other's live motion and hears audio. Toggle camera off/on; verify video → real profile photo → full name (not initials) fallback in video panel, while roster uses photo/initial badge.
2. A shares a window/screen **with changing motion**. B confirms the content is actually visible and moving, not black, frozen, the desktop background, or merely a green border/banner.
3. If diagnostic access is available in the build, run the following **read-only command** in A's meeting-renderer developer console while motion continues. Repeat on B, preferably over the same approximately five-second interval:

```js
await window.DominionWebRTCController.diagnosticWindow(5000)
```

   The command does **not** activate sharing, change media tracks, open ports, or upload diagnostic data. It returns anonymized per-peer sequence numbers rather than participant names/room identifiers. If the developer console is inaccessible, report **DIAGNOSTIC NOT RUN**; do not infer counters.
   To compare the two reports offline, save the **redacted** output objects as `host-report.json` and `guest-report.json` and run this from the project directory on the QA machine:

```sh
node scripts/audit-two-device-media-evidence-20261014.mjs host-report.json guest-report.json
```

   This comparator is scoped to **exactly two participants**. It reports `FAIL` for observed transmission, decoding, transport or playback faults, `UNVERIFIED` for missing/ambiguous evidence, and `TECHNICAL_PROGRESS_ONLY` when metrics look healthy. It **never outputs release approval**, even for successful media counters. The command exits nonzero for **all** states: `1` = FAIL, `2` = UNVERIFIED, `3` = TECHNICAL_PROGRESS_ONLY. This prevents an automated script from treating the comparator as a release-success gate. Preserve the original local reports only in an access-controlled QA location and do not include tokens, SDP, participant names or room IDs.

4. Interpret the sender and receiver independently:
   - **A:** `screenSendersWithFrameProgress > 0` for the appropriate peer(s) and `peerLanes[].lanes.screen.outbound.frames > 0`. This establishes outbound frame activity, not guest delivery.
   - **B:** `screenReceiversWithDecodedFrameProgress > 0` and corresponding `peerLanes[].lanes.screen.inbound.frames > 0` during motion. `remoteSharePlayback.visible === true`, `width > 0`, `height > 0` and `secondsAdvanced > 0`. When `renderedFramesAdvanced` is available, it must also be positive; a ticking playback clock with zero displayed-frame progress is **FAIL**. The guest must independently **see moving content**.
   - If sender progresses but B does not decode, fail **receiver delivery**. If neither progresses, fail **screen capture/transmit**. If counters progress but the actual stage is black, clipped, or behind an overlay, fail **rendering/layout**. If statistics are unavailable or ambiguous, mark **UNVERIFIED**, not PASS.
5. Keep sharing for at least 60 seconds. Observe for blackouts, panel flicker, jumping video tiles, disappearing controls, out-of-sync speakers, and increasing receiver frame progress. Test active speech from each participant while the share remains the dominant stage.
6. Stop sharing, then start a **second** share. Confirm no stranded presenter toolbar, capture indicator or old frame, and that B receives the second changing source. Repeat B → A if both devices support presenting.

## Seven-participant visual gate

- Participants title and toolbar count both correctly report **7** and update on leave/rejoin.
- Host and Co-host designations, full name, photo/initial badge, mic and camera indicators, and per-person More menu remain readable **without crowding**.
- Roster order does not oscillate or blink. Only participant rows scroll; header, search, and Invite/Mute all/More footer remain fixed.
- A normal participant may open a profile and send a private chat, but cannot use host/co-host moderation. Manager mute/ask-to-unmute/stop-video/menu actions must be functional and permission-checked.
- On a large window, the video panel is vertical at right, with up to five visible video tiles and internal scrolling. On a constrained window, it transitions to a horizontal strip at top and scrolls **inside itself**. Minor resizes must not oscillate placement.
- Tiles follow **live video → actual profile photo → full display name**. Only small roster badges may use initials. Confirm the same standard on the ordinary guest's computer.
- Single muted slash only. Real active speaker is visually indicated, with screen sharing taking stage precedence while active.

## Capture and release lifecycle

Stop camera, stop share, leave and end-for-all. Verify media tracks and all floating companion windows/toolbars disappear. Reopen, rejoin, start a new share and repeat. No duplicate toolbars, camera indicator, stale renderer or room reconnect loop.

## Evidence required for signoff

Capture before/during/after screenshots **from A and B**, the actual desktop/app build SHA, screen dimensions, audio/video/share toggle sequence, 5-second anonymized sender/receiver diagnostic results where available, and a report of any blink/freeze/black-frame observation. Review the actual moving content, not screenshots alone.

**Decision:** One failed visible requirement on either device = **REJECT**. Missing evidence = **UNVERIFIED**. Only sustained live function and approved visual parity on both devices qualify for consideration for a controlled release. Source checks and mocks remain separate evidence classes.
