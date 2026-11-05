-- REVIEW ONLY — DO NOT RUN. Staging preparation candidate, NOT a production migration.
-- Phase A: create an approved-member public-safe projection. Do not revoke the
-- original member_profiles directory policy in this phase. No Meet changes.
-- Requires explicit staging authorization and negative RLS tests.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.member_profiles') IS NULL THEN
    RAISE EXCEPTION 'Expected member_profiles source table is missing';
  END IF;
  IF to_regclass('public.member_public_profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'Public member projection already exists; review drift before proceeding';
  END IF;
END;
$preflight$;

CREATE SCHEMA IF NOT EXISTS dominionstar_private;
REVOKE ALL ON SCHEMA dominionstar_private FROM PUBLIC, anon, authenticated;

-- Only explicitly shareable professional identity data may live here.
-- Do NOT include email, phone, address, Agent Code, SMD assignment,
-- internal account notes or administrative authorization flags.
CREATE TABLE public.member_public_profiles (
  id uuid PRIMARY KEY REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  preferred_name text,
  rank text NOT NULL,
  founding_member boolean NOT NULL DEFAULT false,
  exclusive_member_number integer,
  avatar_path text,
  city text,
  state text,
  verification_status text NOT NULL DEFAULT 'approved'
    CHECK (verification_status='approved')
);
ALTER TABLE public.member_public_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_public_profiles TO authenticated;

CREATE POLICY "approved members may see opted-in directory identities"
ON public.member_public_profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.member_profiles viewer
    WHERE viewer.id=(SELECT auth.uid())
      AND viewer.verification_status='approved'
  )
  OR (SELECT public.is_dominionstar_founder())
);

CREATE OR REPLACE FUNCTION dominionstar_private.sync_member_public_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
BEGIN
  IF NEW.verification_status='approved'
    AND NEW.profile_visibility='members' THEN
    INSERT INTO public.member_public_profiles (
      id,full_name,preferred_name,rank,founding_member,
      exclusive_member_number,avatar_path,city,state,verification_status
    ) VALUES (
      NEW.id,NEW.full_name,NEW.preferred_name,NEW.rank,
      NEW.founding_member,NEW.exclusive_member_number,NEW.avatar_path,
      NEW.city,NEW.state,'approved'
    )
    ON CONFLICT(id) DO UPDATE SET
      full_name=EXCLUDED.full_name,
      preferred_name=EXCLUDED.preferred_name,
      rank=EXCLUDED.rank,
      founding_member=EXCLUDED.founding_member,
      exclusive_member_number=EXCLUDED.exclusive_member_number,
      avatar_path=EXCLUDED.avatar_path,
      city=EXCLUDED.city,
      state=EXCLUDED.state,
      verification_status='approved';
  ELSE
    DELETE FROM public.member_public_profiles WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION dominionstar_private.sync_member_public_profile()
  FROM PUBLIC, anon, authenticated;

-- Source remains authoritative; updates from Profile, Settings, and Founder
-- Admin will automatically project only opted-in, approved identities.
CREATE TRIGGER member_profiles_sync_public_directory
AFTER INSERT OR UPDATE ON public.member_profiles
FOR EACH ROW EXECUTE FUNCTION dominionstar_private.sync_member_public_profile();

-- Preserve existing opt-outs from the old Settings interface before
-- building the new projection. Legacy preferences lived in user-editable
-- Auth metadata and were NOT an authorization policy. Here 'false' is
-- respected ONLY to restrict visibility; user metadata never grants access.
-- Do not publish a profile when either legacy or server preference is private.
UPDATE public.member_profiles p
SET profile_visibility='private'
FROM auth.users u
WHERE u.id=p.id
  AND p.profile_visibility='members'
  AND u.raw_user_meta_data #>> '{dominionstar_settings,privacy,directoryVisible}' = 'false';

INSERT INTO public.member_public_profiles (
  id,full_name,preferred_name,rank,founding_member,
  exclusive_member_number,avatar_path,city,state,verification_status
)
SELECT p.id,p.full_name,p.preferred_name,p.rank,p.founding_member,
       p.exclusive_member_number,p.avatar_path,p.city,p.state,'approved'
FROM public.member_profiles p
WHERE p.verification_status='approved' AND p.profile_visibility='members';

