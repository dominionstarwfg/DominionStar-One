# DominionStar Meet Desktop v1.1.3

Certification-contract repair for the v1.1.2 desktop build.

- Reports the DominionStar application version consistently through `version`, `appVersion`, and `buildVersion`.
- Keeps the Electron runtime version in the separate `electronVersion` field.
- Restores desktop bridge contract version 12, which is required by the deployed Meet client.
- Adds an executable bridge-contract test that loads the real preload script and verifies the object exposed to Meet.
- Makes the verification gate reject incomplete desktop source trees and future bridge-version regressions.
- Preserves meeting-only camera and microphone access, existing account sessions, saved window settings, capture recovery, and adaptive layouts.

Verified locally with the executable bridge test, source completeness checks, capture-source recovery, 25 repeated sharing sessions, adaptive-layout tests, hosted-session cache tests, and JavaScript syntax checks.

