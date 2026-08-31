# DominionStar Meet 2.0.20 — Physical Mac Rejection

Status: **REJECTED**

2.0.20 passed hosted production certification twice, but the physical Mac acceptance run on 2026-08-30 exposed behavior the automated suite did not model. Physical evidence outranks hosted CI for release acceptance.

## Blocking defects

1. **Screen sharing does not start on the physical Mac.**
   - macOS Screen & System Audio Recording shows DominionStar Meet enabled.
   - The running app still enters a denied / reauthorization loop.
   - Root regression: the 2.0.20 physical-repair layer pre-enumerates `desktopCapturer.getSources()` and blocks the user gesture before native `getDisplayMedia()` can own permission/selection.
   - The main-process display-media handler also had `useSystemPicker:false`, despite an older repository guardrail explicitly requiring the native macOS system picker on supported systems.

2. **Prejoin is not Zoom-class adaptive UI.**
   - Window is materially oversized compared with the current Zoom macOS prejoin.
   - Meeting credentials consume too much top space.
   - Speaker selector clips horizontally.
   - Preview should be the dominant surface, with controls and device selection kept compact.

3. **Participants panel is not intelligent by participant count.**
   - A one-person meeting shows a full-height panel, search, and an empty Waiting Room section.
   - Current Zoom physical reference shows a compact `Participants (1)` floating window without unnecessary search or empty sections.
   - Ordering must follow Zoom-style meeting priority: local user, host, co-hosts, raised hands, unmuted participants, then muted participants, with name ordering inside a bucket.

4. **Chat is not sufficiently adaptive.**
   - Current DominionStar chat is a fixed right-side panel with a large blank body and oversized Send button.
   - It must dock when sufficient width exists and float/overlay when the meeting window is too narrow, preserving the stage rather than crushing it.
   - Recipient/direct-message policy must remain functional while the chrome adapts.

## 2.0.21 acceptance requirements

- Native macOS system content-sharing picker is enabled on supported macOS and receives the original user gesture.
- No `getMediaAccessStatus` or `desktopCapturer.getSources` preflight may block the native picker path.
- Permission recovery appears only after a real native capture request fails.
- One-participant panel is compact, floating, and omits unnecessary search / empty waiting-room chrome.
- Multi-participant panel exposes search when useful and applies role / hand / audio-state sorting.
- Chat changes between docked and floating geometry based on available meeting width.
- Prejoin has bounded Zoom-scale geometry with no clipped device controls.
- New packaged regression tests must cover these physical defects before a DMG can be produced.

No 2.0.20 installer is accepted for release.