# DominionStar One — P0 Agent OS privacy and connection release gate

**Status: REVIEW ONLY — production changes prohibited.**  
Date: 2026-11-04  
Scope: Agent One website, signed-in Members, Founder authorization. **Not DominionStar Meet.**

## 2026-11-09 Member connections integration (review branch only)

A read-only catalog check verified the existing `member_connections` table
has `requester_id`, `recipient_id`, `status`, and a signed-in participant
SELECT policy, but its existing browser UPDATE policy is still too broad.
The candidate migration `member-connection-integrity.DO-NOT-RUN.review.sql`
continues to be the server-side authority; it has **not** been deployed.

**Reciprocal invitation integrity:** The existing database uniqueness constraint
only compares `requester_id,recipient_id` in that order, allowing A→B and B→A
rows to coexist. The review-only migration now adds an unordered pair index
based on `LEAST/GREATEST`, with a preflight that **stops** rather than
silently destroying or merging any older reciprocal duplicates. Disposable
PostgreSQL tests assert that an approved member cannot create a reverse
request while an existing connection is present. An authorized staging review
must decide how any pre-existing duplicate pairs are reconciled before cutover.

Review-branch `member-directory.js` now displays a compact request inbox,
reads only rows involving the signed-in member, differentiates outgoing
pending / incoming pending / accepted / declined relationships, and uses the
prepared scoped `respond_my_member_connection` and
`cancel_my_member_connection` RPCs for accept, decline and cancel.
It does not send direct browser UPDATE/DELETE. Failed connection SELECTs
disable sending new invitations until refreshed. The inbox resolves names
only through `member_public_profiles`; a hidden requester stays labeled
"Member" rather than retrieving private contact records.

Automated synthetic tests:
`tests/member-connection-inbox-review.test.mjs` for pending, accept,
decline, cancel, denied SELECT/RPC, hidden members and disabled feature flag;
`tests/agent-directory-interaction-repair.test.mjs` for initial pending-only
requests and retry behavior. These are part of the P0 review CI.

**Not live:** The safe-profile flag is still OFF; a staging database with
the projection preparation and connection-integrity RPC migration must be
available before these controls can be used. Verify real Auth + RLS with two
approved accounts, a pending member and an opted-out member. No production
SQL or frontend release is authorized by passing synthetic CI.

## 2026-11-08 Additional peer-profile consumer audit

A review of the browser consumers found two unguarded privacy paths that
had not been included in the earlier coordinated feature-flag plan:

- The legacy **Team Directory** (`assets/js/team-directory.js`) fetched
  another member's complete professional-profile columns directly from
  `member_profiles`, including biography, team and social URL fields
  which are not approved for the safe projection. It is now **fail-closed**
  until `publicMemberProfilesV2===true`, and then reads only
  `member_public_profiles` fields: ID, approved display name, rank,
  founding badge, city/state and avatar. Optional social links are not
  loaded or displayed; profiles link to the existing read-only route.
- The shared `DSData.fetchProfiles` helper in
  `assets/js/data-layer.js` previously defaulted to a bulk
  `member_profiles` query asking for email and Agent Code. It now
  returns no member identity when the coordinated flag is disabled;
  when enabled it reads only `member_public_profiles` with a strict
  allowlist of projection fields and explicitly refuses private columns.
  `DSData.fetchByIds` cannot target raw `member_profiles`.
  Community typing names consequently fall back to generic member names
  during the private-projection preparation gate rather than exposing
  private records.
- The Founder-only `/member-profile/` page now validates the
  member UUID before loading and selects only displayed Founder fields,
  not the entire private profile row. Founder authorization and RLS
  remain mandatory and server-authoritative.
- All relevant HTML pages referencing the shared data helper were
  cache-busted in one atomic review commit to avoid mixed old/new
  profile consumers after the coordinated release.

**Regression evidence:** `tests/member-peer-profile-consumers-review.test.mjs`
is part of the Agent OS P0 privacy and full Node regression workflows.
It tests disabled flag/zero peer queries, enabled safe projection,
requested sensitive-field rejection, official SQL schema parity,
Team Directory safe fields and the narrowed Founder-only query.

**Staging gate still required:** Before any production merge, enable
the public projection flag only on a **nonproduction Supabase instance**
where the preparation migration exists and has been negative-tested as
anon, pending, approved member and Founder. Confirm the Team Directory
loads visible profiles and rejects private members, the shared helper
renders names without confidential fields, avatar URLs remain authorized,
and Member Directory/Direct Messages/Community Chat still work. Flag
activation before this stage intentionally blocks the legacy Team
Directory and degrades typing names to a generic label.

