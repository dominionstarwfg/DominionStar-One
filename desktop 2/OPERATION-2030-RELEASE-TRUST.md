# Operation 2030 — Desktop Release Trust

DominionStar Meet desktop releases must fail closed unless the package and release pipeline satisfy the following baseline:

- stable semantic versioning
- private application package
- fixed `com.dominionstar.desktop` application identity
- GitHub updater provider pinned to `dominionstarwfg/DominionStar-One`
- ASAR packaging enabled
- explicit desktop file allowlist; no broad repository bundling
- production dependency audit blocks high/critical vulnerabilities
- clean-runtime certification remains mandatory
- artifact size budget remains mandatory
- stale-install replacement and live Meet contract remain mandatory

Cryptographic publisher identity (Windows Authenticode and Apple Developer ID/notarization) is the next independent gate and must be certified before a tagged desktop release is approved.
