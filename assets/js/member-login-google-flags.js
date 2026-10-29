/* DominionStar Auth review flag.
 * Google OAuth must NOT be enabled until Supabase Google provider,
 * redirect allowlist, identity linking and RLS tests are signed off.
 * Do not put Google client secrets in frontend code.
 */
window.DOMINIONSTAR_AUTH_FEATURES = Object.freeze({
  googleSignIn: false,
  googleIdentityLinking: false
});
