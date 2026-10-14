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
