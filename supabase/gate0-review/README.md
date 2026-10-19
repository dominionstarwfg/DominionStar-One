# DominionStar Executive OS 2030 — Gate 0 Security Review

**Scope:** staging-only review package for the approved Balanced Executive design,
Modern Minimal Login #2, and Educational Article #8.

**Operational boundary:** The files in this directory are **not deployed** and **not
in the automatic `supabase/migrations/` path**. This GitHub review branch is
NOT an isolated Supabase instance. No production policy has been changed.

## Branch safety and required preflight
1. Confirm Netlify and Supabase do **not** auto-deploy this review branch.
2. Provision a separate Supabase staging project with **synthetic** agents, messages,
   notifications, and founder records; never copy real agents' credentials or
   private messages into staging.
3. Snapshot the real schema and current ACL/policy definitions in a restricted,
   reviewed backup, with a verified recovery path; never save credentials to Git.
4. Inventory all callers of `claim_email_notification_batch(integer)` in
   Netlify jobs, database schedules, edge functions and external workflows.
   The notification worker must use server-only service_role credentials
   before applying the staged SQL.
5. Compare staging baseline behavior, logging, and configured secrets.

## Critical findings and proposed work order

### G0-01: Notification RPC can process and return private outbox data
**Observed:** `claim_email_notification_batch(integer)` is a SECURITY DEFINER
function executable by anon and authenticated roles, and returns full outbox
rows while changing status. **Severity: critical** pending controlled test.

**Candidate patch:** `01_notification_rpc_lockdown.sql`.
Execute **only on isolated staging**, after verifying the caller uses
`service_role`; then test that public/member calls are denied and worker
delivery still operates. Roll forward deliberately; rollback must not
reopen public access merely to recover email delivery. If dispatch fails,
disable dispatch in staging, diagnose worker identity and redeploy safely.

### G0-02: Private voice-message media
**Observed:** `storage.objects` permits authenticated reads for every path
in `direct-message-media`, although the bucket is private. The client
currently generates voice-note signed URLs valid for 30 days.

**Remediation design — blocked until message model is inspected:**
- Add durable attachment metadata tying each object path to one message ID,
  sender and recipient; backfill/handle legacy recordings without guessing.
- Restrict signing and storage reads to actual conversation participants,
  enforce approved-member access, and disallow cross-conversation reads.
- Switch to short-lived on-demand access so past conversations remain usable.
- Assess previously issued 30-day URLs; reducing new TTLs cannot revoke
  already-issued signed links. Define expiry/revocation and incident response.
- Keep audio playback, send, retry and older-device compatibility working.
Do **not** blindly revoke the broad SELECT policy before replacement access
and legacy handling are implemented.

### G0-03: Approved-member directory exposes full member rows
**Observed:** RLS permits authenticated accounts to read approved profiles
marked visible to members, with no column-level filtering in that SELECT
policy; profile records include contact, administrative and identity data.

**Remediation:** ensure pending/suspended accounts cannot list agents;
create minimal directory projection or vetted RPC; limit direct base-table
SELECT privileges without breaking own-profile or founder queries; keep
agent code, administrative notes, private contact/address out of the feed.

### G0-04: Direct-message sender authorization and editing
**Observed:** INSERT RLS checks sender_id=auth.uid and approved recipient,
not explicitly approved sender. UPDATE permits sender or recipient to
modify entire message rows, potentially including author/content fields.

**Remediation:** authorize *approved* sender and recipient; separate
read-receipt, delete, and edit operations; narrow updatable columns or
replace unrestricted UPDATE with role-scoped functions; add negative tests.

### G0-05: Founder authority and profile provision
**Observed:** founder identity is inferred from email claims or fixed
addresses; several SECURITY DEFINER functions are executable by
PUBLIC/anon but some perform internal checks.

**Remediation:** define protected Founder identity by immutable auth UUID,
remove email-based privilege tests after verified migration, make explicit
admin operations audited, and test against self-demotion; leave Member
Contract Level labels TA, Associate, SA, MD, SMD intact.

### G0-06: Other connected access paths
- `community_presence` has permissive authenticated read.
- Community post UPDATE can change moderation-related fields unless
  column privileges/server functions restrict them.
- `community_notify_mentions` is anonymously callable and lacks
  approval/target-message validation: review notification-spam prevention.
- The advisor flags 72 anon-executable SECURITY DEFINER functions.
  Some may check `auth.uid()` or Founder status; review individually.
- Four Meet v2 tables have RLS enabled without policies; determine whether
  service-only RPC access is intentional before altering any Meet table.
- Supabase Auth warns about compromised-password protection; evaluate its
  plan/settings and rollout for registered users.
