# DominionStar Meet UI Authority Contract

This file defines the desktop ownership model for meeting UI and media. It is a release contract, not a design suggestion.

## Core rule

A visible stateful surface has exactly one canonical owner. Compatibility and historical parity modules may expose helpers, but on the installed desktop app they must not run autonomous DOM reconciliation timers or broad mutation loops against a surface owned elsewhere.

The executable enforcement lives in:

- `scripts/verify-ui-authority-contract-2.0.53.mjs`
- `scripts/verify-project-architecture-2.0.53.mjs`

Both are mandatory production gates.

## Authority map

| Surface / state | Canonical owner | Allowed helpers | Forbidden competing behavior |
| --- | --- | --- | --- |
| Participants panel visibility, geometry, drag, row ordering | `ui/runtime-stability.js` | `ui/zoom-participants-reference-2.0.41.js` for deliberate structural/reference sync | Background panel geometry/search reconciliation from adaptive/polish/acceptance layers |
| Participants search, reference header/footer structure | `ui/zoom-participants-reference-2.0.41.js` | Invoked by runtime | Count-based search hiding; duplicate search creation; legacy `.zoom-participant-search` class on canonical input |
| Participant membership / keyed rows | `ui/app.js` | Runtime ordering; participant-controls actions | Rebuilding the whole roster or independent sorting from snapshot renderers |
| Participant actions / mic-video action state | `ui/participant-controls.js` | Runtime command router | Legacy desktop bulk-action strip; autonomous six-second UI reconciliation |
| Main meeting toolbar command routing | `ui/runtime-stability.js` | Meeting features/tools implementations | Competing capture-phase toolbar routers |
| Camera / microphone hardware stream | `ui/media-controller.js` | Video-effects may process an existing track | Any presenter/share surface opening a second camera |
| WebRTC transport | `ui/webrtc-controller.js` | Media/share controllers provide tracks | UI parity modules polling/recreating transport |
| Screen-share state/output | `ui/share-controller.js` | `ui/share-integration.js` bridges UI and native presenter | Visual-only pause/video acknowledgement |
| Pres-share chooser | `ui/share-runtime-authority-2.0.41.js` | Main-process source service | Parallel system/custom picker authorities |
| Native macOS presenter windows and geometry | `src/mac-share-presenter-overlay.mjs` | `src/share-service.mjs` lifecycle/service bridge | Legacy second presenter window on macOS |
| Native presenter toolbar markup/actions | `ui/mac-presenter-toolbar.html/js/css` | Native bridge + renderer dispatcher | Extra top-level controls outside approved toolbar |
| Native participant filmstrip during sharing | `ui/mac-share-video.js/css` | Frames mirrored by `ui/share-integration.js` | Direct camera acquisition; synthetic duplicate self; one-person filmstrip |
| Reactions | `ui/meeting-features.js` + runtime positioning | Reference layer may decorate | Second reaction chooser/handler |
| Chat visibility/geometry | `ui/runtime-stability.js` | Meeting features own messages and composer | Adaptive/polish background geometry writers |
| Preferences | `ui/preferences.js` | Explicit lifecycle and preference events | Body-wide mutation observer or 700ms visual polling |
| Diagnostics | `ui/physical-diagnostics.js` | Explicit start/stop only | Production visual ownership |

## Approved screen-sharing contract

The native presenter toolbar top-level order is:

**Mute · Stop Video · Pause Share · Participants · Chat · More · Stop Share**

Stop Share is the red control in the same compact toolbar. Annotation, layout choices, recording, and similar tools belong under **More** unless a later approved reference explicitly changes the contract.

Participant filmstrip behavior while sharing:

- 1 participant: no filmstrip.
- 2–5 participants: right-side filmstrip.
- 6+ participants: same width; maximum five visible; internal scrolling.

Profile photo and initials are mutually exclusive fallbacks for a participant.

## State acknowledgement rule

A presenter command succeeds only after the authoritative controller reaches the requested state.

- Camera On requires `cameraOn === true` and a live video track.
- Camera Off requires `cameraOn === false`.
- Pause Share requires `paused === true`.
- Resume Share requires `paused === false`.

A button label/icon change is not execution proof.

## Polling and observers

Periodic work is permitted for transport and signal processing, such as WebRTC signaling, presence, voice-level analysis, and explicitly started diagnostics.

Periodic DOM/UI reconciliation is not permitted for installed-desktop compatibility layers. Use explicit lifecycle events, state subscriptions, or a deliberate canonical `sync()` call.

## Release discipline

Do not publish an installer if any ownership, architecture, source, packaged runtime, physical interaction, adaptive behavior, or approved-reference gate fails. A failing old verifier must be reconciled with the intended architecture; product code must not be regressed merely to satisfy an obsolete assertion.

Physical-Mac evidence remains authoritative for motion/flicker, permission persistence, compositor behavior, and presenter controls that static screenshots cannot prove.
