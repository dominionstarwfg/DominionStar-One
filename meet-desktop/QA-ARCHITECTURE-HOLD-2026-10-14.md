# DominionStar Meet — physical QA rejection and architecture hold (2026-10-14)

**Status:** NOT ACCEPTED. No distributable release from this cleanup branch. Rejected PR #176 is closed unmerged. Main is not altered by these source-only changes.

## What the physical screenshots establish
- User-visible prejoin profile photo is replaced by initials; stage can show overlapping fallback characters.
- Guest joining changes stage and filmstrip unexpectedly; remote camera image can be absent or black; participant can report blinking.
- Presenter-side sharing controls can appear without the browser recipient receiving shared frames.
- Native video companion uses poor fallback composition, labels overlap, and a participant's camera state is not reliably reflected.
- Participants panel chrome crowds the header; user reports inaccessible attendee controls.
- Native annotation palette is vertical and takes a large fraction of the shared screen instead of the approved compact horizontal row.
- Network-status banner may report retries. The screenshot does not identify whether this represents ICE failure, track binding, or compositor failure.

## Proven code-level defects and cleanup committed on isolated branch

| Code location | Fault | Cleanup |
| --- | --- | --- |
| `ui/app.js` `openPrejoin` | Forces `#prejoinAvatar.textContent = initials`, destroying photo. | Use authenticated avatar image with fallback and refresh the canonical profile photo controller. |
| `ui/app.js` `enterRoom` | Again forces `#stageAvatar.textContent = initials`. | Preserve the authenticated image. |
| `ui/app.js` `setAvatar` | Broken image onerror leaves `has-photo` behind. | Remove stale photo state when falling back. |
| `ui/approved-reference-parity.js` | Competing avatar painter rewrites the same DOM as `profile-photo-fallback.js`. | Yield image painting to canonical controller after it exists. |
| `ui/meeting-parity.js` `syncSpeakerFallbackIdentity` | Clones both fallback photo and initials into the speaker avatar, which makes duplicate glyphs visible. | Clone one rendered identity only. |
| `ui/meeting-parity.js` `syncActiveSpeakerStage` | Unconditionally reassigns live `srcObject` and calls play on repeated sync. | Only rebind on actual stream change; play on stream change or paused state. |
| `ui/mac-share-video.js` `setLayoutActive` | Resets render signature and forces `renderParticipants(true)` on every repeated `onState` message. | Stop forced remount on unchanged presenter state. |
| `src/mac-share-presenter-overlay.mjs`, `ui/mac-annotation-toolbar.css` | Native annotation palette hard-coded to 184px wide, 430–526px tall, two columns. | Replace vertical window geometry and CSS with a compact horizontal single-row arrangement; leave annotation input/drawing engine alone. |

## Architecture inventory / required sole authority

| Subsystem | Canonical source to retain | Conflicts to eliminate / audits still needed |
| --- | --- | --- |
| Profile image state and avatar painting | Auth state + `profile-photo-fallback.js` | Legacy `approved-reference-parity.js` painter, imperative initials resets in `app.js` |
| RTC media sender, receiver, transport stats | `webrtc-controller.js` | Per-peer track remount, missing frame delivery, signaling/ICE state; **not fixed by UI cleanup** |
| Native Mac screen capture | `share-controller.js` worker bridge | Sender `replaceTrack` timing, late track arrival and source teardown |
| Main meeting stage / speaking | `meeting-parity.js` | Sole-remote promotion ignores speaking priority; local/remote arbitration **unresolved** |
| Meeting filmstrip DOM & visibility | `meeting-parity.js` | `runtime-stability.js` geometry writers and retired reference scripts, repeated mutations |
| Native Mac share companion | `mac-share-video.js` | Its own `getUserMedia` camera session; remote video delivered via 192x108 JPEG snapshots at ~2.8 Hz, not a native persistent remote `MediaStream`. **Requires redesign**, not more CSS. |
| Participants window | `runtime-stability.js` presentation authority with `app.js` roster data | Legacy reference/geometry scripts, traffic-light collision, disabled remote icons; **unresolved** |
| Presenter chrome + native annotation | `mac-share-presenter-overlay.mjs` | Native palette should stay horizontal; drawing engine unchanged; test on Mac |
| Web guest joining/signaling | `browser-bridge.js` / shared WebRTC receiver | Prove browser can receive remote share video/remote camera over ICE+TURN; **unresolved** |