- Login reset code sends an email but currently lacks a complete
  recovery-password submission screen.
- Keep the public website and Meet separately isolated during OS work.

## Current review-branch source changes (2026-10-18, **not deployed**)

- `assets/js/direct-messages.js` now fails closed if the signed-in member's
  `member_profiles.verification_status` is not exactly `approved`, before
  initializing communication features or displaying the conversations.
  This is a UX defense-in-depth check, **not a substitute for RLS**.
- `04_dm_approved_sender_policy.sql` is a candidate **staging-only**
  `ALTER POLICY` patch to require an approved sender **and** an approved
  recipient for DM INSERT; it has **not** been applied.
- `tests/gate0-review-static.test.mjs` is a dependency-free Node 22
  source-check suite. After checking out this GitHub review branch, run
  `node --test tests/gate0-review-static.test.mjs`.
- The test suite and approval check do **not** fix preexisting DM SELECT,
  UPDATE, media-storage, issued signed-URL, or Founder-global-access concerns.
- The `main` branch and production Supabase database remain unchanged.
  The user declined to create any billable staging database, so synthetic
  JWT integration tests remain blocked.

## G0-02 voice media design update (review branch only)

The production metadata audit of 2026-10-18 found **0 voice-note
messages and 0 stored objects in the direct-message-media bucket**.
This does NOT establish that the storage policy is safe or that the counts
will remain zero. The current client still persists 30-day signed URLs
directly inside message bodies.

- `05_voice_media_protocol_v2.md`: detailed proposed reservation,
  upload, atomic attach, participant-scoped playback and short-link
  lifecycle, including a security test matrix and legacy compatibility.
- `05_voice_media_readonly_inventory.sql`: aggregate-only cutover
  preflight; does not expose message contents or object paths.
- **No voice-storage policy, database function, or live JS was changed.**
- Future implementation of the v2 protocol is blocked pending synthetic
  staging tests and explicit production approval.

## G0-03 member-directory privacy review (not deployed)

Observed production RLS allows any authenticated user, including pending,
to read approved profiles opted into the directory, with the entire
`member_profiles` row potentially accessible. RLS does not mask columns.

- `06_member_directory_rpc_candidate.sql`: additive, tightly scoped
  SECURITY DEFINER directory RPC, available only to approved agents;
  eight permitted fields, with email, agent code, address, phone,
  account notes and administrative fields excluded. NOT APPLIED.
- `assets/js/member-directory.js`: review-branch-only change to call
  the proposed RPC and remove agent codes from directory search.
- `06_profile_privacy_cutover.md`: dependency inventory and required
  second-stage removal of the old permissive SELECT policy after
  all other non-owner consumers are migrated.
- `tests/gate0-directory-static.test.mjs`: source contract tests;
  staging-JWT and real RPC tests are still mandatory.

**Gate remains OPEN:** the additive RPC and changed directory UI do NOT
remove existing direct-table access for approved profile rows. Do not
merge these branch changes until the complementary access-control
migration and integration tests are approved.

## G0-03 dependent client inventory (review branch only)

**The profile privacy cutover is not release-ready.** A full dependency
inventory uncovered distinct author, roster, own-profile, and Founder
use cases. See `09_profile_consumer_inventory.md`.

- `07_community_comment_author_rpc_candidate.sql` adds an approved-viewer,
  visible-comment-only author identity function; publication attribution
  remains independent of directory opt-out. NOT APPLIED.
- `assets/js/community-hub.js` now calls that proposed function to resolve
  comment authors, with no insecure fallback. REVIEW BRANCH ONLY.
- `08_set_own_avatar_rpc_candidate.sql` adds an own-avatar-path-only update
  operation that validates a matching uploaded Storage object. NOT APPLIED.
- `workspace/workspace.js` now calls that proposed operation instead of
  direct `member_profiles` UPDATE. REVIEW BRANCH ONLY.
- `tests/gate0-profile-integrations-static.test.mjs` contains source
  contract checks; real Node and synthetic JWT tests have not run.
- The DM roster still requests private profile fields; it remains a blocker.
- **Do not merge the client changes until corresponding reviewed database
  RPCs are installed in an isolated test environment and access works.**

## G0-03 Messages roster data minimization (review branch only)

- `10_message_contacts_rpc_candidate.sql`: approved-agent-only, six-field
  Messages roster projection. No email, phone, address, agent code, SMD name,
  Founder flags, notes, or other private profile columns. NOT APPLIED.
- `assets/js/direct-messages.js`: staged switch from unrestricted profile
  roster query to `list_message_contacts()`, with fail-closed behavior and
  rejection of stale/forged deep links or incoming-call IDs.
