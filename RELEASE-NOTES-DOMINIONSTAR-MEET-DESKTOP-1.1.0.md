# DominionStar Meet Desktop 1.1.0

Release-quality adaptive window and update foundation based on the audited v1.0.9 camera-privacy/native-share build.

## Added

- Wide, narrow, compact, and mini desktop window modes.
- Automatic participant-dock movement from the right side to the top when space becomes constrained.
- One-to-five visible participant tiles according to available window space; additional tiles scroll inside the dock.
- Native macOS traffic-light presentation and Windows caption-button presentation.
- Safe persistence and restoration of window bounds and maximized state.
- Mini-window always-on-top behavior with essential meeting controls only.
- Background update download, update-ready notification, install-on-exit, manual check, and install-now bridges.
- GitHub tagged-release packaging for update metadata, blockmaps, and platform installers.

## Preserved from 1.0.9

- Camera hardware privacy and immediate capture release when video is disabled.
- macOS native screen picker on supported systems.
- Audited custom share picker fallback.
- Presenter privacy window and camera-independent screen sharing.
- Persistent DominionStar account session, deep links, remote control consent, and crash recovery.

## Verification completed

- Desktop security and release contract.
- Twenty-five repeated capture-session cycles.
- Capture-source recovery.
- Adaptive-layout thresholds and native platform styles.
- JavaScript syntax checks for the meeting UI, dock, native main process, and updater.

Native installer packaging still requires the platform build runners and signing/notarization credentials. A tagged workflow release remains a draft until those checks are complete.