## Release gate before the next installer
1. **No source assertion can substitute for cross-device media testing.** Log `RTCPeerConnection.connectionState`, `iceConnectionState`, selected candidate pair, sender and receiver track IDs/states, `getStats()` frames/bytes, and receiver video `readyState`, `videoWidth`, `currentTime` on both machines.
2. Perform desktop presenter -> browser guest and desktop presenter -> desktop guest tests. Document whether failure occurs at capture, outgoing RTP, ICE/TURN, incoming RTP, receiver element binding, or CSS/compositor.
3. Fix native share companion's separate camera ownership and low-rate JPEG forwarding; keep DOM video elements stable when state changes. Camera toggles must never remount the whole filmstrip.
4. Stage must follow *actual* active local/remote speaker, except explicit spotlight/share priority. No automatic override based solely on presence.
5. Enforce 318x390 Participants geometry and 42px rows, accessible per-participant actions, traffic lights separated from title; enforce 176x99 fixed video tiles and internal scroll only when **more than five** are visible.
6. Preserve compact horizontal annotation layout and existing drawing engine, laser, screen-share capture border and functional presenter toolbar.
7. Confirm profile photo when available, initials otherwise, on both host and browser participant.
8. Hold a sustained session with two live cameras, repeated mute/video toggles, share start/stop, annotation, leaving and rejoining. No black screen, flicker, stale overlay, unresponsive controls or silent connection retries.

**No installer from this branch until physical acceptance is demonstrated.**

## Phase 3: signaling and relay diagnosis (2026-10-14)

- Browser `/meet/` is deployed from `meet-desktop/ui` through `scripts/build-public-netlify.sh`; `browser-bridge.js` supplies signaling and ICE methods and the same `webrtc-controller.js` is loaded dynamically by `media-controller.js`. This rules out a missing browser WebRTC source file as a general explanation.
- Signaling queries against the connected Supabase backend for the Oct 14 physical testing interval (14:23–14:30 UTC) show one room with 3 offers, 4 answers, 44 ICE candidate messages, and 1 bye. These messages demonstrate backend signaling traffic, **not** successful ICE connectivity or delivered frames.
- The TURN credentials Edge Function `meet-v2-turn-credentials` is active and has JWT verification enabled. Its code requires Bearer authentication and checks room access. `browser-bridge.js` previously fell back to STUN-only ICE without retaining any explanation when this request failed.
- Production support for anonymous external guests is **not verified**; both `meet_v2_send_signal` and `meet_v2_pull_signals` currently require authenticated member identity via `auth.uid()`. Do not claim guest media parity without revisiting authorization design and testing.
- `webrtc-controller.js` now serializes signaling and presence polling to avoid overlapping offer/ICE processing, advances the signal cursor only after each accepted message, and ignores stale results from earlier meeting generations.
- `browser-bridge.js` now records a sanitized relay failure category (authentication, provider, configuration, generic unavailable) when using direct ICE fallback. `webrtc-controller.js` surfaces direct-only state and records browser vs desktop surface, network details and signaling counters in `diagnosticSnapshot()`.
- The isolated regression script now covers 35 source invariants. Independent source inspection: 35/35 matched, and seven browser JavaScript files compiled for syntax. These are **static checks**, not live two-device execution or a packaged application.

Next investigation requires collecting the privacy-safe `DominionWebRTCController.diagnosticSnapshot()` output on both live clients, at rest and during screen share. Compare sender `framesEncoded` / `bytesSent`, receiver `framesDecoded` / `bytesReceived`, ICE state, and `remoteShareVideo.currentTime` to locate the actual failing boundary. Do not disclose join tokens or SDP.

## Phase 4: first-frame authority and executable media regressions (2026-10-14)

Changes are confined to `cleanup/meeting-ownership-audit-20261014`, **not production**.