- `direct-messages/index.html`: staged removal of Agent Code and SMD details,
  retaining Contact Level and approved status.
- `10_message_contacts_privacy_cutover.md`: existing Messages discoverability
  is preserved for compatibility: all approved agents are still visible to
  other approved agents independent of directory visibility. A later
  visibility-aligned or connection-restricted model requires product-owner
  approval, preservation of past chats, and new server-side RLS safeguards.
- `tests/gate0-messaging-contacts-static.test.mjs`: staged source checks.

**CRITICAL RELEASE BLOCKER:** old profile-table policy is still permissive,
and the new roster RPC and current client changes are NOT installed/deployed.
Do not merge until the full multi-page RLS/privacy cutover and synthetic
staging tests pass.

## G0-04 DM message and connection integrity (review branch only)

- `11_dm_integrity_rpc_candidate.sql`: three proposed approved-user DM
  operations for recipient-only read receipts and sender-only edit/soft
  delete, coupled with revocation of general browser UPDATE grants.
- `assets/js/direct-messages.js`: these RPCs replace direct DM row
  updates. Incoming missed calls are no longer inserted as if written by
  the other caller; local notifications remain, but authenticated call
  history is a known follow-up requirement.
- `12_connection_state_integrity_candidate.sql`: proposed PENDING-only
  connection creation, restricted accept/decline/block transitions and
  revocation of broad direct UPDATE.
- `13_dm_blocked_send_guard_candidate.sql`: deny new messages in both
  directions when either party blocks the relationship.
- `14_dm_integrity_readonly_checks.sql`: read-only RLS, ACL, and trigger
  metadata inventory (not member messages).
- `11_dm_integrity_cutover.md`: coordinated rollout order, Founder
  privacy decision, missed-call history limitation, unresolved
  metadata-body spoofing and dangerous table-level grants.
- `tests/gate0-dm-integrity-static.test.mjs`: source checks only.

**None of these SQL changes have been applied.** These candidate files
cannot safely deploy piecemeal. Pending, approved, blocked, Founder,
cross-device and malformed-input cases must pass on authorized,
synthetic staging accounts before any production rollout.

## Staging authorization regression matrix
| Actor | Agent directory | Community feed | Send DM | Read someone else's DM | Download someone else's audio | Founder admin |
|---|---|---|---|---|---|---|
| Anonymous | DENY | DENY | DENY | DENY | DENY | DENY |
| Pending agent | DENY | DENY | DENY | DENY | DENY | DENY |
| Suspended agent | DENY | DENY | DENY | DENY | DENY | DENY |
| Approved A | Limited | ALLOW | ALLOW to approved B | DENY outside A threads | DENY outside A threads | DENY |
| Approved B | Limited | ALLOW | ALLOW to approved A | DENY outside B threads | DENY outside B threads | DENY |
| Founder | Approved fields by permission | ALLOW | ALLOW | Defined by explicit privacy policy, NOT assumed | Defined by explicit policy | ALLOW |

**Do not use real people or messages during negative tests.**
For each test: verify REST/RPC response, RLS behavior, storage signing,
storage download, role change, session refresh, logout, and denied retries.

## Preserve these integration contracts
- The principal agent home is `/member-dashboard/`, with `/workspace/` as a tool.
- Login #2 (Modern Minimal) and Article #8 (Editorial) remain selected but untouched.
- Founder and approved agent accounts, messages, media, appointments, badges,
  Contract Levels, profiles, and milestones must survive unchanged.
- Never treat `noindex` or hidden buttons as an authorization boundary.
- Preserve existing Meet route/service; do not modify Meet transport in Gate 0.

## Release checklist — no production release before all pass
- Security staging instance exists and is demonstrably isolated.
- Synthetic baseline, backup, recovery plan, and worker caller documented.
- G0-01 through G0-04 tested with real synthetic-account JWTs.
- Founder approval and demotion safeguards pass.
- Two approved agents exchange and reopen DMs, voice messages, presence,
  notifications and community updates with no duplicate/blinking states.
- Automated schema/policy inventory shows intended new ACLs.
- User explicitly approves a reviewed deployment after regression results.

**Rollback discipline:** Preserve previous schema/ACL definitions before
applying migrations; prefer a tested forward fix when reverting would
reintroduce exposed private data. Never use live member data for QA.

### Evidence
- Direct Supabase metadata and policy reads, 2026-10-18.
- Supabase security advisor 72 anonymous SECURITY DEFINER notices.
- GitHub sources: `assets/js/direct-messages.js`,
  `assets/js/member-login.js`, `assets/js/member-dashboard.js`.
