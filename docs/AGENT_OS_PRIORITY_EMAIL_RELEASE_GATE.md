# DominionStar One — Selected Priority Emails to the Address on File

**Status:** DRAFT / REVIEW ONLY — no production SQL, no real email sends,
no billable Supabase staging project, and no production deployment.

**Date:** November 5, 2026  
**Scope:** DominionStar One Agent OS email routing and Agent Settings.
This does **not** change DominionStar Meet desktop application behavior.

## Product contract

All authorized events can remain in the in-app notification inbox.
Only specific event types qualify for additional email, delivered to the
**confirmed email stored in Supabase Auth** for the recipient account.
An email address typed into a profile or included in an event payload
is never accepted as the delivery destination.

| Event class | Exact types / criteria | Default email behavior |
| --- | --- | --- |
| Founder announcements | `founder.urgent`, `founder.critical`, `announcement.urgent`, `announcement.critical`; `founder.announcement` and `announcement.published` only if high/critical priority | On if selected alerts and Founder announcements are enabled |
| Account/security | `account.approved`, `account.suspended`, `account.access_changed`, `security.alert` | On if selected emails are enabled and event is server-authored |
| Appointments | `appointment.confirmed`, `appointment.rescheduled`, `appointment.cancelled` | On if appointment emails are enabled |
| Meeting changes | `meeting.cancelled`, `meeting.rescheduled` | On only if existing meeting-room email preference permits |
| Meeting host absent | `meeting.host_absent` | Existing separate rate-bucketed, verified-email queue; never double-enqueue from generic event trigger |
| Member message / missed call | `message.received`, `call.missed` | Off unless member explicitly enables message emails |
| Community interaction | `community.mention`, `community.reply` | Off unless enabled; actual email requires trusted server-authored source, pending audited origin proof for cross-member replies |
| Routine likes/posts/reactions | `community.like`, `community.reaction`, `community.post` and other unrecognized/normal types | In-app only; no email |

**A recognized event type is necessary but not sufficient.** The queue
trigger validates source provenance for cross-member messages and missed
calls, requires server-origin/validated Founder authority for high-value
account and official notices, enforces recipient preferences, checks
confirmed Auth email, and deduplicates by event ID.

This table defines eligible **types**, not an assertion that every named
producer currently emits an event. Staging must inventory actual
event creators and confirm each is a reliable, server-authoritative
event before enabling any category.

## User-facing controls

- Agent Settings -> Notifications displays the account's confirmed
  email destination through an Auth `getUser` response. It never
  fetches another member's profile email.
- `Selected email alerts` is the global opt-out switch.
- Founder announcements and appointments are separately configurable.
- Member Messages / missed calls and Community mentions/replies
  require explicit opt-in.
- In-app notifications, browser alerts, notification sounds and
  web push subscriptions are separate channels. **Web push to a closed
  browser remains off** in the current review, and email selection does
  not imply browser push is enabled.

## Implementation prepared (not deployed)

1. `netlify/functions/_shared/priority-email-policy.mjs`: pure,
   testable event-type whitelist and preference behavior.
2. `scripts/security/priority-member-email-routing.DO-NOT-RUN.review.sql`:
   reviewed-only replacement for existing `queue_member_event_email`
   DB trigger. **Never apply it automatically.**
3. `netlify/functions/process-email-outbox.mjs`: a fail-closed delivery
   recheck, active only when explicitly configured with
   `DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED=enabled` **after**
   isolated staging validation. Before sending, it uses privileged
   server code to check the original source event, recipient's current
   confirmed Auth address, latest preferences and event-type eligibility.
   If the email changed or the member opted out, stale work is cancelled,
   not sent. Branded email buttons accept only
   `https://dominionstarld.com` URLs.
4. `assets/js/account-settings.js` and
   `account-settings/index.html`: display and explain verified
   priority email destination and choices.
5. `tests/priority-email-routing-review.test.mjs`: synthetic
   positive/negative checks. No actual email is dispatched.
6. `scripts/verify-isolated-agent-staging.mjs`: a read-only
   multi-member staging check that rejects the production project,
   requires two different synthetic approved members and only a
   publishable key. It tests profile privacy, directory RLS,
   notification preferences, inbox separation and verified Auth email.
   It performs no INSERT, UPDATE, DELETE, RPC queue claims, or sends.

## 2026-11-06: Delivery-worker fail-closed verification

A review audit caught a dangerous distinction between *routing disabled* and
*delivery disabled*: previously, the new strict worker's event-recipient
recheck was conditional, so the legacy queue could still be claimed and sent
when `DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED` was not set.

**Corrected:** `netlify/functions/process-email-outbox.mjs` now returns
HTTP 409 **before creating a Supabase client or claiming a queue batch** when
that flag is not exactly `enabled`. Once explicitly enabled after authorized
staging, *every* claimed row must pass the current verified Auth address,
source-event match, category whitelist and member preferences before any
provider call. Stale addresses and opted-out rows are cancelled. API/source
failures schedule retries without falsely recording success.

