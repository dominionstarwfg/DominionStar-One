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
