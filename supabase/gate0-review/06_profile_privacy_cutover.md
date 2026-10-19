# Gate 0 — Approved-Member Directory Privacy Cutover

**Status:** Review-only integration plan. No database migrations applied. No
Netlify deployment, billable staging instance, or production change.

## Audit finding

Live `public.member_profiles` has three permissive SELECT RLS policies:
- `profile own read`: current signed-in member's row;
- `profile founder read`: Founder access;
- `profile approved directory read`: *any authenticated user* may read
  rows whose `profile_visibility='members'` and status is `approved`.

The third policy does not test whether the **requester** is approved.
Because full-table SELECT grants are currently given to `authenticated`,
an approved person's profile record (including contact/address fields,
agent_code, email, account_notes and privileged metadata) may be returned
to unauthorized requesters by asking for columns explicitly, even if the
visual directory hides the fields. RLS restricts **rows, not columns**.

## Proposed restricted directory contract

`public.list_directory_members()` returns exactly:
`id`, `full_name`, `preferred_name`, `rank`, `city`,
`state`, `avatar_path`, `exclusive_member_number`.

Rules:
- Require `auth.uid()` belonging to an approved agent;
- only return other profiles marked `members` and status `approved`;
- do not expose email, agent code, address, phone, SMD contact information,
  account notes, `is_founder` flags or arbitrary `SELECT *` columns;
- keep Contract Level (`rank`) labels TA, Associate, SA, MD and SMD;
- clients must show an error instead of falling back to insecure direct reads.

### Implementation inventory (not exhaustive)

| Component | Profile access observed | Migration strategy |
|---|---|---|
| `assets/js/member-directory.js` | Approved-member list with agent code | **Branch-only** switch staged to `list_directory_members()`; agent code removed from search |
| `assets/js/direct-messages.js` | Approved members list, including agent code/SMD name | Migrate to minimal RPC; display private fields as hidden, not blank mistaken as errors |
| `assets/js/community-hub.js` | Resolve poster identities | Use batch-safe approved identities only; preserve avatar and recognition |
| `assets/js/member-dashboard.js` | Reads own profile | Preserve own-row access; founder role display requires separate security review |
| `assets/js/professional-profile.js` | Own profile `SELECT *` | Preserve own-row RLS; narrow projected fields later |
| `assets/js/founder-admin.js` | Founder reads approval and audit fields | Keep Founder-controlled read with audited immutable identity |
| `assets/js/member-directory.js` presence | Global community presence read | Stage approved-member presence restriction separately |
| Other community, Academy, Meet, notifications and workspace modules | May join other profiles | **Inventory all consumers before cutover** |

## Sequence — no production application now

1. On a genuinely isolated synthetic staging database, baseline RLS and
   table/function grants using the read-only Gate 0 checks.
2. Apply `06_member_directory_rpc_candidate.sql` to staging only.
3. Test anonymous, pending, suspended and declined JWTs return no directory
   data; approved agents receive only the eight safe fields.
4. Deploy and test branch-only directory client against the new staging RPC.
5. Inventory and migrate **every** other non-owner `member_profiles` reader.
   Preserve profile editing, Founder approvals, avatar URLs, current Meet
   participants and network/messaging features.
6. **Only after migration**, remove the permissive direct-table directory
   SELECT policy. Preserve `profile own read` and the verified Founder
   policy. Reassess privileged table grants/column-level access: mass-revoking
   SELECT before replacing owner/Founder use cases would break the platform.
7. Negative-test direct REST queries for `email`, `phone`, `agent_code`,
   `account_notes`, `address_line1`, `is_founder` when targeting another
   approved member: all must be rejected/hidden for ordinary agents.
8. Verify Founder-approved/still-approved users, pending/declined/suspended,
   two-account messaging, directory privacy opt-out, recognition and
   visibility changes under rapid refresh and across devices.
9. Only then plan a reviewed production release with protected member data,
   verified backup and explicit release approval.

## Why adding only a directory RPC is NOT sufficient

Until the old `profile approved directory read` policy is replaced, a
malicious client can bypass the new RPC and query `member_profiles`
directly. Moving `member-directory.js` to an RPC is a necessary client
migration step, not a privacy fix by itself. Gate 0 is still open.

## Existing member records

No rows are to be deleted or rewritten during this migration. Existing
`profile_visibility='private'` choices must remain effective. The default
recipient of private data should be the owner and explicitly authorized
administrators, not every registered agent.

## Release decision

No billable staging environment is authorized. No policies or database
functions have been modified. The GitHub review branch must not merge or
deploy before isolated account-level tests pass.
