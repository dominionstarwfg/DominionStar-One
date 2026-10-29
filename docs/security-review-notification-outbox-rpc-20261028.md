# Security Release Gate — Email Outbox RPC Privileges (REVIEW ONLY)

**Status:** Confirmed against live database metadata **2026-10-28 UTC**; this file is a proposal, not an applied migration. No live grants, table rows, recipients, emails, or functions were modified.

## Verified finding: privileged outbox-claim RPC is callable by anonymous clients

Database: Supabase project `ckmurvhjumzlhsegncba`.

Routine: `public.claim_email_notification_batch(integer)`.

Read-only inspection confirmed:

- `SECURITY DEFINER = true`
- `has_function_privilege('anon', oid, 'EXECUTE') = true`
- `has_function_privilege('authenticated', oid, 'EXECUTE') = true`
- `has_function_privilege('service_role', oid, 'EXECUTE') = true`
- ACL explicitly grants EXECUTE to all three roles.
- Function body contains no authenticated-caller or Founder/service-role check. It updates `public.email_notification_outbox` pending rows to `processing`, increases attempts and returns the modified outbox rows.
- Outbox row structure includes recipient email, message subject/body, action URL, status and delivery metadata. The finding therefore warrants urgent review for unauthorized queue processing and potentially sensitive return data. **No call to the function was attempted**, and no exploit or external exposure was tested.
- Netlify function `netlify/functions/process-email-outbox.mjs` calls this RPC through a Supabase client configured with `SUPABASE_SERVICE_ROLE_KEY` after its own authentication check. `netlify/functions/scheduled-email-outbox.mjs` delegates to that processor.

## Minimal candidate remediation — DO NOT APPLY AUTOMATICALLY

After confirming no additional legitimate `anon` / `authenticated` caller depends on this RPC, restrict the EXECUTE grant to the established service-role processor:

```sql
BEGIN;

REVOKE EXECUTE ON FUNCTION public.claim_email_notification_batch(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_email_notification_batch(integer)
  TO service_role;

COMMIT;
```

**Do not deploy this from CI or a Netlify build.** Execute only as a reviewed, explicitly approved production security change after a maintenance / deployment window is selected.

## Verification before and after any approved change

1. Take a snapshot of the exact function body and ACL. Verify the Netlify processor's service-role credentials and the job's caller path, without displaying secrets.
2. Confirm all call sites (including any external jobs) are service-role-only.
3. Read-only verify role privileges with:
```sql
SELECT p.oid::regprocedure::text AS signature,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='claim_email_notification_batch';
```
4. Following the change, verify **false / false / true**. Test that the existing service-role processor claims/sends a designated test notification and that anonymous/ordinary-user access is rejected. Do not use real recipient content for QA.
5. Re-run Supabase Security Advisor after change. Monitor outbox processing for regressions.
6. Rollback only if necessary and under security review. Do not restore `anon` / `authenticated` EXECUTE without a separately justified, scoped authorization design.

## Adjacent findings that also need review

The Security Advisor reported (counts are *findings*, not proven exploits):
- 72 anonymous-executable `SECURITY DEFINER` functions.
- 84 authenticated-executable `SECURITY DEFINER` functions.
- Two functions with mutable `search_path`.
- Four Meet v2 tables with RLS enabled but no policies (may be intentional when access is via trusted server only).
- Leaked-password protection is not enabled.

Review function ownership and **internal auth guards** before revoking other privileges; a broadly applied revoke could break Founder, Community and Meet flows. The Founder member-update RPC currently has a `public.is_dominionstar_founder()` check, illustrating why advisor warnings must be triaged individually.

Supabase advisor remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## Source QA status

GitHub Actions review run 40631953923 (commit `a4cb84bd0c64a9d3c9fc5d411a35e42dd6b81630`) **PASSED**, full Node suite 83 passed / 0 failed, targeted suite 16 passed / 0 failed. This does **not** validate live Supabase permission security or test Meet desktop functionality.

**Production remains unchanged.** This review document contains the proposed next security gate.


## Security Gate 2 — dependency and regression verification

Completed as **read-only Supabase inspection** and GitHub review-branch source changes:

