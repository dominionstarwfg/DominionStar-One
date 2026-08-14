# DominionStar Meet Desktop — 1.1 Release Candidate

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

## 1.0 candidate capabilities

- Separate sign-in and registration paths for existing DominionStar members and new Meet users
- Dedicated Meet Home; the Agent Dashboard and public platform remain in the browser
- Persistent Home navigation from every desktop screen
- Visual screen/window source picker; Windows can include computer sound
- Host/co-host remote-control requests for entire-screen shares, with explicit sharer consent and immediate revocation
- Secure, sandboxed web application window
- Native camera and microphone permission requests on macOS
- Safe handling of external links
- `dominionstar://meet` meeting deep links
- Guardian-style renderer crash recovery and offline screen
- Windows NSIS and universal macOS DMG/ZIP packaging configuration

## 1.1 adaptive desktop and updates

- Native macOS traffic-light title controls and Windows caption controls
- Restores the previous safe window position and size after restart
- Wide layout keeps participant videos at the right; narrow and compact layouts move them across the top
- Mini-window mode keeps the essential microphone, camera, participants, and leave controls visible
- Participant docks show at most five tiles before scrolling and remain freely movable
- Off-screen or unsafe dock positions are corrected automatically after display or window-size changes
- Background update checks download a newer signed release without interrupting a meeting
- Downloaded updates install over the existing app on exit; the persistent account session, device preferences, join preferences, and saved window state remain in the user-data directory

For tag releases, the GitHub workflow changes the packaged update provider to the current repository and creates a draft release containing installers, blockmaps, and update metadata. Publish the draft only after signing/notarization and real Windows/macOS smoke tests pass.

The existing web platform remains the communication engine, so web and desktop participants share the same meetings, chat, reactions, hand queue, and account data.

## Production requirements

- Deploy the matching web release before distributing this desktop build.
- Configure TURN relay credentials in Netlify for reliable calls across strict networks.
- Configure DeepL or Google Translate in Netlify for translated captions.
- Public macOS distribution requires Developer ID signing and Apple notarization.
- Public Windows distribution should use Authenticode signing.
- macOS computer-audio sharing is not advertised by this build; it requires a supported native audio capture implementation.
