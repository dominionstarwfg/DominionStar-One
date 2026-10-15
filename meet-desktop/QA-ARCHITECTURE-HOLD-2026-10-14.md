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

## Phase 8: screenshot-based identity and responsive panel parity (2026-10-14)

Approved screenshots require two separate identity contracts: roster badge = **profile picture or initials**, plus readable full name and Host/Co-host indicator; video panel tile = **decoded live video**, otherwise profile picture, otherwise the **participant's full display name**, never a circular initials tile.

Source changes:
- `ui/mac-share-video.js` / `ui/mac-share-video.css` now use name-only no-photo video fallback; `ui/webrtc-controller.js`, canonical `ui/profile-photo-fallback.js`, and legacy `ui/approved-reference-parity.js` follow the same filmstrip contract. The roster stays photo/initials. The active-speaker stage does not show an oversized initial glyph when it has no photo.
- `ui/runtime-stability.js` and CSS remove the forcibly narrow 318px floating Participants window in favor of a readable 440px desktop target and 552px height limit, clamped to viewport. This is a presentation baseline, not a promise that a real Mac screenshot has been validated.
- `scripts/verify-identity-surfaces-20261014.mjs` exercises **19/19 source invariants** and is part of `npm run verify:cleanup`.

Further runtime audit found that MeetingParity and RuntimeStability independently wrote dock geometry. RuntimeStability always forced a **right-side vertical** 188px strip, even on constrained displays. This contradicted the approved adaptive layout and could overwrite another controller's change.
- RuntimeStability is the sole final owner of **automatic** strip placement: wide/tall stage -> right vertical strip, constrained stage -> top horizontal strip. The decision uses hysteresis (enter top if width <900px or height <520px; exit after width ≥1020px and height ≥620px) and therefore avoids breakpoint oscillation.
- On right: max five visible 176×99 tiles, scroll vertically inside the filmstrip for overflow. On top: fit as many up to five 176×99 tiles as the available stage permits; scroll horizontally for overflow. The explicit split-screen sharing mode and manually repositioned dock preserve their own placement.
- `ui/meeting-parity.js` no longer forces automatic right-side positioning once RuntimeStability owns the dock.
- `scripts/verify-responsive-video-dock-20261014.mjs` executes a mocked geometry simulation for wide/tall, narrow/top, scrollbar direction, hysteresis, manual repositioning and split-screen exceptions. It passed and is included in `npm run verify:cleanup`.

**Release remains blocked.** These are source and mocked geometry/media tests, not evidence of real macOS viewport behavior, video/screen-share reception, accurate toolbar and roster controls, or host/co-host/guest parity on physical devices. Do not package an installer or merge into `main` on this evidence alone.

## Phase 9: Participant roster ownership and executable controls (2026-10-14)

Approved reference requires a stable Participants window with readable Host/Co-host roles, live count, profile/photo-or-initials badges, correct and distinct audio/video signs, clickable profile and private chat on both host and participant clients, and properly placed moderation controls.

**Source defects confirmed and repaired on this isolated branch:**
1. **Competing sorters:** `app.js` already owned roster sorting and speaker rank. `runtime-stability.js` and `zoom-participants-reference-2.0.41.js` also independently reordered the same DOM rows with different priorities; all could execute during a refresh. These secondary reorder operations were disabled (their styling logic remains). `app.js` now performs the same host/cohost/speaker-aware order on its first snapshot pass, rather than alphabetizing then immediately re-sorting. This removes confirmed DOM reorder churn without altering the visual benchmark.
2. **Displaced More button:** `row.querySelector('.participant-actions')?.append(button)||row.append(button)` invoked both appends because `Element.append()` returns `undefined`; the action button was moved out of its intended column each time it was constructed. The action owner is now resolved first and appended **once**.
3. **Guest profiles suppressed:** `participant-controls.js` exited early for ordinary participants or protected-host rows, preventing row-profile keyboard/click binding. All attendees now receive clickable roster identity cards and scoped `Chat privately` menu access. Moderation entries still require host/cohost capability; non-managers never see `Mute`, `Stop Video`, `Remove`, etc.
4. **Incorrect independent media state:** a `dominion:remote-media-state` event supplying only camera state used to coerce absent microphone state to `false` (and vice versa), mislabeling media as off. Known values are now updated individually; omitted values remain unchanged or unknown.
5. **Duplicate mute slash:** `participant-controls.css` added an extra pseudo-element line on muted `ds-media-state` icons, competing with the reference SVG's built-in slash. The extra pseudo-line is disabled so there is one intentional muted slash.
6. **Action failure handling:** participant menu commands catch and report rejected/error outcomes rather than leaving unhandled promises or reporting an unsuccessful signal as success.

**Tests:** `verify-participant-control-ownership-20261014.mjs` exercises guest and host profile/menu binding, idempotent More button mounting, non-manager chat-only menu, partial audio/video update preservation, and single-sort/single-slash checks. It is now chained in `npm run verify:cleanup`. Independently re-ran all **7/7** source/mock suites on the latest isolated branch: **51/51 architecture invariants**, **19/19 identity/spacing invariants**, plus media, negotiation, continuous companion RTC, adaptive dock geometry, and new participant-controls functional mocks. No actual Mac GUI or two-device media result is claimed.