**Not production:** All changes are review-branch only. The flag is
still false. No Supabase SQL, billable staging branch, live site update
or Meet change occurred.

## 2026-11-08 Cross-surface peer identity fallback removal

**Newly discovered rollout hazard:** Several approved Agent pages retained
a private `member_profiles` fallback when
`publicMemberProfilesV2` was false. That undermines privacy
minimization even before final P0 RLS enforcement. A legacy Group Chats
recipient picker also selected other members directly from the raw table.

**Review-only corrections in PR #198:**

- `member-directory.js`: all peer listings use only
  `member_public_profiles` and its fixed public field list. Until the
  feature flag and table are available, this page clearly reports that
  the directory is temporarily unavailable. It never searches Agent Codes
  or fetches private profiles.
- `professional-profile.js`: read-only peer profile view fails closed
  when the safe projection is disabled. Own editable profile and Founder
  administrative profile still use their authorized records.
- `direct-messages.js`: peer roster selects only public-safe member
  identity fields. The messaging page fails closed before loading the
  peer roster when the flag is disabled. **This is intentional but
  user-visible** and requires coordinated activation, not a UI-only merge.
- `community-hub.js` and `community-chat.js`: when the projection is
  disabled, optional peer-author lookups return an empty map rather than
  querying private member records. Post/chat content can use a neutral
  identity placeholder until the real approved projection exists.
- `global-call-manager.js`: incoming-call display uses the safe
  projection when enabled, otherwise a neutral caller name without
  fetching private peer identity. Call cancellation/ringtone timing
  tests were updated to exercise the safe profile path.
- `group-chats.js`: legacy group creation target picker uses the
  public projection only, with an approved-member check. The page
  fails closed rather than allowing invites based on private profile
  lookup when the coordinated feature flag is disabled.
- `team-directory.js` and `data-layer.js` were already fail-closed
  and were retained.

**Review automation:** `tests/member-peer-identity-no-private-fallback.test.mjs`
enforces the public-only contract across eight peer-facing modules.
The existing privacy, cinematic and incoming-call race tests have been
updated to reject the old sensitive-profile fallback and retain
call-lifecycle coverage. The P0 CI explicitly runs these tests.

**Explicit staging / release requirements:** Because the server-owned
`member_public_profiles` projection is not yet deployed and
`publicMemberProfilesV2` remains false, affected peer-facing views
intentionally display an unavailable state in this branch.
**Do not deploy the frontend alone.** In isolated Supabase staging,
first apply public projection preparation and verify RLS, Auth and
Data API; then enable the frontend flag only in that environment and
exercise Member Directory, Messaging, Group Chats, Professional Profiles,
Feed/Chat author lookup and incoming calls with two approved accounts,
an opted-out account and a pending member. Only after full consumer
verification may final private-profile RLS enforcement and production
deployment be considered together.

**Not a complete P0 security fix:** The broad production RLS SELECT policy
and the actual database remain unchanged. The user-facing flag is
not a security boundary; final authorization lives in PostgreSQL.

## Verified findings (catalog inspection; no member data inspected)

1. `public.member_profiles` is used both for public directory identity and private
   account fields (email, phone, mailing address, account notes).
2. The row policy `profile approved directory read` allows any authenticated
   user to see rows where `profile_visibility='members'` and
   `verification_status='approved'`. The default visibility is `members`.
   Authenticated users currently have table-wide SELECT. **RLS is row-granular,
   not column-granular.** A read-only professional-profile page is NOT a data
   authorization boundary.
3. `member_connections` currently permits signed-in requesters to INSERT
   rows using the `requester_id=auth.uid()` predicate without forcing
   `status='pending'`. The existing UPDATE policy allows either requester or
   recipient to update the record without limiting editable columns.
4. Direct-message SELECT policy includes a Founder exception beyond sender and
   recipient. This may be deliberate, but needs a signed-off privacy policy and
   role-based access tests.
5. Connected Supabase advisor reports privileged function exposure, RLS policy
   performance, and index advisories. These are audit inputs, not proof of exploit.
   Do not blindly revoke all functions: inspect each caller and internal auth check.

## Intended authorization boundaries

