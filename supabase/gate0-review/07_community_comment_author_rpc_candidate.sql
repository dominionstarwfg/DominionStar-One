-- DOMINIONSTAR / GATE 0 / REVIEW-ONLY CANDIDATE
-- Keep OUTSIDE supabase/migrations. Do not run on production.
--
-- Goal: display names and avatars for authors of actual visible community
-- comments without granting general access to every member_profiles column.
-- Directory opt-out must NOT anonymize a member's own published comments.
--
-- Caveat: this additive RPC does not revoke the old broad member_profiles
-- SELECT policy. It must be tested with the final privilege cutover.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.list_community_comment_authors(uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'Existing author RPC detected; review definition manually';
  END IF;
  IF to_regclass('public.member_profiles') IS NULL
    OR to_regclass('public.community_comments') IS NULL
    OR to_regclass('public.community_messages') IS NULL THEN
    RAISE EXCEPTION 'Community or profile schema missing';
  END IF;
END
$preflight$;

CREATE FUNCTION public.list_community_comment_authors(target_author_ids uuid[])
RETURNS TABLE(
  id uuid,
  full_name text,
  preferred_name text,
  rank text,
  exclusive_member_number integer,
  avatar_path text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $body$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_profiles requester
    WHERE requester.id = auth.uid()
      AND requester.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Approved member required'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(cardinality(target_author_ids),0) > 200 THEN
    RAISE EXCEPTION 'Too many author IDs';
  END IF;

  RETURN QUERY
    SELECT profile.id, profile.full_name, profile.preferred_name,
           profile.rank, profile.exclusive_member_number, profile.avatar_path
    FROM public.member_profiles profile
    WHERE profile.id = ANY(coalesce(target_author_ids, ARRAY[]::uuid[]))
      AND EXISTS (
        SELECT 1
        FROM public.community_comments c
        JOIN public.community_messages m ON m.id=c.message_id
        WHERE c.user_id=profile.id AND c.is_deleted=false
          AND m.is_deleted=false
      );
END
$body$;

REVOKE ALL ON FUNCTION public.list_community_comment_authors(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_community_comment_authors(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_community_comment_authors(uuid[]) TO authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon',
      'public.list_community_comment_authors(uuid[])','EXECUTE')
    OR NOT has_function_privilege('authenticated',
      'public.list_community_comment_authors(uuid[])','EXECUTE') THEN
    RAISE EXCEPTION 'Bad RPC grants';
  END IF;
END
$verify$;
COMMIT;

-- Staging acceptance:
-- [ ] Approved member can get authors of visible comments, even if those
--     authors set profile_visibility='private'.
-- [ ] Anonymous, pending, declined, suspended JWTs get no identities.
-- [ ] Invented author UUID without qualifying visible comments returns none.
-- [ ] Returned record has no email, agent_code, phone, address, notes, role.
-- [ ] A comment on deleted parent cannot be used to obtain an identity.
-- [ ] Existing posts, comments, avatar rendering, ordering still work.
-- [ ] No dependency on a real agent's rows, UUIDs, or credentials.
