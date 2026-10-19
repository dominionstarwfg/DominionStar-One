# Gate 0 — Founder Authority Cutover and Lockout-Prevention Review

**Status:** Review-only. This document and the trust-anchor candidate are NOT
installed. No Supabase development branch has been created; no production
database, `main` branch, or deployed website has been modified.

## What the current code actually does

Production `public.is_dominionstar_founder()` uses JWT **email** claims
instead of an immutable Supabase Auth user UUID. The profile provisioning
function `ensure_member_profile()` also auto-approves accounts, marks
them Founder, assigns SMD, and sets founding status based on known
email addresses.

The audit on 2026-10-18 found **five database functions** with hardcoded
Founder emails:

1. `is_dominionstar_founder()` — root authorization used by RLS and RPCs.
2. `ensure_member_profile()` — bootstraps role, approved status and profile.
3. `founder_update_member(...)` — protects target Founder rows partly by email.
4. `assign_exclusive_founding_number(...)` — reserves Founding Member #1
   partly by email.
5. `ensure_my_founding_member_number()` — assigns/maintains founder
   numbering partly by email.

At least **38 RLS policies across 23 public tables** reference the existing
`is_dominionstar_founder()` function. There is one approved
`member_profiles` record with BOTH `is_founder=true` and
`role='founder'` (aggregate only; no private account ID exposed).

The Founder browser interfaces also had mixed fallback logic:
- `assets/js/founder-admin.js`: database RPC OR hardcoded email allowed entry;
  a separate email/flag check disabled protected member rows.
- `assets/js/member-dashboard.js`: Founder shortcut displayed when
  an email/role/flag matched.
- `assets/js/community-hub.js`: moderation controls shown based on
  editable profile role/flag.
- `assets/js/platform-core.js`: `state.isFounder` set from profile flags.

## Review-branch code already prepared, NOT deployed

These four clients now determine Founder authority from
`client.rpc('is_dominionstar_founder')` rather than email or role flags.
The Founder roster UI additionally protects its OWN profile from accidental
demotion regardless of the displayed email. UI checks are defense-in-depth;
the database remains the final authorization boundary.

`15_founder_trust_anchor_candidate.sql` creates a separate, privately
permissioned `dominionstar_security.founder_identities` table keyed by
the Auth UUID, and the **non-activating** helper
`public.is_dominionstar_founder_v2()`. It does not grant permission to a
new account, seed anyone, or change the existing authorization function.
Never auto-seed using member profile role, agent code, or email.

## Staging migration stages — all require explicit future authorization

### Preflight and verified identity

- Preserve snapshots of function bodies, RLS policies, privileges, member
  profile founder flags, rank/founding-member allocation, and recent audit
  entries. No private data or credentials in GitHub.
- Have the authenticated platform owner verify their **exact Supabase
  `auth.users.id`** through a trusted administration channel. Matching
  email or role flags alone is insufficient. Record authorization privately.
- Prepare an administrative recovery path independent of the web UI
  (trusted admin/service-role SQL access plus tested rollback).
- Freeze Founder role/provisioning changes during isolated test migration.
- Check that the existing approved Founder profile uniquely matches
  the verified user ID; abort if there are any discrepancies.

### Add the protected trust root

- Apply `15_founder_trust_anchor_candidate.sql` on an isolated database
  with fictional Auth accounts. Validate private schema/table privileges.
- Seed the known synthetic Founder Auth UUID with trusted operator
  credentials (NEVER with a client, public RPC, or committed literal).
- Verify the intended Founder gets v2=true and every other identity
  (including anonymous, pending, and someone with a matching **email string**)
  gets false. Do not assume that the profile `role` or `is_founder`
  grants authority.

### Coordinated activation (NOT YET CODED, do not partially apply)

The final activation must be one reviewed transaction containing:
1. Preflight for exactly one active verified Founder and matching
   trusted profile; abort on zero, duplicates or mismatch.
2. Replace the existing `is_dominionstar_founder()` body with the
   trusted UUID-based test while preserving its exact function signature.
   This avoids rewriting each of the 38 dependent policies and ensures
   dependent RPCs receive the same authorization semantics.
3. Update `ensure_member_profile()` so new or returning accounts can
   never bootstrap Founder privileges from email or user-controlled
   metadata. Reconcile legacy role/flag only for the verified Auth UID.
4. Update `founder_update_member(...)` so the immutable Founder row
   cannot be demoted, suspended, reassigned, or have its protected
   rank/status changed via editable email/role/flag heuristics.
5. Update BOTH `assign_exclusive_founding_number(...)` and
   `ensure_my_founding_member_number()` to reserve #1 for the verified
   Founder identity, never by email. Preserve special first-20 numbers.
6. Review direct `member_profiles` Founder UPDATE grants, current
   profile privileges, and any other role/flag consumers. Browser write
   attempts must not change the protected Founder root.
7. Preserve or explicitly define governance for Founder visibility into
   private DMs and member data; identity hardening must not implicitly
   expand those privileges.
8. Assert authorization immediately before commit, with synthetic
   authenticated tokens and privileged administrative checks. If
   one check fails, roll back the entire transaction.
9. Test credentials/session refresh, logged-in Founder, community
   moderation, admin analytics, founding-member #1, approvals, agent
   rank changes, billing/notification controls, and other RLS-linked
   routes before accepting the migration.

**Critical constraint:** Do NOT replace the original Founder RPC before
the immutable ID is correctly seeded and all five legacy email-dependent
functions are updated in a coordinated migration. The anchor alone does
not resolve the email-based production policy.

## Owner-admin safeguards

- Keep actual Founder identity immutable and inaccessible to agents.
- Protect the final active Founder against accidental or unauthorized
  removal. A separate privileged break-glass recovery procedure
  must exist and be tested.
- Do not grant ordinary administrator or agent accounts Founder access
  by assigning them Contract Level SMD or altering `role` fields.
- Member profile approvals and Contract Levels (TA, Associate, SA, MD,
  SMD) remain operational with audit trails.
- Read-only Founder analytics should never leak full member records
  to unauthorized accounts.
- Locking Founder controls in UI is not a security boundary; the
  corresponding SECURITY DEFINER functions and RLS must enforce it.

## Negative-test matrix in synthetic staging

| Action | Verified Founder | Approved non-Founder | Pending or suspended | Anonymous |
|---|---|---|---|---|
| Founder authorization RPC | TRUE | FALSE | FALSE | FALSE/denied |
| Founder Control page | Allowed | Denied | Denied | Denied |
| Founder analytics/audit | Allowed | Denied | Denied | Denied |
| Member approval/rank changes | Allowed + audit | Denied | Denied | Denied |
| Change Founding Member #1 | Protected | Denied | Denied | Denied |
| New account sharing old Founder email | Never elevated | Never elevated | Never elevated | Denied |
| Alter own profile to `is_founder=true` | No effect on trusted root | No authority gained | No authority gained | Denied |
| Attempt Founder self-demotion | Denied | N/A | N/A | N/A |

Test pending agents, role changes, session expiry, sign-out, and two
browser/device sessions. Ensure no recursive RLS execution or accidental
`service_role` exposure in frontend assets.

## Release gate

No production migration and no staging charges until the user approves.
The separate GitHub review branch MUST remain unmerged. Source-level
JavaScript syntax checks and metadata reads are not integration tests.
Actual confirmation requires real synthetic JWTs on an isolated Supabase
database, written rollback and verified access continuity.
