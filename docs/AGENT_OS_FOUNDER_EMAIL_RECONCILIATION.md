# DominionStar One — Read-only Email Queue Reconciliation

**Date:** November 8, 2026  
**Status:** Draft PR #198, review-only. **NOT LIVE.** This is for
the Agent OS notification email outbox, not DominionStar Meet.

## Purpose

A provider can accept a priority-notification email while the worker
fails to acknowledge the queued message in PostgreSQL. Automatically
requeuing that item could send the same email twice, particularly after
the provider's 24-hour idempotency retention expires.

The reviewed email worker therefore holds ambiguous cases in processing
or failed status rather than blindly resending them. The additional
reconciliation endpoint gives the Founder a **read-only view of the
backlog** without exposing recipients or email content.

## Restricted health endpoint

**Route (when eventually authorized):**
`/.netlify/functions/email-outbox-health`

**Activation:** `DOMINIONSTAR_EMAIL_HEALTH_ENABLED=enabled`, disabled
by default. The route cannot inspect the queue before explicit
activation in an approved release. The regular priority-email
routing flag is separate and remains off pending release authorization.

**Request:** GET with a fresh Supabase user access token in the
Authorization: Bearer header. The server independently checks
the authenticated user's server-owned `member_profiles.is_founder=true`
and `verification_status='approved'` using the service-role client.
Unauthenticated, anonymous, unapproved, and non-Founder callers
receive no queue data. POST and other methods cannot mutate the queue.

The endpoint reports three bounded groups:

| Group | Selection | Operational interpretation |
|---|---|---|
| Processing stalled | Status processing, last update more than 15 minutes ago | Provider outcome may be uncertain; inspect before any action |
| Failed deliveries | Status failed, newest records first | Categorize provider rejection, exhausted retries, or manual hold |
| Pending overdue | Status pending, retry due more than 60 minutes ago | Delivery scheduler or queue availability may be interrupted |

Each group returns an **exact total** plus at most 30 sanitized cases.
When a category contains more records than the returned sample, the
response marks it truncated. Returned case fields are limited to:
case ID (outbox UUID), status, bounded reason code, attempt count,
age, queue age, and whether a provider acknowledgement is recorded.

No recipient email address, member ID, message subject/body,
raw provider failure text, action URL or provider message ID
is returned. All database read failures return a generic error
without leaking the service-role connection details.

## Founder incident handling (manual, never automatic)

1. Confirm authorization and verify the latest case totals.
   A processing case older than 15 minutes warrants investigation,
   **not** an immediate retry.
2. Use the case UUID only in the authorized internal database/admin
   environment. Compare the immutable provider idempotency key with the
   provider's message history, if accessible.
3. If the provider accepted the email, reconcile its outbox status
   through an audited, separately approved workflow. **Do not resend it.**
4. If there is no reliable proof of non-delivery, treat the outcome as
   ambiguous. Escalate it; do not reset the same outbox row to pending.
5. Reconcile a pending-overdue case by checking the scheduler, processor
   release flag, member consent and provider status before any proposal
   to retry.
6. Never reuse an old idempotency key outside the provider's guaranteed
   retention period as evidence that a retry is safe. Resend documents a
   24-hour retention period; the worker conservatively holds retries
   with queue age of at least 23 hours.
7. Record every proposed operator state change, the reason, evidence,
   affected case ID, reviewer and timestamp in the approved internal
   incident system before any administrative action. This draft adds
   **no state-changing recovery API**.
8. Include the result in the next internal operations review.
   Do not place recipient information or provider errors in a public
   dashboard or GitHub issue.

## Verification included

- `netlify/functions/email-outbox-health.mjs` — GET-only, Founder-only,
  disabled by default, bounded read-only queries.
- `tests/email-outbox-health-review.test.mjs` — simulated unauthorized,
  anonymous, unapproved, Founder, no-PPI, error, count and page bounds
  cases. No Supabase network request and no email provider call.
- `.github/workflows/notification-readability-review-gate.yml`
  executes the tests and JavaScript syntax check.

## Remaining release gates

1. Verify with **actual nonproduction Supabase Auth, RLS/Data API and
   a test outbox** under isolated synthetic accounts.
2. Approve and test an audited administrative resolution workflow.
3. Add monitored alerting for processing age and unresolved manual cases
   so the Founder does not have to check constantly.
4. Confirm the provider's actual event history, message identifiers,
   bounce/complaint information, and change-management controls.
5. Verify an authorized Founder user interface can display the
   redacted cases without exposing personally identifying information.
6. Explicitly approve the environment flag, Netlify function deployment,
   incident response owner and rollback before enabling this route.

**No production email, database row, preference or app was changed.**
The route is a proposed, inactive review component—not a claim that
the live platform now provides email-delivery monitoring.
