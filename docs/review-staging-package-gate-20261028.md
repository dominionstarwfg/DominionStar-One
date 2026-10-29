# DominionStar — Review-Only Staging Package Gate

**Status:** PASSED in GitHub Actions. No deployment was performed.

## Verified build

- **Static build workflow:** [GitHub Actions run 40727960175](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40727960175).
- **Review package artifact:** [dominionstar-review-static-public-dist](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40727960175/artifacts/12832863917) (3-day retention, GitHub-hosted archive).
- **Build commit:** `f59f0e8b63d46e54fd6ed2ae9244eaee20c3e09a`.
- Netlify build script `scripts/build-public-netlify.sh` reported `DOMINIONSTAR_PUBLIC_ROOT_OK` and `DOMINIONSTAR_BROWSER_MEET_ROUTE_OK /meet/`.
- Post-build inspection `scripts/check-staging-public-dist.mjs` reported `DOMINIONSTAR_REVIEW_BUILD_OK`, `PACKAGED_REFERENCES_OK 253`, and `NO_TESTS_OR_DESKTOP_SOURCE_PUBLISHED`.
- The artifact contains the static output folder, not a live Netlify deploy and not the macOS desktop installer. Netlify functions and production secret configuration are NOT exercised by this offline package check.

## Fixed before staging

- Original `_redirects` directed `/journey/` to the public Opportunity page. That shadowed the real `journey/index.html`, although the Agent Dashboard linked to it.
- Removed the stale redirect, preserved `/journey` → `/journey/` normalization, and added a fail-closed check to reject future regressions.
- Expanded package builder exclusions for `tests/`, `.env` files and `netlify.toml` inside the static output. Desktop Meet source remains excluded while the browser UI is mounted solely at `/meet/`.
- Added permanent tests guarding all nine core navigation destinations and the staging deployment boundary.

## Automated regression

- **Node suite:** [GitHub Actions run 40728173234](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40728173234), latest commit `4a9ee9b73cfc4fcc7d948e233ab198eecc13ee73`.
- **99 passed, 0 failed**, including the new Journey redirect and package safety tests.
- **Targeted Agent/Meet settings suite:** 16 passed, 0 failed.

## Pending real-world gates

1. Publish to an **isolated staging environment** only after the staging site and credentials are verified. The package alone is not browser-accessible on a public preview domain.
2. Verify agent signup, password login, Founder approval, pending-member denial, saved settings, Community, Messages, and appointment forms on staging.
3. Test two concurrent browser/desktop Meet participants with mic/camera, waiting room, panel stability, sharing, screen-share screenshots, and clean End Meeting lifecycle.
4. Apply only explicitly approved notification database security corrections; do not execute DO-NOT-RUN review SQL automatically.
5. Approve production release only after staging validation and a repeat full test-suite pass.

**Production was not modified in this gate.**
