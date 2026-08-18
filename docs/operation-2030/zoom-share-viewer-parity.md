# Operation 2030 — Zoom Share Viewer Parity

Reference behavior captured from a live Zoom desktop meeting on 2026-08-18 and cross-checked against current Zoom support documentation.

## Participant video dock

- Participant identity remains bottom-left and is always readable.
- Mute/Unmute and participant More controls occupy a separate top-right hover/focus layer.
- Hover controls are absent at rest and must not overlap the participant name.
- Dock remains movable, minimizable, stack/grid capable, and overlays shared content without consuming a page column.

## Remote participant is sharing

- Viewer sees a compact top sharing status surface naming the presenter.
- Viewer receives share-specific More/options; presenter controls are not shown.
- Host/co-host may stop the participant's share without removing the participant.
- Remote control remains conditional on the existing remote-control capability contract.
- Participant video panel remains independently hideable/movable from shared content.

## Local user is sharing

- Viewer-specific share More control is hidden.
- Presenter receives the private floating presenter controls.
- Bottom meeting toolbar behavior remains governed by the existing presentation-mode contract.
- Pause Share continues to freeze the last transmitted frame rather than showing black.

## Non-goals

- No WebRTC sender/receiver/transceiver changes.
- No camera lifecycle changes.
- No waiting-room changes.
- No role-authority changes.
- No release/version/desktopBridge bump.
