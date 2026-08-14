# DominionStar Meet Desktop v1.1.1

Privacy and compatibility hotfix for the v1.1.0 desktop release.

## Fixed

- Stops requesting macOS camera and microphone permission during application startup.
- Allows camera and microphone access only on the actual `/meet` route, never on Meet Home, sign-in, or the account chooser.
- Separates the DominionStar application version from the Electron runtime version so hosted release checks read the correct value.
- Advances the native desktop bridge contract to version 12 and exposes consistent `version`, `appVersion`, and `buildVersion` fields.
- Preserves the existing authenticated desktop session and window preferences.

## Verification

- Native desktop contract verification
- Desktop capture source recovery
- 25 repeated capture-session lifecycles
- Adaptive desktop layout tests
- JavaScript syntax validation

