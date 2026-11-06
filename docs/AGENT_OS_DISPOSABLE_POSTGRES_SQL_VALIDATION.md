# DominionStar One — Disposable PostgreSQL Integration Evidence

**Date:** November 6, 2026  
**Status:** Passed against a disposable PostgreSQL 16 service with *synthetic* identities and content. **NOT production, NOT the Supabase staging project.**

[Verified GitHub workflow run](https://github.com/dominionstarwfg/DominionStar-One/actions/runs/42258107450)

## What actually ran

A GitHub Actions `postgres:16` service created a temporary database
named `synthetic_agent_review` on `127.0.0.1`. The job created only
synthetic fake approved, pending and private member records. It modeled
Supabase's `anon`, `authenticated`, `service_role` roles and `auth.uid()`
session identity locally without any credential or connection to Supabase.

In order, the job compiled and ran these reviewed SQL candidates against
the disposable database:

1. `community-notifications-from-source.DO-NOT-RUN.review.sql` with
   `tests/sql/community-notifications-fixture.sql` and
   `tests/sql/community-notifications-assertions.sql`.
2. Seeded nine synthetic reactions on six member/post pairs (three excess
   historical reactions) using `tests/sql/community-reactions-fixture.sql`.
3. Confirmed `community-single-reaction.DO-NOT-RUN.review.sql`
   **refused** the initial transition before data reconciliation.
4. Compiled and ran `community-reaction-archive.DO-NOT-RUN.review.sql`
   in the temporary database. Confirmed exactly three superseded records
   were archived before they were removed from the temporary live table.
5. Compiled and ran `community-single-reaction.DO-NOT-RUN.review.sql`
   after the temporary archive procedure.
6. Executed `tests/sql/community-reactions-assertions.sql`: Love,
   replacement, toggling off, unique-constraint enforcement, pending-user
   denial, deleted-post denial, direct cross-member update denial,
   anonymous RPC denial, private archive invisibility.

**Result markers emitted by the actual job:**

- `COMMUNITY_NOTIFICATION_POSTGRES_INTEGRATION_PASS`
- `EXPECTED_DUPLICATE_PREFLIGHT_REJECTION_PASS`
- `COMMUNITY_SINGLE_REACTION_POSTGRES_INTEGRATION_PASS`
- `DISPOSABLE_POSTGRES_NO_SUPABASE_NO_EMAIL_PASS`

## Security assertions covered

- Genuine source author and saved-text attribution, exact `@name`
  matching (`@Ann` versus `@Annabelle`), no mention for private/pending
  members, no duplicate alert for a replied-to author who was also mentioned.
- At most five mention recipients per source item.
- Cross-member notification inbox RLS, source-author spoof rejection,
  pending-member insert rejection, and legacy free-form mention RPC denial.
- One reaction per member per post after migration, Love supported in
  database check and RPC, and preservation of other members' reaction state.
- Archived historical reactions are inaccessible to the regular
  authenticated role.

## What this does NOT establish

- The actual Supabase Auth / PostgREST behavior or the full production
  database schema. The fixture deliberately contains only columns and
  policies necessary to exercise these two SQL draft contracts.
- Concurrent updates from two real devices, race/retry behavior,
  production rollbacks, end-to-end UI authentication or realtime delivery.
- The separate P0 member profile privacy cutover and the priority-email
  delivery migration. Those are **still unexecuted** and require their own
  isolated authorization tests.
- Approval to run any SQL against the real Supabase project. There is no
  production migration in this GitHub job, and its database is discarded
  automatically after each run.

## Remaining explicit release conditions

1. Authorize and provision an **isolated, nonproduction Supabase project**,
   without reusing the production database or genuine member data.
2. Apply the coordinated privacy, Community, reactions and selected-email
   drafts in the correct order using synthetic authenticated accounts.
3. Confirm the production-representative grants, RLS, Data API exposure,
   privileged RPC behavior and event provenance.
4. Decide and approve the historical reaction archival policy before
   touching production. No automatic deletion is authorized.
5. Verify rollback/monitoring and give separate explicit approval for
   production SQL and production Netlify deployment.

**Both SQL files retain DO NOT RUN in their filenames because the
production/staging release remains gated. The GitHub workflow is the
only authorized *disposable local test* that executes them.**