1. Native ScreenCaptureKit worker `share-controller.js` previously set `macWorkerActive=true` after a successful picker/worker start even if its local receiving WebRTC stream contained no playable screen track. It now waits up to 5.5 seconds for a *live, unmuted* video track before claiming the user is sharing; otherwise it disposes the worker and reports capture-transport failure instead of falsely reporting share success. Intentional synthetic/lifecycle-only QA flags retain their existing behavior.
2. `webrtc-controller.js` resolves the current screen stream *after* asynchronous camera/effects processing to avoid selecting an outdated share track during a camera state transition.
3. Both remote video-only elements are explicitly `muted` for browser autoplay compatibility; remote microphone and shared computer sound continue through dedicated `audio` elements.
4. Remote share and camera elements now keep the fallback/stage until `readyState >= 2` and decoded `videoWidth`/`videoHeight` are nonzero. No remote-share active UI event is emitted before that display threshold, avoiding an empty black stage being presented as successful remote sharing.
5. `scripts/verify-live-media-attachment-20261014.mjs` executes mocked DOM lifecycle and asynchronous signaling scenarios instead of searching only for source strings. Tested first frame/reveal, cleanup, unchanged stream identity, single-flight polling, sorted signals, and processing-failure retry.
6. `npm run verify:cleanup` now invokes both the 41-invariant structural check and the functional regression file. Independent execution of the committed test logic in a JS harness: **41/41 source assertions, 23/23 functional mock assertions, and 8/8 browser JS syntax parses passed**. This is **not** a packaged Mac test or a live network test.

**Still blocked:** actual first-frame delivery across two Macs, ICE/TURN selection and RTP sender/receiver counters, authorized browser guest entry, native JPEG snapshot companion replacement with sustained video, participant-panel action access, and end-to-end stable conference operation. Do not package or distribute this branch before those tests succeed.

## Phase 5: duplicate negotiation, startup and RTP-lane attribution (2026-10-14)

- **Confirmed source defect:** `reconcileParticipants()` could repeatedly call `initiate()` while the first peer was still `new`, and `initiate()` originally set `makingOffer` only *after* awaited camera/track synchronization. Multiple asynchronous startup attempts could therefore send overlapping SDP offers. The offer guard now activates before async work; `negotiationStarted` and `offerPending` prevent a routine participant poll from renegotiating a still-connecting peer, while explicit ICE restarts remain available.
- **Confirmed source defect:** deliberate `RTCPeerConnection.close()` could fire its own connection-state handler and schedule another peer creation. `closePeer()` now removes all connection callbacks; `closed` is no longer treated as `failed`.
- **Confirmed source defect:** the 500ms `lifecycleProbe()` could enter multiple `start()` operations during pending context/ICE fetch, creating duplicate room listeners and timers. `state.starting` and a cancellable startup attempt gate now prevent overlapping starts and ignore stale results after leave/end.
- **Confirmed source defect:** regaining focus always invoked `recoverNetwork()`, which restarts ICE even when every peer was already healthy. Visibility-based recovery is now conditional on a genuinely unhealthy connection or system suspension.
- **Transport instrumentation:** `diagnosticSnapshot()` includes per-transceiver `RTCRtpSender.getStats()` / `RTCRtpReceiver.getStats()` counters for microphone, camera, screen, and system audio, excluding SDP, credentials, and candidate addresses. Sender/receiver bytes and decoded frames can now be compared for the **screen lane specifically**.
- **Tests committed:** `scripts/verify-peer-negotiation-20261014.mjs` covers overlapping offers, post-answer polling, explicit ICE restart, duplicate startup guard, and cancelled startup. The cleanup npm script chains 3 focused checks. Independent execution of the committed test source: **41/41 structural assertions, both mock suites passing, and 8/8 edited browser JS syntax checks passing**.

No physical recipient data, real frame transmission test, or video companion/participant UX acceptance has occurred. Continue to **block installers and merges**.

## Phase 6: native companion camera ownership and stable frame composition (2026-10-14)

**Confirmed defect:** `ui/mac-share-video.js` opened its own `navigator.mediaDevices.getUserMedia({audio:false,video})` capture, concurrently with the already-active camera `MediaStream` controlled by `ui/media-controller.js` in the meeting renderer. The separate BrowserWindow could independently restart/stop its camera even when the meeting camera was stable. Remote companion tiles also repeatedly changed JPEG `img.src` values.

