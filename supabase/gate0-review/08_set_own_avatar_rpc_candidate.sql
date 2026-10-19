-- DOMINIONSTAR / GATE 0 / REVIEW-ONLY CANDIDATE
-- DO NOT APPLY TO PRODUCTION OR AUTOMATIC MIGRATIONS.
--
-- Background: Workspace uploads to member-avatars/<uid>/... and attempts
-- UPDATE member_profiles directly, but only Founder UPDATE policy exists.
-- A narrowly scoped SECURITY DEFINER function saves a path ONLY for the
-- signed-in account whose matching object already exists in Storage.
--
-- No general member_profile UPDATE policy is added.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.set_own_avatar_path(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Avatar RPC already exists; stop for manual review';
  END IF;
  IF to_regclass('public.member_profiles') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Profile or storage relation missing';
  END IF;
END
$preflight$;

CREATE FUNCTION public.set_own_avatar_path(new_avatar_path text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, storage
AS $body$
DECLARE saved_path text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF new_avatar_path IS NULL
     OR length(new_avatar_path) > 256
     OR new_avatar_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+[.](jpg|jpeg|png|webp)$') THEN
    RAISE EXCEPTION 'Invalid avatar path' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects obj
    WHERE obj.bucket_id='member-avatars' AND obj.name=new_avatar_path
  ) THEN
    RAISE EXCEPTION 'Uploaded avatar object was not found' USING ERRCODE='22023';
  END IF;

  UPDATE public.member_profiles
  SET avatar_path=new_avatar_path, updated_at=now()
  WHERE id=auth.uid()
  RETURNING avatar_path INTO saved_path;

  IF saved_path IS NULL THEN
    RAISE EXCEPTION 'Member profile was not found' USING ERRCODE='42501';
  END IF;
  RETURN saved_path;
END
$body$;

REVOKE ALL ON FUNCTION public.set_own_avatar_path(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_own_avatar_path(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_own_avatar_path(text) TO authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon','public.set_own_avatar_path(text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.set_own_avatar_path(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Avatar RPC privilege verification failed';
  END IF;
END
$verify$;
COMMIT;

-- Staging tests with synthetic users and objects:
-- * A may set their avatar only to objects in their own storage/<uid> folder.
-- * B cannot point their profile to A's object.
-- * Missing objects, malformed path, traversal, null, oversized path DENY.
-- * Anonymous DENY. Approved and pending own-avatar behavior verify.
-- * Unrelated profile attributes (verification_status, rank, role) unchanged.
-- * Workspace upload -> saved profile -> reload succeeds.
-- * Existing current avatar never deleted on RPC failure.
