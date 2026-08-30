# DominionStar Meet 2.0.19 Physical Mac Repair Plan

Candidate 2.0.19 must not be released unless all items below are implemented and audited.

## Screen Share / macOS TCC
- Never stack DominionStar's recovery dialog on top of the native macOS Screen Recording prompt.
- Treat `not-determined` as a native-prompt state; wait for the user/macOS decision before showing recovery UI.
- Add an explicit app relaunch action for a newly granted Screen Recording permission.
- Detect and report ad-hoc signing as TCC-unstable. CI may test source enumeration, but must not label an ad-hoc build as persistence-certified.
- Add a packaged regression test for single-modal permission UX and relaunch recovery.

## Personal Meeting ID
- New Meeting must route through the Personal Room path directly when `Use Personal Meeting ID` is selected.
- The Meeting ID displayed before Start must exactly equal the Meeting ID in the live meeting header.
- Add a packaged equality assertion; presence of a checkbox alone is insufficient.

## Reactions
- Keep the verified 10-second reaction lifetime.
- Raise Hand must stay on one line inside the tray and the tray must remain fully above the meeting toolbar.
- Add rendered geometry assertions for tray bounds and no wrapping/overflow.

## Settings
- Increase secondary text readability and align labels/controls as professional rows.
- Constrain slider width and remove excessive vertical whitespace.
- Add packaged rendered typography/alignment checks.
