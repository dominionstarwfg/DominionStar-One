# Gate 0 — Private Voice-Message Protocol v2 (Design for Approval)

**Status:** Security architecture proposal only — NOT implemented, migrated, applied, or deployed.
**Scope:** `direct-message-media` private bucket and `assets/js/direct-messages.js`.
**Branch:** `security/gate0-review-20261018`. No billable staging database exists.

## Current production facts (read-only metadata audit, 2026-10-18)

- The bucket `direct-message-media` exists and is private. It accepts audio
  MIME types and limits each upload to 15 MiB.
- `storage.objects` policy **dm media read authenticated** permits a
  `SELECT` for ANY authenticated user for every object in this bucket.
  A private bucket alone does not protect against a permissive RLS policy.
- The current client uploads to `<sender-uuid>/<timestamp>-<uuid>.<ext>`,
  creates a **30-day signed URL** immediately, then inserts a direct-message
  record whose body begins `[voice-note]` followed by that URL.
- The receiver renders the stored URL directly in an HTML audio player.
  Signed URLs are bearer links; already-issued URLs can work until their
  expiration even if a storage SELECT policy is narrowed.
- Metadata-only checks on 2026-10-18 found **0 `[voice-note]%` messages**
  in `public.direct_messages` and **0 objects** under
  `direct-message-media`. These counts can change without notice.
  **Repeat preflight inventory immediately before any real migration.**
- Other direct-message operations (SELECT and UPDATE permissions) need a
  separate RLS review. This design does not purport to fix those.

## Threats and objective

Authenticated but unrelated agent, pending/suspended member, or anyone
holding a stale shared signed URL must not gain ongoing access to private
voice recordings. Founder oversight of ordinary private DMs is **not**
silently assumed: require an explicit privacy-policy decision before
granting administrative content access.

## v2 protocol — reserve / upload / finalize / retrieve

1. **Reserve:** An approved agent requests a voice-note reservation for one
   approved recipient. A vetted server-side RPC generates an opaque UUID,
   unique object path, 5-minute reservation expiration, sender_id,
   recipient_id, and status `pending`. The caller cannot choose sender
   identity, another conversation's participants, or an arbitrary path.
2. **Upload:** Agent uploads the audio to the existing private bucket using
   the reserved object path. Storage INSERT policy requires exact match
   against a live reservation AND auth.uid()=sender_id, both parties
   approved, correct bucket, MIME and size constraints, and status pending.
   Public listings and overwrites remain unavailable.
3. **Finalize:** A transactional, authorization-checked RPC verifies the
   object exists, reservation is owned by the caller, recipient is still
   approved, and reservation is unexpired. It inserts the direct-message
   record and atomically marks the media `attached`, linked to its message.
   Persist only an opaque attachment reference such as
   `[voice-note:v2]<media-id>` in the message body — **never signed URLs**.
   Any error leaves the attempt pending and retryable without creating a
   false delivered message or an orphaned visible recording.
4. **Retrieve:** Client loads the message and requests a fresh short-lived
   playback URL **only when playback is initiated**. An approved sender or
   approved recipient may read a finalized media object, identified by a
   matching metadata row; unrelated agents must fail authorization.
   Target expiry: 60–300 seconds; avoid URLs in logs, notifications,
   chat exports, browser analytics, or long-lived application state.
   If file playback needs a new URL, request it again on demand.
5. **Cleanup/revocation:** Expired unfinalized reservations may be cleaned
   up by a verified trusted job with limited credentials and auditable
   actions. Revocation prevents new signed URLs, but already issued bearer
   URLs need an explicit response plan; a shorter expiry limits exposure.

## Draft data model (not runnable DDL)

`direct_message_media` with fields: `id uuid`, `bucket_id text`,
`object_name text unique`, `sender_id uuid`, `recipient_id uuid`,
`message_id uuid nullable unique`, `status (pending|attached|revoked)`,
`reservation_expires_at timestamptz`, `created_at`, `attached_at`.

Invariants (enforced by database, not just the browser):
- `bucket_id='direct-message-media'` and record maps to one object.
- One attached media item belongs to one immutable message and matching
  participant pair; other rows cannot claim that same storage path.
- `pending` objects are uploadable only by the approved reservation owner.
- `attached` objects are readable only by their approved participants.
- Metadata UPDATE/INSERT privileges cannot allow client-side spoofing.
- The policy explicitly separates Storage operations (upload, list,
  signed URL creation, download, update, delete).
- Revoke old blanket read policy **after** the v2 access mechanism passes
  end-to-end tests, then verify no other permissive policies OR together
  to re-expose the bucket.

## Live-rollout compatibility requirements

There are zero voice notes and zero stored voice files *at audit time*,
but any future voice notes created before cutover use the old URL-bearing
format. Immediately before rollout:
1. Re-run `05_voice_media_readonly_inventory.sql` and snapshot policies.
2. If either count is nonzero, STOP automatic rollout: resolve every old
   message/object association and identify active 30-day URLs; do not
   discard recordings or force-convert URL text through guesses.
3. Add an explicit approved legacy-playback path if required, with
   participant-scoped authorization and bounded lifetimes.
4. Dual-read `[voice-note]` and `[voice-note:v2]` only while migration
   and testing need it; new writes must use v2.
5. Stage a controlled cutover and tested forward recovery; do not re-open
   the broad bucket policy as a rollback shortcut.
6. **Do not change production until the user explicitly approves it.**

## Acceptance tests in genuine isolated staging (synthetic accounts)

| Actor and action | Expected |
|---|---|
| Approved A sends note to approved B | Uploaded, attached once, B can play |
| Approved B signs/plays attached A-to-B note | Allowed |
| Approved C signs/plays unrelated A-to-B note | Denied |
| Pending P or suspended S lists, signs or downloads note | Denied |
| Anonymous browser retrieves audio through Storage API | Denied |
| Forged sender, recipient, message ID or reservation | Denied |
| Approved A tries to read A-to-B pending upload as B | Denied until attached |
| Recipient approval is revoked before finalization | Finalize denied safely |
| Lost network between upload and finalize | Retry or cleanup; no leaked link |
| Expired/revoked reservation | Upload/finalize denied |
| 15 MiB or MIME invalid audio | Rejected without creating message |
| After logout/session expiry | No new links; already signed links expire |
| Two devices, 1×/1.5×/2× playback, history reload | Works, without duplicate send |
| Former legacy recordings, if any appear by rollout | Remain recoverable securely |
| Founder access without being participant | Defined explicitly before rollout |

## Separation of duties / release gates

- No service_role token in client JS, static HTML, or GitHub files.
- Candidate SQL belongs outside `supabase/migrations/` until staging passes.
- RLS policy and RPC changes must be reviewed **together with the client**.
- Existing agent accounts, conversations, contact permissions, and
  Founder privileges must not be silently modified.
- Full staging database setup remains on hold at the user's request.

### Official reference
Supabase Storage access control:
https://supabase.com/docs/guides/storage/security/access-control

Supabase private bucket and signed-URL behavior:
https://supabase.com/docs/guides/storage/buckets/fundamentals
