# Gate 0 — Direct Messages and Connection Integrity Cutover

**Status:** review branch only, untested database candidates. No database or website
deployment and no billable staging resources authorized. The following is
a coordinated **proposal** to be run only after isolated synthetic testing.

## Production findings (read-only on 2026-10-18)

1. `direct_messages` SELECT policy permits sender, recipient or Founder
   to see message rows. Whether the Founder should read private messages
   is a **privacy/governance decision**, not automatically changed here.
2. `direct_messages` UPDATE policy permits sender/recipient/Founder to
   UPDATE an RLS-visible row, but does not restrict which columns may be
   changed. Authenticated table UPDATE privileges are broad; integrity of
   `sender_id`, `recipient_id`, `body`, `read_at`,
   `is_deleted`, and timestamps requires server-controlled paths.
3. `member_connections` UPDATE similarly permits either endpoint to
   modify a row without enforcing a status transition or immutability
   of endpoints; its INSERT only checks requester_id=auth.uid().
4. `direct_messages` has no non-internal update trigger that enforces
   immutable participants; `member_connections` has no such trigger.
5. PostgreSQL metadata reports unneeded-looking grants including
   `TRUNCATE`, `TRIGGER`, `REFERENCES`, and `DELETE` to browser roles.
   RLS is not a TRUNCATE defense. Separate dependency review and revoke
   recommendations are required before any production release.
6. Client **incoming missed-call logging** was attempting to INSERT a
   message using the *other person's* ID as sender. That conflicts
   with safe INSERT RLS and would be identity spoofing if permitted.
7. The client uses direct row UPDATE for read receipts, message editing,
   and soft-deletion; server-side replacement functions are necessary
   before table UPDATE can be revoked.

## Proposed staged database changes

- `11_dm_integrity_rpc_candidate.sql`: approved-user-only functions
  `dm_mark_read(sender_id)`, `dm_edit_own_message(message_id,body)`,
  `dm_soft_delete_own_message(message_id)`. Message authorship,
  destination and creation time cannot be changed through the functions.
  Revoke direct table UPDATE for anon/authenticated.
- `12_connection_state_integrity_candidate.sql`: connection INSERT
  restricted to a pending request between approved members. A new
  `respond_member_connection(id,status)` lets recipient accept or
  decline pending requests and either participant block. Prevent
  arbitrary update of connection endpoints or statuses via direct table UPDATE.
- `13_dm_blocked_send_guard_candidate.sql`: redefines message INSERT
  policy to require approved sender and recipient and deny new sends when
  a blocked relationship exists in *either* direction. Preserve old
  message READ access until separate history/privacy decision.
- `14_dm_integrity_readonly_checks.sql`: metadata-only inventory to
  baseline RLS, ACLs, triggers and function exposure; never reads
  actual message contents or user identities.

**Migration order matters:** First ensure sender/recipient approval checks
(`04_`), then test narrow RPCs (`11_`), connection authorization
(`12_`), blocked send guard (`13_`), and only release client code
with all RPCs functioning together. All candidate SQL files are outside
the automatic migrations directory and have **not** been executed.

## Branch-only JavaScript change

`assets/js/direct-messages.js` now proposes calling the three DMs RPCs
instead of direct table UPDATE. It also no longer persists incoming
missed calls as messages deceptively authored by the other person.
The local missed-call toast and executive notification still occur;
a proper server-authenticated call-history record is a **follow-up
integration gap** so old incoming missed calls do not silently disappear
from history if the application expected them there. Outgoing missed
call message logging remains attributed to the logged-in author.

## Known gaps / not yet fixed

- Adding a blocked-send check does not automatically stop Realtime
  notification subscriptions, incoming call signaling or existing
  stored-media links. All those pathways require separate enforcement.
- UI-only denial of an unknown contact does not secure the API.
- Arbitrary `body` INSERT still permits forged prefixed
  `[voice-note]`, `[attachment]`, `[call-event]` payloads.
  Typed, authorized attachment and call event creation needs the
  voice-media v2/call-log design; prevent expanding metadata trust.
- The current `member_connections` schema can have opposing-direction
  rows; blocking must be checked across BOTH orientations.
- User-initiated unblocking and cancelling/reopening declined requests
  are not represented in the candidate state machine. Do not invent
  those transitions without product approval.
- Privilege recheck must include inherited grants, RLS SELECT, and service
  roles. Revoke unnecessary `TRUNCATE`, `TRIGGER`,
  `REFERENCES` and direct hard `DELETE` in a separate tested migration.
- Founder-wide DM SELECT and the email-based Founder identity check
  remain unchanged. Define privacy limits before modifying these.
- The old `member_profiles` SELECT exposure and broad
  `direct-message-media` Storage policy remain unresolved on production.

## Required synthetic staging security tests

| Test | Expected |
|---|---|
| A sends B, B reads | Only B can mark messages addressed to B read |
| A edits A's message | Allowed, with body length and type restrictions |
| B edits A's message | Denied/no change |
| A/B tries UPDATE REST sender_id/recipient_id | Denied |
| A/B tries UPDATE REST read_at/body/is_deleted | Denied |
| A deletes A's own message | Soft delete succeeds, others can't edit |
| A edits voice/attachment/call-event into raw text | Denied |
| Pending/suspended/anon executes read/edit/delete RPC | Denied |
| A requests B connection | Creates only pending |
| A creates pre-accepted or blocked connection | Denied |
| B accepts/declines pending A request | Allowed |
| A accepts their own outgoing request | Denied |
| A or B blocks relationship | Changes only status of existing pair |
| A sends B after A or B blocks | Denied in either direction |
| Old A/B messages after block | Preserved according to later history policy |
| Third-party C changes A/B statuses | Denied |
| Incoming missed call | Local notification works; no forged sender row |
| Two-device message/receipt/reload | No duplicate messages, callbacks, or races |
| Founder access | Preserved as-is until explicitly governed |

**No test in this file has run.** Existing syntax/source checks do not
prove real JWT authorization, SQL execution, Realtime or call UX.

## Next release gate

Proceed only when an isolated staging database and synthetic agents
are approved, the complete policy/function/client rollout can be tested
atomically, and the product owner explicitly authorizes release.
Until then, do not merge the branch or deploy any changes.
