-- DOMINIONSTAR EXECUTIVE OS / GATE 0 / STAGING-ONLY CANDIDATE
-- DO NOT APPLY TO PRODUCTION. Outside automatic supabase/migrations.
--
-- Additive, minimal profile projection for the Messages contact picker.
-- Preserves current UX: all approved agents are listed to another approved
-- agent, even if profile_visibility='private' (that setting currently only
-- filters the public agent directory, not the DM roster).
-- This DISCOVERY contract is a deliberate compatibility placeholder:
-- product-owner confirmation is required before changing visibility rules.
-- It does NOT grant DM INSERT or bypass DM/storage RLS.
-- Security improvements take effect ONLY after the broad profile SELECT
-- policy is separately removed in a coordinated tested cutover.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.list_message_contacts()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: list_message_contacts already exists';
  END IF;
  IF to_regclass('public.member_profiles') IS NULL THEN
    RAISE EXCEPTION 'STOP: expected member_profiles table missing';
  END IF;
END
$preflight$;

CREATE FUNCTION public.list_message_contacts()
RETURNS TABLE (
  id uuid,
  full_name text,
  preferred_name text,
  rank text,
  avatar_path text,
  verification_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
  SELECT
    contact.id,
    contact.full_name,
    contact.preferred_name,
    contact.rank,
    contact.avatar_path,
    contact.verification_status
  FROM public.member_profiles contact
  WHERE auth.uid() IS NOT NULL
    AND contact.id <> auth.uid()
    AND contact.verification_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.member_profiles viewer
      WHERE viewer.id = auth.uid()
        AND viewer.verification_status = 'approved'
    )
  ORDER BY contact.full_name, contact.id;
$body$;

REVOKE ALL ON FUNCTION public.list_message_contacts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_message_contacts() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_message_contacts() TO authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon','public.list_message_contacts()','EXECUTE')
      OR NOT has_function_privilege('authenticated','public.list_message_contacts()','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: incorrect list_message_contacts grants';
  END IF;
END
$verify$;

COMMIT;

-- Expected JWT tests on a separately authorized synthetic staging DB:
-- * anon/pending/suspended/declined: no agent roster results.
-- * approved A: only approved members other than A.
-- * no agent_code, smd_name, email, phone, addresses, notes, role, founder.
-- * approved B -> approved A: reciprocal visibility with current behavior.
-- * directory private profile: still in Messages; requires owner decision.
-- * client FAILS CLOSED if RPC is unavailable; no unrestricted fallback.
-- * existing DMs, deep links, presence, forwarding, calls still function.
--
-- Not covered: actual permission to send DMs, blocked relationships,
-- DM read/update RLS, voice-media access or previously signed recordings.
