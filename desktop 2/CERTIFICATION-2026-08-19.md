# DominionStar Meet Desktop Certification — 2026-08-19

Purpose: trigger the repository's existing Desktop PR Verification workflow against the exact current `main` desktop source without changing application behavior.

Certification scope:
- locked dependency install and supply-chain audit
- release-trust and publisher-trust policy checks
- clean-runtime desktop verification
- live hosted Meet runtime audit
- universal macOS app build
- deterministic replacement PKG build
- installer size budget
- install over stale v1.1.8 and launch
- reinstall and verify the actual installed app against the live Meet release contract

This file is documentation only and must not affect runtime, packaging, updater, capture, WebRTC, media, authority, or meeting behavior.