| Data / action | Pending member | Approved member | Founder |
| --- | --- | --- | --- |
| Public approved-member directory identity | Deny | Allowed within profile visibility | Allowed |
| Other members' email/phone/address/account notes | Deny | Deny | Allow only if approved organizational need |
| Own contact information | Own only after authenticated onboarding | Own only | Own + scoped administration |
| Send a connection request | Deny | Allowed, only as pending | Same unless acting under documented admin workflow |
| Accept/decline invitation | Deny | Recipient only, pending -> accepted/declined | Not by default |
| Cancel sent pending invitation | Deny | Requester only | Not by default |
| Other members' direct messages | Deny | Deny unless sender or recipient | **Decision required:** no access by default unless explicit legal/compliance purpose and logging |
| Recognized rank and verified organization info | Deny except self | Approved directory subset | Authorized management |

## Technical sequencing — never apply out of order

**A. Privacy data separation (blocking).**

- Create an explicitly public-safe member-directory representation containing only
  id, chosen display name, contract level, approved badge, optional city/state,
  photo reference, and verified founding recognition. Avoid internal account notes,
  direct contact data, full postal addresses, private identifiers and any user
  configured hidden fields.
- Because a `security_invoker` view alone does NOT hide the original base table,
  design a separate RLS-protected private table for personal contact and
  administrative notes. Migrate frontend reads/writes for own-profile and Founder
  operations to narrow, authenticated accessors.
- Backfill and audit **in isolated staging**. Only after all current caller
  dependencies are migrated, revoke broad authenticated SELECT on the original
  member profile table (or drop private columns from it as part of an approved
  atomic migration). Verify the raw REST API cannot retrieve another member's
  email/phone/address/notes.
- Do not attempt a quick deny-by-frontend CSS change, and do not add a directory
  view while retaining the leaky table grants and call that a security fix.

**B. Connection request integrity (draft prepared).**

- Review `scripts/security/member-connection-integrity.DO-NOT-RUN.review.sql`
  in isolated staging after explicitly authorizing SQL test deployment.
- It forces initial connection status to `pending`, removes broad browser
  UPDATE/DELETE access, and adds narrow recipient-response/requester-cancel RPCs.
- The Member Directory inbox and connection-status actions are now wired in
  PR #198 **for review only**; real authenticated staging acceptance is still
  required before release. Notification fanout and block/mute semantics need
  separate server authorization and signed-off behavior.
- Ensure a recipient cannot approve a request they sent, a requester cannot
  self-approve, and neither side can mutate connection identities or timestamps.

**C. Direct Message / Founder visibility decision.**

- Confirm whether Founder access to all member-to-member messages is intended.
  Record rationale, access disclosure, audit log and retention policy. Prefer
  participant-only access and narrowly scoped, logged administrative exceptions.
- Apply a tested backend change only after checking moderation/support use cases.

## Release gates

- [ ] Isolated staging database and accounts available; never test on member data.
- [ ] Private fields unreadable from member-to-member REST/select requests.
- [ ] Own Profile and Founder Admin CRUD still work under the new authorization model.
- [ ] Pending / approved / revoked member negative authorization cases pass.
- [ ] Connection transitions and role-state spoofing tests pass.
- [ ] Member directory avatars, messaging shortcuts and status labels still render.
- [ ] Existing RLS, storage, trigger and SECURITY DEFINER callers checked; no
      anonymous or excessive privileged access introduced.
- [ ] Browser interaction and mobile smoke tests completed with staging accounts.
- [ ] Rollback and deployment owner documented; release explicitly approved.
- [ ] Only then consider production SQL + website deployment with monitoring.

## Review artifacts

- Read-only catalog inspection:
  `scripts/security/agent-os-privacy-baseline.READ-ONLY.review.sql`
- Non-executed connection remediation candidate:
  `scripts/security/member-connection-integrity.DO-NOT-RUN.review.sql`
- Static regression tests:
  `tests/agent-os-p0-privacy-review.test.mjs`

## References

- Supabase guidance: https://supabase.com/docs/guides/database/postgres/column-level-security
- RLS security invoker views: https://supabase.com/docs/guides/database/postgres/row-level-security

**This document does not certify production security. No production SQL has
been executed, no user records examined, and no production merge performed.**


## Phase A / Phase B / Phase C coordinated implementation (2026-11-04)

The review branch now contains an **opt-in** browser route and two separate
**DO NOT RUN** SQL candidates. This is a preparatory design; they have not
been executed in any database.

