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
