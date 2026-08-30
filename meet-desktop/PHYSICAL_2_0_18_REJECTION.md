# DominionStar Meet 2.0.18 — Physical Mac Rejection

Status: REJECTED on 2026-08-30 physical-Mac acceptance.

## Confirmed physical failures

1. Screen Share did not recognize usable Screen & System Audio Recording access on the installed Mac. macOS displayed its native Screen Recording prompt while DominionStar Meet simultaneously displayed its own recovery dialog. System Settings showed DominionStar Meet enabled, but the running build still had no usable capture source.
2. New Meeting displayed `Use Personal Meeting ID` as selected, but the meeting started with an 11-digit instant Meeting ID instead of the displayed persistent 10-digit Personal Meeting ID.
3. Reactions tray geometry is not production quality: Raise Hand wraps/overflows and the tray obstructs too much of the stage.
4. Video Settings remains below the approved readability/layout standard: controls are weakly aligned, secondary text is too small/faint, sliders are over-wide, and whitespace/scroll treatment is not Zoom-grade.

## What passed physically

- Participants now shows participant identity, Host role, microphone/video status, and per-row ellipsis.
- Host Tools opens above the toolbar and is clickable.
- More opens above the toolbar and is clickable.
- Meeting toolbar icon sizing is materially improved.

## Release consequence

2.0.18 must not be represented as physically accepted. A later candidate must convert each failure above into an automated regression gate and must clearly distinguish CI-simulated screen-source checks from real macOS TCC persistence.