**Runtime tests:** `tests/priority-email-delivery-worker.test.mjs` invokes
the real handler with dependency-injected **fake Supabase and Resend**
services. It covers an unconfigured flag, missing/unauthorized callers,
approved deliveries, unverified and changed email destinations, global and
per-category opt-outs, invalid/unknown source event records, unavailable
auth/event/preferences services, provider errors and unsafe external CTA
links. All synthetic test recipients use `example.invalid`; no network
delivery or production data is involved. The separate privilege-gate test
checks that the default handler still uses the service-role Supabase client
and that caller authorization precedes the queue claim.

**Not yet verified:** a real delivery provider, actual Auth sessions,
Supabase RPC batching, retries after real external outages, bounces,
complaints and race conditions after an email provider accepts a send.
Do not turn on the flag or deploy these changes until staging approval.

## 2026-11-07: Stable provider identity and ambiguous-send guard

**Context:** Resend supports an idempotencyKey request option on Node SDK
emails.send(payload,options) and retains the key for **24 hours**. Repeating
a request with the same key and payload returns the original response;
different payloads with a reused key produce a 409 conflict.
Official source: https://resend.com/changelog/idempotency-keys

**Code gate (review branch, not deployed):**

- Every outbox send uses dominionstar/outbox/<outbox UUID> as a stable
  provider idempotency key. No new key is generated inside the retry loop.
- The worker refuses malformed outbox IDs before contacting Resend.
- A retry (attempts > 1) with no reliable created_at or queue age of
  **23 hours or more** is **not sent automatically**. It is marked failed
  for explicit manual reconciliation. Queue age is a conservative upper
  bound, not a precise first-attempt timestamp. This might suppress
  legitimate delayed retries; avoiding duplicates takes priority.
- If the provider accepted a send but the database cannot mark it as sent,
  or the provider responds without a message ID, the row is **never
  returned to pending**. It remains processing and the handler reports
  manual reconciliation needed. Operational tooling for stalled processing
  rows must be approved separately.
- Provider invalid_idempotent_request and invalid_idempotency_key errors
  are terminal cases. Other errors use bounded backoff and reuse the same
  provider key, subject to the conservative 23-hour cutoff.
- Existing controls remain mandatory: the explicit release flag, processor
  authentication, verified account email, source-event verification,
  recipient preferences, and official CTA domain.

**No-send verification:** tests/priority-email-delivery-worker.test.mjs
injects fake Supabase and Resend services to test same-key retries, expired
or missing timestamps, malformed IDs, provider conflict, provider accepted
+ database acknowledgement failure, and successful provider responses
without a message ID. CI runs this against the real handler; no external
email or database is used.

**Release blockers:**

1. Real nonproduction Supabase Auth/PostgREST integration and a controlled
   Resend canary sent solely to an approved fake/test recipient.
2. A persistent manual-reconciliation process and alerts for processing
   and ambiguous provider-acknowledgement rows.
3. Validate unchanged email payloads between retries. A 409 conflict
   must not be bypassed with a new idempotency key.
4. Consider a durable first-provider-attempt timestamp or delivery
   ledger instead of the conservative queue-creation cutoff.
5. Verify provider rate limits, bounces/complaints and outages beyond 24h.
6. Explicit approval for migration, flags, production deploy and rollback.

## Release gates

- [ ] A separate **nonproduction** Supabase project and test users
      actually exist. As of November 5, 2026, the connected Supabase
      account only exposes the production `DominionStar Platform` project.
- [ ] Review and audit the SQL draft in isolated staging first.
- [ ] Inventory actual event producers, actor identities,
      event priorities, and source-validation rules. Confirm that
      urgent Founder/admin events cannot be forged as regular member events.
- [ ] Test exact event-to-email decisions with two approved members,
      one pending account, an unverified email, and Founder authorization.
- [ ] Confirm all member preferences opt-out correctly, including
      **after** enqueue and **before** delivery.
- [ ] Confirm queue deduplication, retry/cancel status, Resend sender
      configuration, bounce/complaint handling and domain authorization.
- [ ] Confirm a changed email address cancels existing pending sends
      to the old address.
- [ ] Verify that standalone host-absent alerts remain rate-limited
      and do not send duplicate emails.
- [ ] Finish PR #198's independent P0 member profile and connection
      privacy authorizations before any production release.
- [ ] Explicitly approve migration, env flags, production deploy,
      rollback plan and canary send. Never use a real customer account
      for test sends.

**Actual status:** The current production queue and processor already
support verified email and preferences. The stricter selected-event
policy and delivery recheck are only code in draft PR #198, not live.
Production retains the existing broader event-category rules until
an authorized coordinated cutover.
