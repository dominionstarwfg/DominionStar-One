# Gate 0 — Messages Contact Privacy and Approval Contract

**Status:** review-only staging candidate, no production migration, no deployment,
no billable staging branch. All changes live under GitHub
`security/gate0-review-20261018`.

## Verified current behavior

- The Messages client previously selected `id`, name, Contract Level,
  `agent_code`, `smd_name`, approval status and avatar directly from
  `member_profiles` for **every approved agent**.
- It did not filter by `profile_visibility`: someone opting out of the
  *member directory* could still appear in the *Messages* contact picker.
- The client had a UI authorization gate (review branch only) and historically
  trusts the general direct-message INSERT RLS. The existing broad
  `member_profiles` directory SELECT policy remains exposed in production.
- The Messages panel showed agent code and supervising SMD name, even though
  these are not required for composing messages or viewing existing threads.
- The global incoming-call cache could request `openConversation` with
  a user ID before checking that the member existed in the approved roster.

## Branch-only code changes

1. `10_message_contacts_rpc_candidate.sql` (NOT APPLIED): a SECURITY DEFINER
   `list_message_contacts()` function that requires an **approved caller**,
   lists only other **approved agents**, and returns exactly six fields:
   `id`, `full_name`, `preferred_name`, `rank`, `avatar_path`,
   `verification_status`. It never returns agent code, SMD name, email,
   phone, address, account notes, privilege flags, or other sensitive fields.
2. `assets/js/direct-messages.js` (NOT DEPLOYED): replaces broad direct
   profile list with `client.rpc('list_message_contacts')`, fails closed if
   the RPC is unavailable, and verifies that linked/call-origin contacts
   appear in the returned roster before opening a conversation.
3. `direct-messages/index.html` (NOT DEPLOYED): removes Agent Code and SMD
   rows from the contact information panel. Contract Level and approved
   status remain. No new role labels replace the approved TA–SMD Contract
   Level taxonomy.
4. `tests/gate0-messaging-contacts-static.test.mjs` checks these source
   contracts without needing production or a Supabase staging project.

## Deliberate compatibility boundary — user decision required

**Candidate Phase A intentionally preserves current discovery:** every
approved member remains in the Messages list to every other approved
member even when `profile_visibility='private'`. This is not presented
as an improvement to *contact discoverability*, only as an improvement
to *data minimization* and authentication.

**Recommendation for a later reviewed Phase B:** align private-directory
privacy with contact discovery. Allow new contacts only if the member opted
into directory visibility, has accepted a connection, or has previously
messaged the requester. Preserve prior conversation history even if either
party later opts out. Blocked contacts must be prevented from starting
new calls/messages by **server-side** RLS/RPC, with a clear read-only
history state; do not silently destroy/hide historical conversations.

Phase B is **not implemented** and must be approved before any rule change.

## Critical server-side dependencies

- A roster RPC does NOT authorize a send; the database must enforce approved
  sender and recipient independently (Gate 0 proposal 04).
- Member connections can be `pending`, `accepted`, `declined`, `blocked`.
  Current UPDATE policies permit both parties to update broadly; this must be
  hardened before connection/block status becomes an authorization boundary.
- The current direct-message read policy allows Founder access to all DMs.
  Define explicit privacy governance before changing this behavior.
- The voice bucket still has broad authenticated Storage SELECT and the
  current client generates 30-day signed URLs. The media protocol v2 is
  **only a design**; it is not deployed.
- The old `profile approved directory read` policy remains permissive.
  Adding new minimal RPCs alone does NOT stop direct profile-table reads.
  Inventory and migrate other clients before removal.
- Approved agents need to continue receiving inbound messages, unread
  counts, presence, notifications, and call requests even when a contact
  discovery policy changes. Do not add visibility restrictions without
  specifically testing these flows and existing contact links.

## Required isolated testing before release

| Actor or condition | Expected result |
|---|---|
| Anonymous JWT | Cannot execute roster RPC |
| Pending, declined, suspended JWT | Empty roster/denied (and no DM UI) |
| Approved A, approved B | Each sees the other's safe profile projection |
| Approved A requests raw agent code via RPC | No such field in RPC schema |
| A attempts to query B's private base-table fields | DENY after old policy removal |
| Private-directory agent | Still appears in Phase A, by current behavior |
| Invalid `?member=<uuid>` or forged incoming call | Conversation does not open |
| Two approved agents, existing threads | Existing texts, read receipts, avatars, calls, and deep links still work |
| Stale/deleted/unapproved contact | No forced thread launch and no new send |
| Creator's agent code and SMD name | Not rendered in Messages contact card |
| Messaging roster RPC returns an error | Fail closed, no silent direct-table fallback |
| Blocked connection attempts new DM | Not yet secured: explicit server-side hardening required |
| Existing voice note | Needs separate Gate 0 storage remediation and playback test |

## Release gate

The GitHub review branch is **not deployable** until its proposed RPCs
are installed in a separately authorized synthetic staging database,
all dependent clients pass cross-role tests, the broad profile-table
policy is replaced, and the owner explicitly approves deployment.
No changes to Netlify build config, Supabase project, or main branch.
