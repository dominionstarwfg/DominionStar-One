# DominionStar Executive OS (Web) — Google Sign-In release gate

**Project:** DominionStar Agent Dashboard accessed from `dominionstarld.com`  
**Repository:** `dominionstarwfg/DominionStar-One`  
**Source branch:** `review/login2-recovery-netlify-hold-20261019`  
**Status:** Code prepared and test-passed; **Google feature flags OFF**, provider configuration and real-person OAuth end-to-end tests not verified. Not deployed to Netlify.

## Intended user experience

1. An agent registers with a required Agent Code and receives Founder approval using the existing website workflow.
2. The agent can sign in with their email/password as usual.
3. After Google OAuth is approved and configured, an existing Founder-approved member may sign in using **Continue with Google**. A Google-authenticated user must not be granted access merely because the Google email appears familiar. The authenticated account's stored `member_profiles` row, matching user ID, `approved` status and Agent Code are verified.
4. Approved agents can optionally link an additional Google identity from Agent Settings when manual identity linking is configured and tested. Google login and identity linking have separate switches.
5. The Agent Dashboard includes a link to the independent DominionStar Meet service; Meet source, installer and settings are **outside this web-dashboard release scope**.

## Checked source and database safeguards

- `assets/js/member-login.js` verifies `auth.getUser()`, Google identity presence, stored `member_profiles.id` matching `auth.uid()`, Founder approval and a nonempty Agent Code before routing to `/member-dashboard/`. It signs out on callback failures.
- `assets/js/account-google-identity-review.js` independently verifies approved member status before `linkIdentity({provider:'google'})`.
- `assets/js/member-login-google-flags.js` still has `googleSignIn: false` and `googleIdentityLinking: false`.
- Live **read-only** SQL inspection confirmed an own-profile SELECT policy on `member_profiles` and separate Founder update policies. RLS must remain authoritative; browser flags are not security controls.
- `tests/agent-google-oauth-callback-runtime-review.test.mjs` exercises approved sign-in, pending rejection, missing Google identity, unavailable profile, no Agent Code, incorrect user ID and no authenticated user. Tests use mocked users, never production accounts.

## External setup required before turning the flags on

1. Register a **web application** OAuth client in the Google Auth Platform; configure approved audience and consent details.
2. Configure the web origin `https://dominionstarld.com` in Google Authorized JavaScript origins. In Google Authorized Redirect URIs, use the **Supabase Auth callback**, not the Dashboard route: `https://ckmurvhjumzlhsegncba.supabase.co/auth/v1/callback`. Verify it directly in the Supabase Google provider screen before copying.
3. Configure the Google provider in the **existing approved Supabase project** via its Auth provider settings, and register the Client ID and Client Secret there only. **Do not commit a Google secret to GitHub, Netlify static files or frontend JavaScript.**
4. Configure the Supabase Auth Site URL and allowed redirect URLs for `https://dominionstarld.com/member-login/?oauth=google` and `https://dominionstarld.com/account-settings/?google_link=complete`. If testing on staging, the redirect allowlist and Google OAuth origins must match the separate isolated staging URL and *separate staging Supabase project*; never connect preview staging to production.
5. Before enabling manual identity linking, review the Supabase Identity Linking settings and automatic same-email linking implications. Test linking an approved existing account, identity mismatch denial, revoked identity, cancelled consent and password-login compatibility.
6. Perform **real browser** tests with synthetic approved, pending and mismatched agent accounts. Confirm password login still works, OAuth redirects return correctly, RLS prevents data access when approval is missing, and no new account bypasses Founder approval.
7. Only **after** provider setup and the tests pass, enable the Google sign-in feature flag in a reviewed release. Enable `googleIdentityLinking` separately after linking verification. Obtain explicit production-release authorization before Netlify deployment.

Official setup guides:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-identity-linking

## Latest automated verification

[GitHub Actions Agent Website QA run 40786713101](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/40786713101) — **121 passed, 0 failed**; targeted settings tests 16 passed, 0 failed.

**No deployment, Auth provider change, Supabase database write, or Meet application modification was made.**
