# DominionStar One — Disposable Priority Email SQL Integration Evidence

**Date:** November 6, 2026  
**Status:** PASSED in disposable PostgreSQL 16 with synthetic accounts and
events. **Not Supabase staging, not production, and no email sent.**

[GitHub verification run — disposable priority email SQL](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/42275523107)

## What actually executed

A GitHub Actions `postgres:16` service created a temporary local database,
`synthetic_priority_emails`, at `127.0.0.1`. No production credentials,
Resend API key, member data, or actual email addresses were used.

The job executed:

1. `tests/sql/community-notifications-fixture.sql` — fake approved,
   unapproved and private member records, RLS and `auth.uid()` identities.
2. `tests/sql/priority-email-fixture.sql` — fake confirmed/unconfirmed Auth
   addresses, member email preferences, direct-message and missed-call
   source rows, plus the existing trigger signature and dedupe index.
3. `scripts/security/community-notifications-from-source.DO-NOT-RUN.review.sql`
   — actual SQL compilation and synthetic Community source notification
   trigger initialization, **within the disposable CI database only**.
4. `scripts/security/priority-member-email-routing.DO-NOT-RUN.review.sql`
   — actual replacement trigger SQL and permission preflight, **within the
   disposable CI database only**.
5. `tests/sql/priority-email-assertions.sql` — synthetic event insertion
   and real PostgreSQL outbox inspection.

**Recorded pass markers**

- `PRIORITY_EMAIL_SYNTHETIC_FIXTURE_PASS`
- `PRIORITY_EMAIL_POSTGRES_INTEGRATION_PASS`
- `DISPOSABLE_PRIORITY_EMAIL_NO_SUPABASE_NO_SEND_PASS`

## Confirmed positive cases

- Verified account on file receives a queued official `account.approved`
  notification when selected emails are enabled.
- Verified eligible member receives `appointment.confirmed` via the
  synthetic email queue.
- Recognized official Founder urgent notices and important Founder
  announcements pass Founder identity/priority validation.
- A direct message is queued only when its saved message has the matching
  sender/recipient and the member opted into messages.
- A real missed-call event validates its saved call record and the member's
  message email preference.
- Real `@mention` events created from a saved Community post can queue
  only when Community email is enabled.
- A reply to an existing Community post can queue one source-verified
  `community.reply` event with the same explicit opt-in.
- Replayed event IDs cannot create duplicate outbox entries.

## Confirmed negative cases

- Self-authored fake account/security and forged Founder notices do not
  queue emails, even when marked critical.
- Routine Likes, general posts, and unrecognized events cannot email.
- Routine Founder announcements do not email unless explicitly elevated.
- Unconfirmed Supabase Auth addresses and globally opted-out recipients
  do not appear in the outbox.
- Individual category opt-outs suppress appointments, messages and
  Community mentions even when another category is permitted.
- A fake direct-message actor, nonexistent Community source, or mismatched
  recipient cannot produce a queued event.
- Ordinary authenticated clients cannot read the privileged email outbox
  or directly execute its internal trigger function.

## What still requires authorization

- The worker's **pre-send** recheck was already covered by JavaScript
  contract tests. This PostgreSQL run does not call Resend, simulate bounce
  feedback, or prove a delivered email was received.
- The worker's cutover flag
  `DOMINIONSTAR_PRIORITY_EMAIL_ROUTING_ENABLED=enabled` remains **off**.
  Do not enable it before the corresponding database trigger is deployed
  and real Supabase authorization is tested.
- The disposable fixture tests actual PostgreSQL behavior, but does not
  reproduce the complete Supabase Auth, JWT, PostgREST, Storage or Netlify
  production runtime.
- The live platform's earlier broad-category email trigger has **not**
  been replaced. All migration SQL retains `DO-NOT-RUN.review.sql` in its
  path and has never been executed against the connected project.
- Actual official event emitters and their server origin must still be
  inventoried, and an isolated nonproduction Supabase project with synthetic
  accounts must be authorized before staging any real cutover.
- The P0 member privacy, direct message, Founder access and historical
  reaction archive requirements remain independent release gates.

**Release result:** Priority email SQL is now disposable-database-validated
but is **not authorized for production**. No emails were dispatched and
DominionStar Meet was not changed.
