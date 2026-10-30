# DominionStar Agent/Founder OS — Frozen Cutover Manifest

Review branch: `review/notification-readability-20261029`

Production base reviewed against: `11fbb9e23178db5255defb5f1b7bc0d0ad36488c`

Draft PR: #183

The **final approved PR head** must be recorded at execution time. This manifest freezes the database artifacts by Git blob SHA so documentation/test commits do not invalidate the database fingerprints.

## Database execution order and source fingerprints

| Order | File | Git blob SHA |
|---:|---|---|
| Preflight | `scripts/security/agent-os-production-preflight.READ-ONLY.review.sql` | `99f4bcd77db52409c63b62d956b5c525220a8562` |
| 1 | `scripts/security/notification-read-state.DO-NOT-RUN.review.sql` | `469154cf0be188d5783df6501e9e7b27914ad2fe` |
| Deploy | Reviewed Agent/Founder OS code with both notification feature flags OFF | record final approved PR head at execution |
| 2 | `scripts/security/direct-message-integrity.DO-NOT-RUN.review.sql` | `1395765416a5a17382a039f52c1a5543fa02f59b` |
| 3 | `scripts/security/agent-founder-rpc-privilege-hardening.DO-NOT-RUN.review.sql` | `5fcab25534ddf0d1ad549532421daef7d6aa20e4` |
| 4 | `scripts/security/communication-call-lifecycle.DO-NOT-RUN.review.sql` | `4fefda45f8b5f94fb9b6d3ddb0d24897dcbbc208` |
| 5 | `scripts/security/notification-email-opt-in-reset.DO-NOT-RUN.review.sql` | `546a446844903492f2bfa04823e0cb26dbabd54e` |
| 6 | `scripts/security/web-push-foundation.DO-NOT-RUN.review.sql` | `e25d5bf2d7ca6ba0c2f8b4143a256a5e5db91553` |
| Verify | `scripts/security/agent-os-postcutover-verify.READ-ONLY.review.sql` | `2bfa9f1a171cd2a987af573bead31176e47c2d65` |
| Emergency preflight | `scripts/security/agent-os-emergency-rollback-preflight.READ-ONLY.review.sql` | `98652c171e6a8f5b98d107ec4442c9775e8869e2` |
| Emergency only | `scripts/security/agent-os-emergency-compatibility-rollback.DO-NOT-RUN.review.sql` | `0fb6cf26fd8011f6f775593c6da8269f62c44560` |

## Feature flags at core cutover

```js
trustedMessageEvents: false
webPush: false
```

After all database migrations and post-cutover checks pass:

```js
trustedMessageEvents: true
webPush: false
```

Web Push is a separate activation after Netlify VAPID/server variables are configured and verified.

## Emergency compatibility rollback

If hardened database changes have landed but the frontend must be rolled back to the pre-cutover code, first run:

`scripts/security/agent-os-emergency-rollback-preflight.READ-ONLY.review.sql`

If its required gates pass, use only after explicit approval:

`scripts/security/agent-os-emergency-compatibility-rollback.DO-NOT-RUN.review.sql`

That rollback:
- restores authenticated Direct Message UPDATE compatibility,
- restores authenticated own-event read-state UPDATE,
- restores the old authenticated cross-member Executive Event insert path,
- disables the trusted Direct Message event trigger to prevent duplicate events,
- restores authenticated execution of the legacy Community email RPC,
- does **not** restore anonymous table/RPC access,
- does **not** undo call-table hardening.

It is an emergency compatibility state only. Fix forward and reapply the hardened migrations afterward.

## Execution refusal conditions

Do not execute production cutover when any of these are true:

- the read-only preflight has a failing required gate,
- a communication call is ringing or connected,
- the email outbox has a row in `processing`,
- PR review gates are not green,
- branch is behind `main`,
- the final approved PR head has not been recorded,
- any migration Git blob SHA differs from this manifest,
- notification feature flags are already enabled unexpectedly,
- production Netlify configuration is being changed in the same step as the core DB cutover.
