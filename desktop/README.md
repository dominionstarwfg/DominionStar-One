# DominionStar Desktop — Alpha 1

This folder contains the Windows and macOS desktop shell for the live DominionStar platform.

## Run locally

```bash
npm install
npm run verify
npm start
```

## Build installers

- Windows (x64 and ARM64): `npm run dist:windows`
- macOS (universal Intel + Apple Silicon): `npm run dist:mac`

Signed public installers require a Windows code-signing certificate and an Apple Developer ID certificate with notarization credentials. Unsigned development builds can be produced before those credentials are added.

The included GitHub Actions workflow builds both platforms on their native operating systems. Push a tag such as `desktop-v0.1.0` or run **DominionStar Desktop Installers** manually, then download the Windows and macOS artifacts from the workflow run.

## Alpha 1 capabilities

- Persistent DominionStar sign-in and browser session
- Secure, sandboxed web application window
- Native camera and microphone permission requests on macOS
- Safe handling of external links
- `dominionstar://meet` meeting deep links
- Guardian-style renderer crash recovery and offline screen
- Windows NSIS and universal macOS DMG/ZIP packaging configuration

The existing web platform remains the communication engine, so web and desktop participants share the same meetings, chat, reactions, hand queue, and account data.
