# DominionStar Executive OS — Agent Code Registration and Optional Google Sign-in

**Release state:** GitHub review branch only. No production deployment, Google Cloud project changes, Supabase provider changes, or database migrations.

## Registration

- Create Account already required `agent_code`, submitted in Supabase Auth signUp metadata along with full name and optional SMD name.
- The reviewed form explicitly marks Agent Code **required**, places it near the top, and explains that DominionStar verifies the code before member access is approved.
- Account creation, or an authenticated Supabase session, **does not equal approval**. Membership verification must come from the authoritative `member_profiles` record and row-level access policies, never from user-editable signup metadata.
- Preserve email/password as the primary registration mechanism. Do not create a Google-only shortcut that skips Agent Code.

## Google sign-in — recommended only for an established approved member

- The review adds an isolated **Continue with Google** sign-in section. It is **hidden by default** because `window.DOMINIONSTAR_AUTH_FEATURES.googleSignIn` is currently `false`.
- Once explicitly enabled, the button uses `supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}})` and returns to `/member-login/?oauth=google`.
- On return, the client calls `auth.getUser()` and reads the member's `member_profiles` record using their authenticated user ID. It requires `verification_status='approved'` and a nonblank `agent_code`. If not verified, it signs out and explains the existing registration/approval requirement.
- This client verification is defense in depth only. Server-side RLS and authorization checks on **all** protected tables/actions remain mandatory. The frontend callback is not an authorization grant.
- The code does not place OAuth client secrets, privileged keys, or unverified role claims into the browser.

## Required before turning on the feature

1. Configure a Google Cloud OAuth Web application, Google Auth branding and the minimal email/profile/OpenID scopes.
2. Enable the Google provider in Supabase Auth using a **server-side** Google client ID and secret; never commit the secret.
3. Configure the Supabase Google OAuth callback in Google Cloud and allow the intended DominionStar site redirect `https://dominionstarld.com/member-login/?oauth=google` in Supabase Auth redirect allowlist. Use independent staging redirects for staging.
4. Test same-email linking of a verified existing password account. Supabase may automatically link identities for verified matching email addresses. Explicitly test accounts with different or unconfirmed emails to avoid duplicate account profiles.
5. **Test new Google identities.** OAuth can create an Auth account, even when DominionStar membership is not approved. The review callback refuses dashboard access, but an authentication-layer before-user-created hook or approved-account-only identity linking may be required if automatic Google-only signup must be prevented entirely.
6. Verify pending, declined, suspended and nonexistent member accounts cannot read/write restricted tables, even when they have an OAuth session. Test cross-account permissions and the Founder-only RPC as well as dashboard redirects.
7. Verify callback error and cancel behavior, registration confirmation, password login, password reset, tab switching, browser back navigation, mobile layout, consent screen and browser private session.
8. Only when these checks pass, change `googleSignIn: false` to `true` on an approved release and validate again on staging before any production deployment.

### Why the Google option is not being enabled now

Existing user requested review-branch-only changes and no billable Supabase branch. Enabling OAuth would change a live authentication provider and create an unverified registration path until its RLS and identity-linking tests are done.

## Documentation

- Supabase official Google provider guide: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- Supabase official identity linking guide: https://supabase.com/docs/guides/auth/auth-identity-linking
- Supabase official OAuth JS reference: https://supabase.com/docs/reference/javascript/auth-signinwithoauth
