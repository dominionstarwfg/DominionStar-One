# DominionStar Meet Desktop v1.1.2 audited patch

Upload the contents of this folder to the root of `DominionStar-One` while preserving the displayed folders and filenames.

This patch contains only the audited v1.1.2 corrections. It does not contain an installer and must not be published as a release until the GitHub Actions Windows and macOS builds both pass.

## Required safe flow

1. Upload every item in this folder to the repository root.
2. Select **Create a new branch for this commit and start a pull request**.
3. Use branch name `desktop-v1.1.2-audited-fix` if GitHub asks for one.
4. Do not commit directly to `main`.
5. Do not merge or publish a release until both build jobs pass.

Suggested commit title: `Fix desktop certification cache and bridge contract`