- **Phase A (prepare staging database)**:
  `scripts/security/member-public-projection-prepare.DO-NOT-RUN.review.sql`
  creates `public.member_public_profiles` with only approved, opted-in,
  public-safe identity fields. An `AFTER INSERT OR UPDATE` trigger keeps
  the projection synchronized. It also provides an authenticated
  `set_my_member_directory_visibility` RPC to persist the member's real
  `profile_visibility` setting. Feed and Community Chat RPC author identity
  resolve through this safe projection after preparation.
- **Phase B (switch clients in isolated staging)**:
  `window.DOMINIONSTAR_AGENT_DATA_FEATURES.publicMemberProfilesV2`
  remains **false** by default. During a separately approved, coordinated
  test release, switch it to true *only after* Phase A is validated. When
  enabled, Member Directory, Messages peer identity, Community peer
  profiles, Community Chat lookups, and incoming-call identity use
  `member_public_profiles` and deliberately do not fall back to raw
  `member_profiles`. Own Profile and Founder Admin continue using
  `member_profiles` because their RLS policies authorize own/Founder reads.
  The Settings directory toggle reads `profile_visibility` from the server
  and writes the server-verified RPC, rather than relying on mutable Auth
  metadata as a privacy enforcement mechanism.
- **Phase C (enforce after live client verification)**:
  `scripts/security/member-public-projection-enforce.DO-NOT-RUN.review.sql`
  removes the unsafe approved-directory SELECT policy on
  `member_profiles` after explicit backend + frontend testing and approval.
  The remaining owner and Founder SELECT policies keep their access.

### Legacy member opt-out preservation

The preparation candidate explicitly imports `directoryVisible=false` from the
previous metadata-only Settings preference into the server-owned
`profile_visibility='private'` value **before** the safe projection
is backfilled. This migration only restricts visibility; it never treats
user-controlled metadata as a reason to grant access. A separate staging
verification must prove every previous opt-out remains hidden.

### Additional blockers before any production cutover

1. **PR dependency**: PR #196 independently changes Member Directory, Messages,
   Community, and the read-only cross-member Professional Profile. Reconcile
   those diffs with this security branch before approving either for deployment.
   In particular, the `/professional-profile/?member=...` route introduced
   in PR #196 must read `member_public_profiles` after cutover, never the
   private member table. A passing test on #197 alone does not validate #196.
2. **More peer authors**: audit all privileged RPCs, SQL views, storage
   policies, and notification payloads for undisclosed private member fields.
   A narrow public-safe table does not eliminate leaks from other RPCs.
3. **Privacy semantics**: hiding from the directory does not make a published
   post anonymous; determine whether an opted-out member's authored posts,
   existing direct messages, and call identity should retain attribution.
   Current preparation SQL resolves feed/chat author metadata through the
   opted-in projection and may replace hidden authors' names with a fallback.
   Product acceptance criteria must explicitly approve this behavior.
4. **No broken trust boundaries**: `user_metadata` controls user-facing
   preferences only. It must never grant directory visibility, Founder access,
   account approval, or member-to-member rights.
5. **Compatibility**: authorize two approved accounts, one pending account,
   one suspended account, and a Founder test account in isolated staging,
   exercising direct REST requests, page navigation, photo fallback,
   status transition and private account fields.
6. **Release sequencing**: do not drop the broad directory SELECT policy
   until the safe source is prepared and every peer reader—including PR #196's
   cross-member Profile page—is switched. Do not automatically restore the
   broad policy on rollback; fail closed with a clear message instead.
7. **Security smoke tests**: inspect both `member_profiles` and the new
   table via direct REST requests. A front-end flag alone is **never** a
   privacy boundary.
8. **Permissions**: validate the trigger's definer ownership, RLS policy,
   `search_path`, EXECUTE grants, and cross-table SELECT policy performance
   against current Supabase guidance and advisor results.

### Current implementation state

- Public-safe SQL preparation and enforcement: **drafted, unexecuted**.
- Browser readers: **coded behind a disabled flag**; no live routing change.
- Directory privacy toggle: **prepared for server-authenticated persistence**;
  old metadata-only behavior remains until the coordinated release.
- PR #196 cross-member Profile integration: **outstanding blocker**.
- Production member privacy weakness: **not remediated yet**.
- Production SQL/deployment: **unchanged**.
