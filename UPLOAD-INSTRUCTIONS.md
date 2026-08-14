# DominionStar Meet Desktop v1.1.3 certification repair

Upload the contents of this folder to the root of `DominionStar-One` while preserving the displayed folders and filenames.

This patch contains the v1.1.3 certification-contract correction and a regression test. It does not contain an installer and must not be published as a release until the GitHub Actions Windows and macOS builds both pass.

## Required safe flow

1. Upload every item in this folder to the repository root.
2. Select **Create a new branch for this commit and start a pull request**.
3. Use branch name `desktop-v1.1.3-certification-fix` if GitHub asks for one.
4. Do not commit directly to `main`.
5. Do not merge or publish a release until both build jobs pass.

Suggested commit title: `Fix desktop bridge certification contract`
