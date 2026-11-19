# DominionStar One — Disposable Member Privacy / Connections Integration

**Date:** November 6, 2026  
**Status:** PASSED in disposable PostgreSQL 16 CI only. **NOT production; NOT Supabase staging.**

[Verified privacy/connection SQL test run](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/42273989201)

## Actual execution boundary

The workflow `.github/workflows/member-privacy-postgres-isolation-review.yml`
creates a temporary PostgreSQL database named `synthetic_agent_privacy` at
`127.0.0.1`. It models `auth.uid()`, inert NOLOGIN `anon`, `authenticated`
and `service_role` roles, and fake approved, unapproved and Founder
identities. No real user record, email, account identifier or Supabase
credential is used.

The SQL fixture reproduces the audited, broad production directory and
connection policies **using synthetic records**. It then executes the
previously drafted preparation and enforcement SQL on the disposable
database, followed by negative RLS tests with independently simulated
user identities.

## Confirmed SQL verification markers

- `MEMBER_PROJECTION_PREPARE_POSTGRES_PASS`
- `MEMBER_PROJECTION_ENFORCE_POSTGRES_PASS`
- `MEMBER_CONNECTION_POSTGRES_INTEGRATION_PASS`
- `DISPOSABLE_MEMBER_PRIVACY_NO_PRODUCTION_NO_EMAIL_PASS`

All eight GitHub review workflows, including the separate Community
PostgreSQL gate and Chromium Feed tests, passed on commit
`828c2b64c769096b831cde7da99ff5a931c0cfc8`. Netlify static preview
also built successfully.

## What was tested

- A's raw `member_profiles` query could read visible approved C's synthetic
  private notes **before enforcement**, demonstrating the old policy risk.
- After the final synthetic RLS policy change, A could **no longer read C's
  raw profile**, including private email/phone/notes fields.
- Approved members could still read approved, opted-in public-safe identity
  records only, and could read their own full private profiles.
- The Founder retained scoped management reads for pending and private
  profiles; the public-safe projection still omitted private/pending rows.
- Existing legacy Settings metadata opt-out was imported as
  `profile_visibility='private'` before projection backfill.
- The server privacy RPC removed a member from the directory and restored
  that member only after their own deliberate opt-in.
- Feed and Community Chat SECURITY DEFINER author joins produced no public
  name/avatar fields for opted-out synthetic authors.
- Pending/anonymous accounts could not read professional directory records
  or execute the member visibility RPC.
- Approved requester A could create a *pending* invitation to approved,
  directory-visible member C. Preaccepted and self-invitations were denied.
- Unrelated member B could neither respond to nor cancel A->C's invitation.
- Only recipient C could accept the pending request; its state could not be
  changed again by a second response.
- Requester A could cancel their own separate *pending* invitation but not
  an already accepted connection. Direct member UPDATE/DELETE privileges
  were revoked; anonymous connection RPC execution was denied.
- Unapproved and directory-hidden recipients were rejected from **new
  public-directory invitations**, and unapproved requesters could not
  initiate connections.

## Integration defect found and corrected

The initial `member-connection-integrity.DO-NOT-RUN.review.sql` draft
checked the invitee against raw `member_profiles`. That conflicts with
the final private-profile RLS policy: A can no longer read approved C's
raw profile row. The draft was amended to require an approved,
directory-visible recipient in `member_public_profiles` instead.

One early integration test tried to send a new public-directory invitation
to a synthetic opted-out member and correctly failed. The test was updated
to assert **denial** of that request, then verify pending cancellation
against a different visible approved recipient.

These corrections are in the review PR and have **NOT** been applied to
production.

## Important exclusions

- The test is PostgreSQL with a restricted **synthetic** Supabase-shaped
  schema. It does not establish actual Supabase Auth, Data API, Storage,
  JWT lifecycle, Realtime, browser role configuration or full deployment
  compatibility.
- No live-user authenticated sign-in or concurrent browser sessions were used.
- The strict member-profile security fix requires all peer-facing clients
  to switch from raw `member_profiles` to `member_public_profiles`.
  The guarded client `publicMemberProfilesV2` flag is still **false**.
- Existing private or historical connection relationships, founder access
  semantics, direct-message privacy and account deletion are separate
  requirements needing sign-off.
- The priority-email, Community notification and reaction SQL drafts remain
  unexecuted against the actual Supabase project.
- An isolated nonproduction Supabase environment with synthetic users is still
  required before any permission change on the live database.

## Release sequence remains controlled

1. Review/authorize an isolated nonproduction Supabase project.
2. Verify full real Auth/Data API authorization, protected profile columns,
   visibility preferences, founded administration and pending connections.
3. Inventory all remaining SECURITY DEFINER peer-identity functions,
   account-to-account direct messages and notification/link privacy.
4. Enable guarded frontend peer projections **only with the prepared backend**.
5. Authorize and execute final RLS enforcement after consumer audit and
   synchronized rollout tests.
6. Independently approve production SQL, deployment, rollback, monitoring
   and any migration of historical data.

**Do not merge this draft, execute its SQL on production, or remove the
release controls on the basis of disposable database tests alone.**