**Release state unchanged:** Do not distribute an installer or merge into main. Still require physical confirmation of stable seven-person roster and live video dock, working moderation permissions, actual camera/screen-share decoded frames on the second device, no blinking/freezes, and clean shutdown.

## Phase 10: read-only real-device decoded-frame progress probe (2026-10-14)

**Confirmed media-state defect:** `webrtc-controller.js` previously initialized `state.remoteMedia` with `{micOn:false,cameraOn:false}` on receipt of either individual track update. Consequently a camera-first participant could be rendered falsely muted before any microphone state was known. The controller now preserves missing status as `unknown`; subsequent independent mic/camera events update only the known field. The participant controls layer already preserves partial remote updates.

**Physical QA instrumentation (not a physical test):** `DominionWebRTCController.diagnosticWindow(durationMs=4000)` obtains a baseline diagnostic snapshot, waits an explicitly requested 1–10 second window, obtains another, and computes RTP sender/receiver **screen**, **camera**, microphone and system-audio deltas per anonymous peer sequence. It also reports whether remote screen video is visible, has nonzero dimensions, and progresses in playback time. The output omits participant IDs, room IDs, SDP, candidates, and relay secrets. It is **read-only** and does not start screen sharing or acquire capture devices. Absent stats remain `null`, never presumed zero or evidence of decoded frames. A connected peer or playing clock alone is not a release pass.

**Regression:** `scripts/verify-two-device-media-progress-20261014.mjs` checks partial mic/camera event ordering, positive screen send/decoded progress, absent or stalled progress, and anonymity of the summary. It passed in a JavaScript simulation and is the **8th** suite in `npm run verify:cleanup`.

**Human physical gate:** `QA-TWO-DEVICE-LIVE-MEDIA-GATE-2026-10-14.md` documents the two-computer session, the read-only console probe, comparison of sender outbound versus receiver decoded frames, real moving content observation, full seven-person reference parity, shutdown/rejoin, and precise FAIL vs UNVERIFIED rules.

**Verification:** On the isolated cleanup branch, **all 8/8** focused JavaScript test suites passed in separate harness runs, including **51/51 architecture invariants**, **19/19 identity/spacing invariants**, peer/media/companion mocks, responsive dock, participant controls, and the new probe. The nine browser scripts inspected in the final focused syntax batch parsed without errors. No physical device, installation, CI pipeline, actual camera frame, or guest share playback was exercised.

**Release remains BLOCKED.** Do not create or distribute an installer, merge to `main`, or call any build approved until the physical QA matrix passes on the sender and receiving Mac/browser.

## Phase 11: rendered frames and conservative host/guest evidence comparison (2026-10-14)

- Video playback time can advance without continuously rendering a visible moving picture. `webrtc-controller.js` now includes a **displayed-frame counter**, when the runtime supports `HTMLVideoElement.getVideoPlaybackQuality().totalVideoFrames` or `webkitDecodedFrameCount`. The read-only `diagnosticWindow()` reports `remoteSharePlayback.renderedFramesAdvanced` separately from RTP `framesDecoded` and `secondsAdvanced`. The result is nullable when the API is unsupported, never presumed positive.
- New offline Node tool `scripts/audit-two-device-media-evidence-20261014.mjs` compares **two separately collected, anonymized diagnosticWindow reports** from a one-host/one-guest session. It triages transport, absent outbound screen frames, absent incoming decoded screen frames, invisible stage, playback clock stall and rendered-frame stall. Missing metrics result in `UNVERIFIED`. Technically healthy counters produce `TECHNICAL_PROGRESS_ONLY` and an explicit `releaseApproved:false`, never physical acceptance.
- The CLI deliberately exits **nonzero on every state**: 1 = FAIL, 2 = UNVERIFIED, 3 = TECHNICAL_PROGRESS_ONLY. A CI pipeline must not interpret any comparator outcome as final release approval.
- `verify-two-device-media-progress-20261014.mjs` now tests positive and frozen displayed-frame deltas. New `verify-two-device-comparison-20261014.mjs` exercises 12 outcome cases, including no sender frames, no guest decoding, wrong/hidden stage, stalled clock, no rendered frames, transport failure and missing data, plus `releaseApproved:false` invariants. This is the **ninth** suite in `npm run verify:cleanup`.
- Re-ran the nine focused source and JavaScript behavioral suites in isolated test harnesses after changes: **9/9 passed**, including **51/51 architecture source invariants** and **19/19 identity/spacing invariants**. The two-report comparator test executed **41 assertions**. These are mocks and source tests only; the real Electron/macOS app, native video window and remote receiver were not used.

**Still BLOCKED:** Real host-to-guest decoded and displayed shared-screen frames, video smoothness and proper captured content, seven-participant visual/UI behavior on both devices, camera lifecycle and no freezes. No installer, merge to main, or production release. Physical QA requires direct observation and reports from the actual two computers.

## Phase 12: bounded media refresh and transient ICE recovery (2026-10-14)

