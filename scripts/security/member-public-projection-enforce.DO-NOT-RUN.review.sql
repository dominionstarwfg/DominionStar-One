-- REVIEW ONLY — DO NOT RUN. P0 final enforcement candidate.
-- ONLY after isolated staging, public-safe projection, upgraded member clients,
-- and explicit production authorization. This is intentionally separate from
-- preparation; never run from CI, Netlify, or a review preview.
BEGIN;
DO $preflight$
DECLARE source_count bigint; projected_count bigint;
BEGIN
  IF to_regclass('public.member_public_profiles') IS NULL THEN
    RAISE EXCEPTION 'Public-safe member projection missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='public.member_profiles'::regclass
      AND t.tgname='member_profiles_sync_public_directory'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Member profile projection sync trigger missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='member_public_profiles'
      AND policyname='approved members may see opted-in directory identities'
  ) THEN
    RAISE EXCEPTION 'Public-safe projection RLS policy missing';
  END IF;
  SELECT count(*) INTO source_count
  FROM public.member_profiles
  WHERE verification_status='approved' AND profile_visibility='members';
  SELECT count(*) INTO projected_count
  FROM public.member_public_profiles;
  IF source_count<>projected_count THEN
    RAISE EXCEPTION 'Member projection out of sync; do not revoke profile reads';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_profiles'
      AND cmd IN ('SELECT','ALL')
      AND policyname NOT IN (
        'profile approved directory read','profile own read','profile founder read'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected member_profiles SELECT policy; review required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_profiles'
      AND policyname='profile own read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_profiles'
      AND policyname='profile founder read' AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'Owner / Founder profile read policies missing';
  END IF;
END;
$preflight$;

-- RLS is row-level: broad table SELECT is safe only after cross-member
-- directory policy is removed. Owner and Founder policies remain.
DROP POLICY "profile approved directory read" ON public.member_profiles;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_profiles'
      AND cmd IN ('SELECT','ALL')
      AND policyname NOT IN ('profile own read','profile founder read')
  ) THEN
    RAISE EXCEPTION 'Another member_profiles SELECT policy remains';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_profiles'
      AND policyname='profile own read'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='member_profiles'
      AND policyname='profile founder read'
  ) THEN
    RAISE EXCEPTION 'Expected owner/founder policies were not retained';
  END IF;
END;
$verify$;
COMMIT;

-- These metadata assertions do NOT replace negative access tests:
-- 1. Approved A querying member_profiles?id=eq.B returns no B row.
-- 2. Approved A querying member_public_profiles returns opted-in B public data.
-- 3. A cannot retrieve B's email, phone, address, account_notes or Agent Code.
-- 4. A can still read/edit their own profile and privacy settings.
-- 5. Founder can still manage accounts as explicitly approved.
-- 6. Pending / anonymous cannot read the public-safe member directory.
-- 7. After B chooses private, B disappears from directory, feed metadata,
--    community author metadata and incoming-call lookup (where applicable).
-- 8. Direct-message participant access requires a separate signed-off decision.
-- 9. Verify actual review-branch publicMemberProfilesV2 flag is enabled for
--    every peer-profile consumer in the released app before executing.
-- If release fails, stop or roll forward safely; do not silently recreate the
-- broad member_profiles directory policy as an emergency rollback.