**Source-only cleanup committed:**
- Remove native companion `getUserMedia`, restart timer and preview-stream ownership. Its self tile now uses the same authenticated camera stream already owned by the main meeting renderer.
- In `ui/share-integration.js`, a hidden muted *consumer* video reuses `DominionMediaController.stream()`, without reacquiring any video device. Its frames are forwarded over the pre-existing presenter IPC message path using the same lifecycle as remote companion frames; the consumer detaches on share stop.
- In `ui/mac-share-video.js`, each participant (including self) has a persistent 176×99 canvas. JPEG updates are decoded in a new offscreen `Image`, then drawn into the existing canvas without clearing the visible frame. A monotonically increasing `at` timestamp rejects out-of-order frames; an invalidation epoch prevents a late frame from reappearing after the camera turns off. Self mirroring is preserved.
- Added `scripts/verify-companion-single-camera-20261014.mjs` to cleanup verification. Its mock exercises first frame, out-of-order image loads, camera-off clearing, stale-image invalidation and shared camera authority. **All four** source/mock suites pass with **45/45 structural checks** and **9/9 browser JavaScript syntax parses**.

**Not a finished camera architecture:** the presenter IPC bridge still transports low-resolution (~192×108) JPEG snapshots at ~360ms intervals, not persistent RTP video. This is insufficient for accepted high-quality motion and remains a release blocker. The completed work strictly removes double capture and image-reset flashing; do not call it production-ready or distribute a Mac installer.

**Next architecture gate:** replace low-rate JPEG forwarding in the native companion with a stable live video track or equivalent continuous, timestamped media stream; measure frame latency/drop/CPU and ensure camera off, rejoin, stop-share and end-meeting release the stream cleanly. Confirm screen-share RTP is genuinely decoded by the second client and that panel/participant controls match the approved interface.

## Phase 7: Native companion continuous local video transport (2026-10-14)

**Isolated source-only work; not distributed or merged.** This phase replaces the native macOS floating-video companion's ~192×108 JPEG-at-360ms IPC frame-forwarding implementation.

- `ui/mac-companion-rtc.js` is a dedicated WebRTC sender/receiver for first-party main meeting renderer and native floating video renderer, **not** an additional connection to remote meeting participants. One local video sender/receiver pair is created per visible camera track. It uses `RTCPeerConnection({iceServers:[]})`, stable track identity, serialized sender reconciliation, SDP offer/answer plus ordered ICE signaling, an early-candidate queue, and explicit reset/close behavior. No extra `getUserMedia` call is made.
- `src/preload.cjs` and `src/presenter-preload.cjs` expose narrow `videoSignal` / `onVideoSignal` interfaces. `src/mac-share-presenter-overlay.mjs` forwards only accepted SDP/ICE/close/hello/reset messages between the verified **main BrowserWindow** and the **native video BrowserWindow**. Other windows and malformed payloads are rejected. The former `mac-share:video-frame` JPEG forwarding path has been removed.
- `ui/share-integration.js` now uses the existing microphone/camera owner for self video and `DominionWebRTCController.companionTracks()` for remote video, with a DOM video fallback if needed. Source tracks are synchronized to the local sender on camera/participant changes. A slow 800ms state check may publish metadata and reconcile tracks, **not encode/send frames**. Native presenter mode and original main WebRTC signaling remain independent.
- `ui/mac-share-video.js` and `ui/mac-share-video.html` now attach native `MediaStream` tracks to **persistent, autoplay-safe, muted video elements** with first-decoded-frame visibility gating and avatar fallback. Video elements remain attached as tiles are reordered. Existing approved geometry and only-after-five internal scrolling remain unchanged. Tear-down releases the companion receiver and source references.
- `scripts/verify-companion-single-camera-20261014.mjs` now tests the local WebRTC offer, answer, early ICE, stream receipt, unchanged-track stability, clear/restart and full peer teardown across **two isolated simulated renderer contexts**. The stale JPEG-specific test contract was retired.
- The four `npm run verify:cleanup` suites passed in JavaScript execution, including **51/51 structural invariants** and syntax inspection of **10/10 modified browser JS modules**. This verifies source contracts and simulated signaling only; no macOS runtime, package, physical camera decode, network bridge or participant acceptance has been demonstrated.

**Remaining physical acceptance gate:** Build only for controlled QA when authorized, then verify main Mac renderer -> floating Mac video window and desktop -> second Mac/browser: camera sender/receiver decoded-frame progress, RTP bytes/frames, stable frame rate over time, camera off/on and rejoin, speaking stage, share-stage delivery, control availability, and capture teardown. Do not release before independent real-device acceptance.