**Confirmed source risk 1 — event fan-out:** `syncLocalTracks(record)` previously chained every incoming camera/effects/share event onto `record.senderSync`. Each event re-ran asynchronous effects processing and then sender `replaceTrack` logic, even when earlier requests had not finished. A rapid camera toggle or multi-peer share transition could queue many redundant passes and delayed state transitions. Now each peer executes **one active synchronization plus a coalesced dirty rerun** that reads fresh authoritative tracks. The meeting-wide `syncAllSenders()` similarly coalesces events and refreshes the room's peers concurrently rather than spinning up multiple serial peer loops. Sender identity checks preserve unchanged tracks and cancelled/stopped rooms cannot reattach old captures.

**Confirmed source risk 2 — premature peer teardown:** the 1.8-second generic reconnect delay also applied to brief `RTCPeerConnection.connectionState==='disconnected'` transitions. That could destroy the peer and remove camera/share UI just as ICE was recovering, causing black flashes or transient tile remounts. Temporary disconnection now uses a 6-second grace period; transitioning to `connecting` or `connected` cancels the timer. The timer rechecks peer identity and connection state, so old timers cannot destroy replacement peers; offline disconnected peers defer replacement while offline. Confirmed `failed` connections still use prompt recovery.

**Regression additions:**
- `verify-sender-coalescing-20261014.mjs`: simulated 40 media events across five peers, verifying at most two sender synchronization passes per peer, convergence on the latest camera and screen stream, no replacement of unchanged tracks, share-stop track removal and no reattachment after leaving.
- `verify-reconnect-grace-20261014.mjs`: simulated disconnected-to-connecting, disconnected-to-connected, confirmed failed, offline, and stale-peer timer cases.
- Both are included in `npm run verify:cleanup`, now 11 focused suites. Architecture source gate was updated to assert the new single-flight/dirtiness contracts rather than checking the retired promise chain (**52/52 current source assertions**).
- Re-ran the 11 source/mock suites in the accessible JavaScript test harnesses: **11/11 passed**, plus **19/19** identity/spacing checks and 9/9 syntax parses in the final interface batch. These results do **not** mean Node/npm tests, real Electron execution, or a physical Mac frame test ran.

**Release decision unchanged: BLOCKED.** No installer, merge, or production release. Real two-device camera/screen share, sustained media rendering, approved seven-person roster and responsive video panel still require physical observation.

## Phase 13: reliable incoming offers and outbound ICE delivery (2026-10-14)

**Confirmed incoming signaling loss:** `handleSignal()` previously executed `try{record=ensurePeer(remoteId)}catch{return;}` for incoming SDP offers and ICE messages. When a peer could not be constructed temporarily (for example, unusable ICE configuration), it silently returned to `pullSignals()`. That polling loop treated the event as processed and advanced `state.lastSignalId`; the remote offer/candidate was never reapplied after recovery. The handler now allows supported WebRTC message peer-construction errors to propagate. The poll retains its last accepted cursor, increments a sanitized error counter, and retries the same message on a later pass. The current room's generation is rechecked immediately **after** each awaited handler before advancing a signal cursor; a late old-room result cannot contaminate a new room. The backend `meet_v2_pull_signals` implementation was inspected read-only: its `lastId` is the maximum ID of the selected, addressed signal rows, so the normal successful-batch cursor behavior is intentionally preserved.

**Confirmed outbound ICE loss:** `pc.onicecandidate` previously sent a signal and silently discarded a rejected/failed RPC promise, permanently losing a candidate that may be required by a receiving guest behind NAT. ICE candidates now enter a per-peer, bounded (128 maximum) ordered delivery queue. Failed sends are retried on a timer; retries preserve the unsent head candidate and later candidates remain ordered. In-flight successes or retries are ignored when the room ends or the peer has been replaced; closePeer clears timers and pending candidates. Sanitized `diagnosticSnapshot()` peer data includes `iceDelivery.pending` and `iceDelivery.sendFailures`, no candidate contents, IP addresses, SDP or credentials.

**Regressions added to `npm run verify:cleanup`:**
- `verify-signal-redelivery-20261014.mjs` validates initial ICE peer-construction failure leaves the cursor unchanged, subsequent offer and ICE retry/answer succeed, ordered replay and generation invalidation prevent old-room cursor movement.
- `verify-outbound-ice-delivery-20261014.mjs` validates transient RPC failure and retry, candidate order, room-exit rejection, stale peer suppression and bounded queue behavior.
- Architecture gates updated from 52 to **56** source invariants, including the new retry and cleanup requirements.

All **13/13** focused source and simulated JavaScript regression suites passed in harness execution on the isolated branch, including **56/56 architecture assertions**, **19/19 identity and spacing assertions**, media, negotiation, companion, geometry, participant controls and offline evidence comparison; final focused interface syntax batch parsed **9/9** JS modules. These results are NOT a physical two-computer test or a native macOS release build.

**Release still blocked.** Real host-to-guest screen-share decoding, moving shared content, camera/audio stability, seven-person Participants layout, video strip and correct co-host controls must be proven on both computers before considering a controlled QA installer. No production installer, merge or release performed.
