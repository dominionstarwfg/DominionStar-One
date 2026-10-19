-- DOMINIONSTAR EXECUTIVE OS 2030 / GATE 0 — CANDIDATE STAGING-ONLY RPC
-- NOT DEPLOYED. Lives OUTSIDE supabase/migrations/.
-- IMPORTANT: This additive RPC ALONE DOES NOT fix the existing broad SELECT
-- policy or table grants on member_profiles. Those MUST be removed after
-- all non-owner profile readers migrate and staging JWT tests pass.
--
-- Current owner/founder SELECT paths must remain intact. Never hardcode
-- agent codes, emails, addresses, phones or account notes in public directory.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.list_directory_members()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: list_directory_members already exists; review current definition before replacing';
  END IF;
  IF to_regclass('public.member_profiles') IS NULL THEN
    RAISE EXCEPTION 'STOP: member_profiles missing';
  END IF;
END
$preflight$;

-- No input parameters: the authenticated caller identity is auth.uid().
-- Elevated execution is limited to returning the eight explicitly selected
-- directory fields, NEVER whole profile rows. SECURITY DEFINER is needed
-- to avoid recursive RLS checks while testing the caller's approved status.
CREATE FUNCTION public.list_directory_members()
RETURNS TABLE(
  id uuid,
  full_name text,
  preferred_name text,
  rank text,
  city text,
  state text,
  avatar_path text,
  exclusive_member_number integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
  SELECT
    profile.id,
    profile.full_name,
    profile.preferred_name,
    profile.rank,
    profile.city,
    profile.state,
    profile.avatar_path,
    profile.exclusive_member_number
  FROM public.member_profiles AS profile
  WHERE auth.uid() IS NOT NULL
    AND profile.verification_status = 'approved'
    AND profile.profile_visibility = 'members'
    AND EXISTS (
      SELECT 1
      FROM public.member_profiles AS requesting_agent
      WHERE requesting_agent.id = auth.uid()
        AND requesting_agent.verification_status = 'approved'
    )
  ORDER BY profile.full_name, profile.id;
$body$;

REVOKE ALL ON FUNCTION public.list_directory_members() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_directory_members() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_directory_members() TO authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon','public.list_directory_members()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.list_directory_members()','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: directory RPC grants incorrect';
  END IF;
END
$verify$;
COMMIT;

-- Still required before release:
-- (1) All non-owner profile reads migrate to limited RPCs.
-- (2) Founder direct SELECT and own-profile reads still work.
-- (3) Replace/drop permissive 'profile approved directory read' RLS policy.
-- (4) Reassess direct grants for UPDATE, DELETE, TRUNCATE, etc.
-- (5) Test pending, declined, suspended, approved, anonymous and founder JWTs.
-- (6) Confirm no agent codes, emails, phones, addresses, account_notes leak.
-- (7) Test off-directory searches cannot query unrestricted base table.
