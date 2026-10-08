# DominionStar Meet Project Audit — 2.0.53 Architecture Hardening

## Purpose

This audit was triggered by physical-Mac evidence showing that a packaged build could pass static/short-duration tests while still switching between competing UI states. The most visible case was the Participants panel alternating between a search-visible and search-hidden structure. The same audit also covers presenter controls that visually changed without proving the requested media/share state.

This report is paired with the executable rules in:

- `UI_AUTHORITY_CONTRACT.md`
- `scripts/verify-ui-authority-contract-2.0.53.mjs`
- `scripts/verify-project-architecture-2.0.53.mjs`

## Root causes found

### 1. Layer accumulation

Historical repair, parity, polish, adaptive, and screenshot-reference modules remained loaded together. Several had their own MutationObservers, timers, CSS with `!important`, or event listeners. A later layer could fix the visible state while an older layer remained capable of changing it again.

### 2. Search had more than one authority

The canonical Participants search previously inherited the legacy `.zoom-participant-search` class. Adaptive CSS still contained a one-participant rule that hid that legacy class. The canonical layer then restored it, producing a visible search/row jump.

### 3. Tests encoded obsolete implementation details

Several verification scripts required old module versions or old ownership behavior. Correct product changes could therefore fail certification and tempt a regression back to the old architecture.

### 4. Presenter transport allowed false success

A transport acknowledgement could be treated as success even when `ok:false`. Direct execution timeout could also fall back/retry a non-idempotent command, risking duplicate Record/Reaction/hand actions.

### 5. Test-only capture could acquire the real camera

The synthetic screen-share QA path used `getUserMedia({video:true})`, violating camera single ownership and potentially interfering with the meeting camera.

### 6. Visual reconciliation polling was overused

Preferences, captions, participant controls, adaptive parity, production polish, approved-reference compatibility, active-share compatibility, and legacy meeting chrome contained recurring or broad DOM reconciliation mechanisms. These increased CPU/mutation pressure and created race opportunities.

## Corrections made

### Participants

- Canonical search no longer carries the legacy `.zoom-participant-search` class.
- One-person adaptive CSS search hiding was removed and release-gated.
- Search is seeded in the base meeting DOM before the panel can become visible.
- Reference code binds the existing search exactly once instead of recreating it.
- Desktop adaptive/polish/reference compatibility layers no longer run autonomous participant reconciliation.
- Participant Controls no longer runs a six-second desktop visual reconciliation timer.
- Canonical Participants selectors are protected from unrelated modules.
- Packaged stability test holds the one-person panel across the former six-second boundary and verifies:
  - search remains visible,
  - same search node remains,
  - same participant row remains,
  - same participant identity remains,
  - row top does not move,
  - canonical reference class remains,
  - competing adaptive role decoration does not re-enter.

### Screen-share participant filmstrip

- 1 participant: filmstrip hidden.
- 2–5 participants: right-side filmstrip.
- 6+: same width with bounded visible tiles / scrolling behavior.
- Synthetic `local-self` is removed when a real participant identity exists.
- Presenter video never opens a second camera.
- Local presenter camera frames come from the already-owned media track.
- Frame pumping stops entirely when fewer than two participants make the filmstrip ineligible.
- Frame cadence is bounded.

### Presenter toolbar and commands

Approved top-level surface is locked to:

**Mute · Stop Video · Pause Share · Participants · Chat · More · Stop Share**

- Extra historical primary controls are prohibited by release gate.
- Every declared presenter command must have a renderer/native execution path.
- Camera On succeeds only when camera state is on and a live video track exists.
- Pause/Resume succeeds only when the requested paused state is reached.
- Negative acknowledgements are rejected.
- Non-idempotent commands are not automatically retried after uncertain timeout.
- Presenter compatibility installation uses bounded retries rather than permanent high-frequency polling.
- Fallback IPC polling is reduced and explicit.

### Lifecycle / reopen / quit

Meeting end now deterministically releases:

- WebRTC transport,
- camera/microphone media,
- active share,
- native presenter windows,
- caption state.

Native share teardown restores normal main-window mouse interaction and capture state.

### Screenshot behavior

On macOS, content protection is not used to hide the meeting/presenter UI from ordinary screenshots. Presenter windows explicitly allow system capture. This preserves capture of presenter controls/details while screen sharing.

### Preferences and captions

- Preferences no longer uses a body-wide MutationObserver plus 700 ms polling.
- Prejoin defaults are driven by explicit prejoin lifecycle events.
- Captions no longer uses permanent 1.5-second UI polling.
- Caption history expiry is scheduled only when caption history exists.
- Caption state resets immediately on meeting end.

### Legacy meeting chrome

The older meeting-feature compatibility observer retires permanently once the final screenshot/reference authority is available. It no longer remains attached to the full meeting subtree after handoff.

### QA capture isolation

Synthetic screen-share QA now uses a generated canvas stream instead of the physical camera.

## Release prevention gates

Production packaging now requires:

1. UI authority contract verification.
2. Repository-wide architecture scan.
3. Existing foundation/auth/lifecycle/media/share/WebRTC/relay checks.
4. Runtime stability checks.
5. Packaged interaction checks.
6. Long enough one-person participant stability sampling to cross historical timer boundaries.
7. Visual scale/reference checks.
8. Physical acceptance checks.
9. Reaction duration and load checks.
10. Physical-Mac checks.
11. Adaptive behavior checks.
12. Approved-reference checks.
13. Installer identity/layout validation.
14. Artifact upload only after all prior gates pass.

## Architecture rule going forward

A visible stateful surface gets one owner.

Compatibility modules may expose helpers for deliberate calls. They may not independently poll/reconcile a desktop surface owned by another controller.

Functional timers are permitted for real-time transport/signal work (for example WebRTC, presence, voice-level sampling, explicitly started diagnostics). Periodic DOM/UI reconciliation in compatibility layers is prohibited.

## Physical-Mac policy

Automated gates are necessary but not sufficient for motion/compositor defects. Flicker, macOS permission identity, presenter-window behavior, and native compositor behavior still require a final physical-Mac acceptance pass before release is called physically verified.

## Known platform limitation

The prototype remains ad-hoc signed until an Apple Developer identity is introduced. Screen Recording permission persistence therefore is not certified to the same standard as a Developer ID signed/notarized production build.