- Confirmed the exact function signature `claim_email_notification_batch(integer)` has `SECURITY DEFINER` enabled, explicit EXECUTE grants for `anon`, `authenticated`, and `service_role`, and no internal caller-authorization check.
- Confirmed the existing Netlify processor calls this RPC using `SUPABASE_SERVICE_ROLE_KEY`. The scheduled Netlify function delegates to this same processor.
- Searched the database's stored function definitions (excluding PostgreSQL aggregates) and found **no other stored function referencing this RPC**. This check cannot discover every external client, integration, or dynamic SQL call.
- Supabase extension metadata indicated no installed `pg_cron` scheduler. Netlify scheduling is defined in source.
- Live email-delivery settings report `is_enabled=true`. Do not disrupt the processor during a production ACL change.
- Created `scripts/security/email-outbox-acl-preflight.review.sql` (**read-only**) and `scripts/security/email-outbox-acl-lockdown.DO-NOT-RUN.review.sql` (**unexecuted production-change proposal**). The latter fails the transaction if the function is missing, its security-definer status differs, or the expected EXECUTE privileges do not resolve to false/false/true after the grants change.
- Added `tests/security-email-outbox-privilege-gate.test.mjs` for explicit role restrictions, backend service-role caller and lack of deployment automation.
- Review GitHub Actions run **40632538772 PASSED**: targeted **16/16**, complete Node suite **87/87**, no failures.
- No ACL change was executed, no queue rows claimed, no email sent, and no production deployment made.

**Still needs explicit approval:** apply the proposed live database permission change; then perform database-grant readback and a controlled test through the existing scheduled email processor.


## Security Gate 3 — extended notification RPC audit (review branch, no production changes)

Live read-only database inspection identified **two additional** `SECURITY DEFINER` notification functions explicitly executable by both `anon` and `authenticated`:

| RPC | Actual behavior | Caller dependency | Recommended gate |
| --- | --- | --- | --- |
| `queue_email_notification(uuid,text,text,text)` | Accepts recipient ID, event, subject and body from the caller; queues an email to an approved member, without verifying the caller | Called inside `queue_appointment_email(uuid)`, a server-side `SECURITY DEFINER` function with member/Founder authorization | Remove external `anon` and `authenticated` EXECUTE while preserving backend/service-role execution; test authorized appointment email generation |
| `queue_community_email_notifications(uuid,text)` | Can queue emails to many approved members from a supplied sender ID and message text, with no internal caller check or posted-message verification | Directly called by browser `assets/js/community-chat.js` after a successful chat-message INSERT | Do **not** simply revoke member EXECUTE. Replace its function body with an authenticated-sender check, approved-profile check, matching recent persisted chat message, recipient preference checks, and per-message/per-recipient deduplication; revoke `anon` only |

The database's `community_chat_messages` INSERT policy restricts message authors to `auth.uid()` and approved members; however, the standalone email RPC can currently be invoked without inserting a chat message, so the chat table's RLS is **not sufficient**. The existing `email_notification_outbox` unique index on `dedupe_key` supports replay protection.

The SQL proposals are **not applied**, **not part of deployment**, and must be reviewed/approved together with the existing service-role queue claim plan:
- Read-only list of all three functions and stored-function dependencies: `scripts/security/notification-rpc-preflight.READ-ONLY.review.sql`
- Candidate role restrictions for generic email queue + outbox claim: `scripts/security/notification-rpc-acl-lockdown.DO-NOT-RUN.review.sql`
- Candidate guarded Community email RPC preserving the existing browser interface signature: `scripts/security/community-email-rpc-guard.DO-NOT-RUN.review.sql`
- Corrected `supabase/member-email-notifications.sql` for **future** schema application: explicitly revokes `PUBLIC, anon, authenticated` claims rather than only `PUBLIC`. Source-only change; it has not been applied.
- New static regression coverage: `tests/notification-rpc-hardening-review.test.mjs`

**Verification:** GitHub Actions run `40704936393` passed targeted **16/16** and all Node tests **93/93**. These source tests do not prove SQL execution, live role restriction, reliable email delivery, or end-to-end desktop behavior.

**Production release blocker:** Obtain explicit approval for live SQL changes; plan controlled validation for the email processor, appointment email creation, a legitimate Community Chat post, replay blocking, and anonymous/unauthorized rejection without touching real recipient content. Recheck the Supabase Security Advisor and queue-delivery logs after the change. Do not batch unrelated `SECURITY DEFINER` grants into this correction.
