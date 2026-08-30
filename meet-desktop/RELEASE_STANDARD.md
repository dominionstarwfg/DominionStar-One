# DominionStar Meet Release Standard

Every installable DominionStar Meet build must pass the complete release audit before it is sent for installation.

## Priority

Zoom desktop behavior is the primary UX reference for meeting controls, layout hierarchy, proportions, spacing, readable typography, panel placement, and interaction behavior. DominionStar branding and approved product-specific improvements may differ, but they must not reduce familiarity, usability, or reliability.

Physical-Mac acceptance feedback is a first-class release input. A build that passes CI but fails on a real Mac is rejected, and the physical failure must be converted into an automated regression gate whenever it can be reproduced deterministically.

## Mandatory gates

1. Start from a clean checkout and remove generated state, old installers, archives, and build output.
2. Run source-level certification for authentication, lifecycle, media permissions, A/V settings, meeting parity, screen sharing, WebRTC transport, TURN relay, diagnostics, macOS install authority, Zoom-production polish, and physical-Mac acceptance authority.
3. Build the universal packaged macOS application from the exact audited source.
4. Verify bundle identity, version, privacy strings, entitlements, and code-signature integrity.
5. Audit the packaged application contents rather than relying only on source checks.
6. Launch the packaged `.app` and reject launch/library/signature failures.
7. Exercise the packaged desktop controls through the real renderer.
8. Measure the rendered Zoom-parity interface. This is a release-blocking gate and must cover toolbar geometry, icon and label scale, Audio/Video grouping, Share emphasis, End placement, Host Tools, Participants, Chat, Reactions, More, readable text/contrast, and uncaught renderer errors.
9. Run the packaged physical-acceptance gate. It must prove that View, Host Tools, More, participant media/status controls, per-participant ellipsis, Chat, Reactions, readable settings typography, and the real-source Share authority are mounted and interactive in the packaged renderer.
10. Do not create or upload the installer if any prior gate fails.
11. Create the DMG only after all packaged audits pass, mount the DMG, verify the application inside it, then produce checksums and provenance.

## Release rule

A build that fails any gate is a rejected candidate. Increment the candidate version after a product correction and rerun the full pipeline from clean source. Do not tell the user to install a rejected or partially audited candidate.
