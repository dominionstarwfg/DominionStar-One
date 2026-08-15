# DominionStar Meet v1.1.8 forensic finding

The installed macOS hang report proves the application binary is DominionStar Meet 1.1.8, so the repeated `Desktop update required` screen is not a stale installer problem.

The current Meet page references `/assets/js/runtime/guardian-certification.js`, but that file is not present in the repository tree. Desktop release rebuilding therefore cannot reliably repair the hosted certification behavior.

Release direction:
1. Remove the hosted certification script dependency from the Meet page.
2. Return Electron startup to a single main-process entry point instead of a bootstrap -> dynamic import chain.
3. Keep macOS camera/microphone permission prompting in the main process.
4. Add diagnostics for navigation, renderer hangs, certificate errors, and update state.
5. Do not publish a new installer until the hosted-page and native startup contracts both pass CI.
