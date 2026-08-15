# DominionStar Meet Desktop v1.1.8 Release Gate

This release is not approved for packaging unless `npm run verify` passes from a clean checkout.

The certified desktop startup contract requires:

- `src/bootstrap.mjs` is the packaged entry point.
- The native desktop partition suppresses the stale hosted `guardian-certification.js` gate before Meet navigation.
- macOS requests camera and microphone access only when the OS permission is still undetermined.
- `src/main.mjs` remains responsible for the production meeting runtime, permission policy, updater, capture, remote-control capability gating, session recovery, and presenter window.
- `window.dominionDesktop.version`, `appVersion`, and `buildVersion` match the package release; Electron runtime identity remains isolated in `electronVersion`.
- Release metadata self-heals generated package-lock version fields before certification and then verifies they match the package release.
- Hosted application caches/service workers can be refreshed without deleting authentication/session data.
- Release tags must exactly match `package.json` before Windows or macOS packaging starts.

A failure in any of these checks is a release blocker rather than a warning.
