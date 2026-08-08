# DominionStar Meet Desktop — Alpha 5

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

## Alpha 5 capabilities

- Separate sign-in and registration paths for existing DominionStar members and new Meet users
- Dedicated Meet Home; the Agent Dashboard and public platform remain in the browser
- Persistent Home navigation from every desktop screen
- Visual screen/window source picker with optional computer-sound sharing
- Host/co-host remote-control requests for entire-screen shares, with explicit sharer consent and immediate revocation
- Secure, sandboxed web application window
- Native camera and microphone permission requests on macOS
- Safe handling of external links
- `dominionstar://meet` meeting deep links
- Guardian-style renderer crash recovery and offline screen
- Windows NSIS and universal macOS DMG/ZIP packaging configuration

The existing web platform remains the communication engine, so web and desktop participants share the same meetings, chat, reactions, hand queue, and account data.
