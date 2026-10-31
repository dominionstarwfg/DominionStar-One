# DominionStar Agent & Founder OS — Production Cutover Runbook

Status: REVIEW-ONLY. Do not execute production database mutations without explicit production approval.

Scope: public website + authenticated Agent/Founder OS only. DominionStar Meet is excluded.

## Release invariant

The cutover must preserve working Messages, notifications, Community Chat, appointments, and agent calls at every step. Database privilege revocations must never precede browser code that knows the replacement RPC.

## Phase 0 — Read-only production preflight

Run:

`scripts/security/agent-os-production-preflight.READ-ONLY.review.sql`

Required PASS gates:
- required tables
- required columns
- no active communication calls
- email queue is not processing
- expected pre-cutover policies
- existing email trigger

Informational snapshots:
- notification email preferences
- anonymous non-Meet SECURITY DEFINER count

Abort if any required gate fails.

Repository control requirement before production approval:
- `main` must have branch protection enabled.
- the three review checks must be configured as required status checks.
- direct unreviewed pushes to `main` must not be allowed.

## Phase 1 — Additive RPC before deploy

Apply only:

1. `notification-read-state.DO-NOT-RUN.review.sql`

Reason: the new Dashboard uses `mark_my_executive_notifications_read` without a legacy UPDATE fallback. This migration is additive and does not revoke the old browser path.

Verify the RPC exists, anonymous execution is denied, authenticated execution is granted.

## Phase 2 — Deploy the reviewed Agent/Founder OS code

Deploy the review candidate with:

- `trustedMessageEvents: false`
- `webPush: false`

The new Direct Messages code remains backward-compatible before its mutation RPCs are installed. The trusted call lifecycle also fails closed to the legacy signaling path if its RPCs are not installed yet.

Required smoke checks before continuing:
- Agent login
- Dashboard loads
- notification drawer opens
- mark one notification read
- send and receive a Direct Message
- read receipt
- edit own message
- delete own message
- Community Chat send
- appointment page loads
- start/cancel one audio call without leaving an active call row

Abort database hardening if the smoke test fails.

## Phase 3 — Coordinated security/data migrations

Apply in this exact order:

1. `direct-message-integrity.DO-NOT-RUN.review.sql`
   - installs read/edit/delete message RPCs
   - removes broad Direct Message UPDATE

2. `agent-founder-rpc-privilege-hardening.DO-NOT-RUN.review.sql`
   - removes anonymous Agent/Founder SECURITY DEFINER execution
   - replaces arbitrary Community email fan-out with persisted-message-id RPC
   - hardens appointment email authorization
   - fixes timestamp helper search paths

3. `communication-call-lifecycle.DO-NOT-RUN.review.sql`
   - installs trusted call lifecycle RPCs
   - removes direct browser call-row mutation
   - server-authors missed/declined call history

4. `notification-email-opt-in-reset.DO-NOT-RUN.review.sql`
   - resets message/community email to explicit opt-in
   - preserves appointment/announcement email
   - cancels stale pending email older than 30 days without deleting history

5. `web-push-foundation.DO-NOT-RUN.review.sql`
   - creates push subscription/outbox foundation
   - installs trusted Direct Message event trigger
   - restricts Executive Event browser privileges
   - validates missed/declined call events against `communication_calls`
   - keeps push delivery inactive until subscriptions and server VAPID config exist

Do not reorder #1–#5.

## Phase 4 — Immediate database verification

Run:

`scripts/security/agent-os-postcutover-verify.READ-ONLY.review.sql`

All gates must PASS.

Then run Supabase Security Advisor.

Expected:
- zero anonymous non-Meet SECURITY DEFINER functions, excluding the explicitly excluded Meet routine
- no authenticated direct UPDATE on Direct Messages
- authenticated Executive Events limited to SELECT + INSERT
- authenticated communication_calls limited to SELECT
- message/community email preference count ON = 0
- stale pending email >30 days = 0
- trusted Direct Message trigger present
- push foundation tables/functions present and service-role claim restricted

If any post-cutover gate fails, do not enable trusted message events and do not enable Web Push.

## Phase 5 — Trusted message event activation

Only after Phase 4 is fully green:

Change:

`trustedMessageEvents: false → true`

Keep:

`webPush: false`

Deploy the one-line feature-flag release.

Smoke test:
- send one Direct Message
- recipient receives exactly one Executive Event
- no browser-authored cross-member event succeeds
- no duplicate notification
- missed call creates one call history row + one missed-call Executive Event

## Phase 6 — Web Push activation is a separate gate

Web Push must remain OFF until Netlify production has all required server variables:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_PROCESSOR_SECRET`
- existing `SUPABASE_URL`
- existing `SUPABASE_SERVICE_ROLE_KEY`

No Netlify connector is available in this ChatGPT environment, so environment configuration is not part of the automated database cutover.

After Netlify environment configuration:
1. verify `push-public-key` returns the configured public key
2. verify scheduled push processor can claim with service role
3. enable `webPush: true`
4. deploy
5. subscribe one test browser
6. send a test Direct Message with browser closed
7. verify one push delivery
8. verify 404/410 subscriptions are disabled
9. verify focused DominionStar tab suppresses duplicate system notification

## Rollback boundaries

Before Phase 3: normal code rollback is sufficient.

During Phase 3: each SQL file is transaction-wrapped. A failing file rolls back its own changes. Stop immediately; do not continue to later migrations.

After Phase 3 but before trustedMessageEvents=true: keep the new database hardening in place and fix forward. The deployed review code is designed for the new RPCs.

After trustedMessageEvents=true: if trusted event smoke tests fail, switch the flag back to false only if the Executive Event cross-member insert policy is temporarily restored. Otherwise the browser fallback is intentionally blocked by the hardened policy.

Web Push rollback: set `webPush:false`. Push tables/outbox may remain in place; disabling the feature flag stops browser subscription activation.

## Production approval boundary

Nothing in this runbook authorizes production mutation. The explicit approval must cover:
- applying the six database migrations listed above (including the additive read-state migration)
- merging/deploying the reviewed Agent/Founder OS branch
- later enabling trustedMessageEvents

Web Push activation requires its own environment readiness gate.
