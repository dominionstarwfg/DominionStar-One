# DominionStar Meet Release Standard

Every installable DominionStar Meet build must pass the complete release audit before it is sent for installation.

## Priority

Zoom desktop behavior is the primary UX reference for meeting controls, layout hierarchy, proportions, spacing, readable typography, panel placement, and interaction behavior. DominionStar branding and approved product-specific improvements may differ, but they must not reduce familiarity, usability, or reliability.

The latest user-approved DominionStar Meet 3D illustration is a first-class visual reference. During implementation and release review, the shipped meeting UI must be compared side by side with both that approved 3D reference and the current Zoom macOS behavior. A green generic UI test does not overrule a visible reference mismatch.

Physical-Mac acceptance feedback is a first-class release input. A build that passes CI but fails on a real Mac is rejected, and the physical failure must be converted into an automated regression gate whenever it can be reproduced deterministically.

Security labels must be technically true. WebRTC transport encryption may be described as encrypted transport, but the UI must not claim end-to-end encryption until a separately verified E2EE media architecture is implemented and release-gated.

## Mandatory gates

1. Start from a clean checkout and remove generated state, old installers, archives, and build output.
2. Run source-level certification for authentication, lifecycle, media permissions, A/V settings, meeting parity, screen sharing, WebRTC transport, TURN relay, diagnostics, macOS install authority, Zoom-production polish, physical-Mac acceptance authority, and the current approved 3D-reference authority.
3. Build the universal packaged macOS application from the exact audited source.
4. Verify bundle identity, version, privacy strings, entitlements, and code-signature integrity.
5. Audit the packaged application contents rather than relying only on source checks.
6. Launch the packaged `.app` and reject launch/library/signature failures.
7. Exercise the packaged desktop controls through the real renderer.
8. Measure the rendered Zoom-parity interface. This is a release-blocking gate and must cover toolbar geometry, icon and label scale, Audio/Video grouping, Share emphasis, End placement, Host Tools, Participants, Chat, Reactions, More, readable text/contrast, and uncaught renderer errors.
9. Run the packaged physical-acceptance gate. It must prove that View, Host Tools, More, participant media/status controls, per-participant ellipsis, Chat, Reactions, readable settings typography, and the real-source Share authority are mounted and interactive in the packaged renderer.
10. Run every screenshot-derived regression gate added after a physical-Mac rejection. A generic visual pass cannot substitute for the exact regression check.
11. Run the packaged approved-3D-reference gate. It must prove the approved toolbar order, dedicated Raise hand control, clean Chat navigation without duplicate recipient chrome, floating participant video filmstrip behavior, truthful encryption state, real branding, and View control before any archive or DMG can be created.
12. Do not create or upload the installer if any prior gate fails.
13. Create the DMG only after all packaged audits pass, mount the DMG, verify the application inside it, then produce checksums and provenance.

## macOS privacy identity rule

CI can verify screen-source code paths and the packaged renderer, but it cannot prove that macOS TCC will preserve Screen Recording authorization across application rebuilds. macOS tracks privacy-protected access using code identity/designated requirements. Therefore:

- An ad-hoc-signed build must be recorded as `tcc_persistence=not-certified-adhoc` in release provenance.
- An ad-hoc build may be used for prototype testing with explicit reauthorization of the exact installed binary, but it must not be described as Screen Recording permission-persistence certified.
- Production-grade cross-version Screen Recording persistence requires a stable Apple code-signing identity and must be physically verified after that signing path is introduced.

## Release rule

A build that fails any gate is a rejected candidate. Increment the candidate version after a product correction and rerun the full pipeline from clean source. Do not tell the user to install a rejected or partially audited candidate.