-- A controlled route for members to change their server-authoritative
-- directory visibility. The current user_metadata toggle is NOT RLS authority.
CREATE OR REPLACE FUNCTION public.set_my_member_directory_visibility(
  target_visibility text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE saved text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF target_visibility NOT IN ('members','private') THEN
    RAISE EXCEPTION 'Unsupported directory visibility';
  END IF;
  UPDATE public.member_profiles
  SET profile_visibility=target_visibility
  WHERE id=auth.uid() AND verification_status='approved'
  RETURNING profile_visibility INTO saved;
  IF saved IS NULL THEN RAISE EXCEPTION 'Approved membership required'; END IF;
  RETURN saved;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_my_member_directory_visibility(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_member_directory_visibility(text)
  TO authenticated, service_role;

-- Feed and Chat are SECURITY DEFINER RPCs; they must not bypass members'
-- visibility preferences by joining raw member_profiles for author identity.
-- Existing function signatures are preserved for current consumers.
CREATE OR REPLACE FUNCTION public.list_community_feed(
  result_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,user_id uuid,title text,body text,post_type text,
  is_pinned boolean,is_locked boolean,is_deleted boolean,
  created_at timestamptz,author_full_name text,
  author_preferred_name text,author_rank text,
  author_exclusive_number integer,author_avatar_path text
)
LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $function$
  SELECT message.id,message.user_id,message.title,message.body,
         message.post_type,message.is_pinned,message.is_locked,
         message.is_deleted,message.created_at,
         profile.full_name,profile.preferred_name,profile.rank,
         profile.exclusive_member_number,profile.avatar_path
  FROM public.community_messages message
  LEFT JOIN public.member_public_profiles profile
    ON profile.id=message.user_id
  WHERE message.is_deleted=false
    AND EXISTS (
      SELECT 1 FROM public.member_profiles viewer
      WHERE viewer.id=auth.uid() AND viewer.verification_status='approved'
    )
  ORDER BY message.is_pinned DESC,message.created_at DESC
  LIMIT greatest(1,least(coalesce(result_limit,100),200));
$function$;

CREATE OR REPLACE FUNCTION public.list_community_chat(
  result_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,user_id uuid,body text,reply_to uuid,is_deleted boolean,
  created_at timestamptz,author_full_name text,
  author_preferred_name text,author_rank text,
  author_exclusive_number integer,author_avatar_path text
)
LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $function$
  SELECT chat.id,chat.user_id,chat.body,chat.reply_to,
         chat.is_deleted,chat.created_at,profile.full_name,
         profile.preferred_name,profile.rank,
         profile.exclusive_member_number,profile.avatar_path
  FROM public.community_chat_messages chat
  LEFT JOIN public.member_public_profiles profile
    ON profile.id=chat.user_id
  WHERE chat.is_deleted=false
    AND EXISTS (
      SELECT 1 FROM public.member_profiles viewer
      WHERE viewer.id=auth.uid() AND viewer.verification_status='approved'
    )
  ORDER BY chat.created_at ASC
  LIMIT greatest(1,least(coalesce(result_limit,200),500));
$function$;

-- Existing EXECUTE grants for the two community RPCs are preserved by
-- CREATE OR REPLACE, and must be reviewed separately; do NOT grant to anon.

DO $verify$
DECLARE source_count bigint;
DECLARE projected_count bigint;
BEGIN
  SELECT count(*) INTO source_count FROM public.member_profiles
    WHERE verification_status='approved' AND profile_visibility='members';
  SELECT count(*) INTO projected_count FROM public.member_public_profiles;
  IF source_count<>projected_count THEN
    RAISE EXCEPTION 'Directory projection backfill mismatch';
  END IF;
  IF has_table_privilege('anon','public.member_public_profiles','SELECT')
     OR NOT has_table_privilege('authenticated','public.member_public_profiles','SELECT')
     OR has_table_privilege('authenticated','public.member_public_profiles','UPDATE')
     OR has_function_privilege('anon','public.set_my_member_directory_visibility(text)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Public-safe projection privileges failed verification';
  END IF;
END;
$verify$;
COMMIT;

-- After staging preflight, test as: anon, pending, approved A, approved B, Founder.
-- Verify private profiles disappear from directory, Feed, Chat and caller UI.
-- Verify editing names/photos synchronizes without leaking private fields.
-- Verify no actual member data is exported during audits.
-- DO NOT execute on production. See docs/AGENT_OS_P0_PRIVACY_RELEASE_GATE.md.
