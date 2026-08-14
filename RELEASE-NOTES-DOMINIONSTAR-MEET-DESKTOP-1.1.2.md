# DominionStar Meet Desktop v1.1.2

Compatibility follow-up for the v1.1.1 privacy hotfix.

- Preserves the successful meeting-only camera and microphone policy.
- Restores the certified desktop bridge contract expected by Meet Home.
- Keeps the Electron runtime version and DominionStar application version in their established fields.
- Clears only stale hosted-page HTTP, service-worker, and Cache Storage data before startup, then forces fresh hosted navigation.
- Preserves sign-in cookies, local storage, IndexedDB, account sessions, and saved window settings.
- Retains existing account sessions, window settings, sharing recovery, and adaptive layouts.

Verified with desktop contract checks, hosted-session cache tests, capture-source recovery, 25 repeated sharing sessions, adaptive-layout tests, and JavaScript syntax checks.
