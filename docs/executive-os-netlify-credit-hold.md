# Executive OS 2030 — GitHub-only release handoff

**Branch:** review/login2-recovery-netlify-hold-20261019

**Status:** source changes only. No production merge, Netlify publish, or Supabase database change performed.

## Design references

- Balanced Executive OS 2030: executive-preview/index.html (design preview; not authenticated application).
- Login Concept 2: member-login/index.html with responsive assets/css/member-login-executive-v1.css.
- Article Concept 8: selected editorial direction, not yet published.
- The existing member-dashboard/ retains its legacy authenticated implementation. **The OS 2030 dashboard is not integrated or live.**

## GitHub-only work completed

1. Modernize member-login HTML while retaining sign-in, registration, pending Founder approval text, reset email flow, and existing authentication script hooks.
2. Add member-update-password/ to receive Supabase password-recovery redirects.
3. Require a PASSWORD_RECOVERY auth event with user session before showing the password form; a normal signed-in session alone does not unlock it.
4. Validate confirmation and password length client-side, then update password and sign out to require another login.
5. Change password-reset redirect target to /member-update-password/ and use an account-neutral email response.
6. Constrain post-login next URL to a same-origin path.
7. Add test coverage: node --test tests/login2-recovery-review.test.mjs.

## Release blockers and prerequisites

- **Netlify credits:** Owner restores usage. Confirm account is truly paused and inspect the latest build/deploy log; exhausted credits explain blocked new deploys under Netlify's current billing model.
- **Branch deploy safety:** Before restoring automatic builds, confirm the preview branch is not auto-published to production.
- **Supabase Auth redirects:** Allowlist exactly https://dominionstarld.com/member-update-password/ in Supabase Authentication > URL Configuration. Add staging URL separately only if a dedicated staging origin is explicitly approved. Do not use broad production wildcards.
- **Auth integration tests:** Test valid reset email link, expired/reused link, network failures, wrong confirmation, weak password, valid login, pending user, approved user, and non-approved member access using synthetic accounts. Verify PASSWORD_RECOVERY callback ordering on actual browsers with the deployed Supabase SDK.
- **Dependency hygiene:** Pin and lock a vetted Supabase JavaScript library version rather than unpinned @2 CDN. Do not ship until this is addressed and retested.
- **Gate 0 security:** The separate security/gate0-review-20261018 branch documents critical access-control findings and untested candidate SQL. Database RLS, direct-message privacy, Founder permissions and other protections must be verified in non-production Supabase before an OS rollout. Do not blindly merge staging SQL into production.
- **Dashboard integration:** Map the approved OS design to approved real-data APIs and ensure agent social features, messages, profiles, and authorization tests pass. Static visual preview alone does not do this.
- **Public website:** Verify home, recruitment, scheduling, conversion forms, SEO, analytics, and Meet route isolation remain intact after a controlled deployment.
- **Release gate:** Review code, run Node 22 tests, complete browser/Auth staging QA, merge only with explicit authorization, deploy and verify live site.

## Reporting rules

Do not claim that the redesign or recovery is live; do not claim static tests validate the live authentication service. Do not assume Netlify publishes queued changes automatically when billing is restored.
