-- DOMINIONSTAR EXECUTIVE OS 2030 — GATE 0 / REVIEW-ONLY TRUST ANCHOR
-- DO NOT APPLY TO PRODUCTION OR MERGE. OUTSIDE supabase/migrations.
-- This file is a NON-ACTIVATING foundation: it does NOT change or replace
-- is_dominionstar_founder(), does NOT grant any new Founder access, and does
-- NOT auto-seed from emails, JWT claims, or mutable member_profiles flags.
--
-- Deployment prerequisites: operator independently verifies actual Founder
-- auth.users.id and founder recovery controls, then seeds only that exact UID
-- in isolated staging through a protected admin-only console. NEVER write
-- real user identifiers, passwords, API secrets or email-based fallbacks to Git.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('dominionstar_security.founder_identities') IS NOT NULL THEN
    RAISE EXCEPTION 'Founder trust table already exists; review manually';
  END IF;
  IF to_regprocedure('public.is_dominionstar_founder_v2()') IS NOT NULL THEN
    RAISE EXCEPTION 'Founder v2 RPC already exists; review manually';
  END IF;
END
$preflight$;

CREATE SCHEMA IF NOT EXISTS dominionstar_security;
REVOKE ALL ON SCHEMA dominionstar_security FROM PUBLIC;
REVOKE ALL ON SCHEMA dominionstar_security FROM anon;
REVOKE ALL ON SCHEMA dominionstar_security FROM authenticated;

CREATE TABLE dominionstar_security.founder_identities (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE dominionstar_security.founder_identities FROM PUBLIC;
REVOKE ALL ON TABLE dominionstar_security.founder_identities FROM anon;
REVOKE ALL ON TABLE dominionstar_security.founder_identities FROM authenticated;

-- Security is enforced by PostgreSQL schema/table privileges. Keep this
-- private schema OUT of PostgREST exposed schemas. No client can seed IDs.
-- Security definer is required for the helper's protected table access.
CREATE FUNCTION public.is_dominionstar_founder_v2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth, dominionstar_security
AS $body$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM dominionstar_security.founder_identities verified
    WHERE verified.user_id = auth.uid()
      AND verified.is_active IS TRUE
  );
$body$;

REVOKE ALL ON FUNCTION public.is_dominionstar_founder_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_dominionstar_founder_v2() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_dominionstar_founder_v2() TO authenticated;

DO $verify$
BEGIN
  IF has_schema_privilege('anon','dominionstar_security','USAGE')
    OR has_schema_privilege('authenticated','dominionstar_security','USAGE')
    OR has_table_privilege('authenticated',
      'dominionstar_security.founder_identities','SELECT')
    OR has_function_privilege('anon',
      'public.is_dominionstar_founder_v2()','EXECUTE')
  THEN
    RAISE EXCEPTION 'Founder trust anchor is exposed to browser roles';
  END IF;
END
$verify$;

COMMIT;

-- DO NOT ACTIVATE THIS BY SWAPPING EXISTING FOUNDER RPC YET.
-- Required next work: Founder seed and exact-ID verification; security
-- assertion that the real Founder still has privileges after the swap;
-- coordinated changes to ensure_member_profile(), founder_update_member(),
-- assign_exclusive_founding_number(), founder JS and dependent policies.
-- Never use member_profiles.is_founder, email, role, or JWT email as the
-- authority to automatically seed this table.
-- On staging, BEFORE cutting over, assert:
--   SELECT count(*)=1 FROM dominionstar_security.founder_identities
--     WHERE is_active;
--   SELECT count(*)=1 FROM dominionstar_security.founder_identities f
--     JOIN public.member_profiles p ON p.id=f.user_id
--     WHERE f.is_active AND p.is_founder IS TRUE AND p.role='founder';
-- Compare exact authenticated UID on a separate trusted channel; aggregate
-- checks alone are not sufficient to confirm the owner's identity.
