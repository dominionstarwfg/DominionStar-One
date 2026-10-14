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
