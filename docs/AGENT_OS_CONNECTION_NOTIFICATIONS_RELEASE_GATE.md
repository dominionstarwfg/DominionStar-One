# DominionStar One — Member Connection Notifications Release Gate

**Status: DRAFT / NOT LIVE.** This is the Agent OS website, not DominionStar
Meet. No production SQL, real account records, real email or real web-push
subscription is touched by this review change.

## Verified production baseline (read-only catalog)

- `member_connections` has member IDs, a status, timestamps, participant
  SELECT RLS, and an overly permissive legacy UPDATE policy. The prepared
  `member-connection-integrity.DO-NOT-RUN.review.sql` hardens transitions.
- `executive_events` is the modern Agent OS notification inbox. Its
  owner-only SELECT policy prevents other members reading recipient alerts.
- **No `member_connections` event trigger** existed at the inspected
  baseline. Thus an Accept/Request screen alone cannot notify another member.
- Existing `queue_member_event_email` and `queue_member_event_push`
  functions verify only specific older cross-member sources. New connection
  events with nonnull `actor_id` are intentionally rejected by those outbox
  functions. **Do not null `actor_id` to bypass source verification.**

## Draft implementation

1. `scripts/security/member-connection-notifications.DO-NOT-RUN.review.sql`
   creates a trigger-only SECURITY DEFINER function in an unexposed schema
   with no browser EXECUTE grants, an idempotency index, and a source-table
   trigger. All schema changes remain unexecuted on connected Supabase.
2. A newly inserted **pending** invitation from an approved member to an
   approved, directory-visible member generates exactly one
   `connection.request` event for the recipient.
3. An actual `pending → accepted` transition generates exactly one
   `connection.accepted` event for the requester. Declines are silent;
   repeat updates and preaccepted inserts do not produce alerts.
4. The payload includes only `connection_id`, `source_type` and the local
   `/member-directory/` action path. It does **not** embed another agent's
   name, private profile, Agent Code, phone or email. The source actor is
   preserved for auditing.
5. These events have `normal` priority; no connection email or web-push
   dispatch is authorized by this change. In-app realtime sound and toast
   are handled by the existing preference-aware `CommunicationEngine`.
6. `assets/js/notifications-center.js` now recognizes a dedicated
   **Connections** filter/icon. It also checks Founder approval before
   reading the inbox, treats audio initialization as optional, reports
   mark-read errors rather than displaying false success, and opens safe
   same-origin links even when the audio engine is unavailable.

## Synthetic verification

- `tests/sql/member-connection-notifications-assertions.sql` executes
  against the throwaway PostgreSQL 16 CI service, after the projection and
  connection-security migration. It checks recipient RLS, source-generated
  request/acceptance events, replay prevention, private/pending/preaccepted
  suppression, and inaccessible trigger EXECUTE grants.
- `tests/notification-center-connection-review.test.mjs` exercises the
  browser Notifications view using synthetic sessions and events: pending
  approval, failed session, optional audio failures, read-state success and
  failure, and same-origin link fallback.

## Release dependencies — ALL required

- [ ] Isolated Supabase Auth + PostgREST staging environment available, with
      no production credentials, real members or billable branch created
      without separate authorization.
- [ ] Prepare `member_public_profiles`; validate opt-outs and RLS, then
      enforce private `member_profiles` read restrictions.
- [ ] Apply and test `member-connection-integrity` scoped RPC migration.
- [ ] Apply this notification trigger **after** both requirements; test
      approved A → B, acceptance, decline, cancellation and stale links.
- [ ] Confirm direct HTTP requests cannot see another recipient's events
      or insert arbitrary cross-member notifications.
- [ ] Verify the existing email/push outbox triggers do not create
      connection email or background push jobs without separate policy.
- [ ] Verify UI filters, focus, mobile layout and audio preferences with
      real synthetic authenticated users.
- [ ] Obtain explicit production cutover approval with rollback owner and
      monitoring; then coordinate database and website release together.

**Do not deploy PR #198's frontend on its own.** Its privacy feature flag
remains disabled. GitHub review success is not proof of live delivery.
