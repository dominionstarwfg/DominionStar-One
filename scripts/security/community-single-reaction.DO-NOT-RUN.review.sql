-- REVIEW ONLY — DO NOT RUN. DominionStar one-reaction-per-post repair.
-- Requires a separately approved staging database and explicit production release.
-- No migration is executed by this file's existence in GitHub.
-- IMPORTANT: production currently contains extra reaction rows. This migration
-- deliberately FAILS CLOSED until a separately approved archival cleanup.
BEGIN;

DO $preflight$
DECLARE duplicates integer;
BEGIN
  IF to_regclass('public.community_reactions') IS NULL
    OR to_regprocedure('public.community_toggle_reaction(uuid,text)') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.community_reactions'::regclass
        AND conname='community_reactions_message_id_user_id_reaction_key'
    )
  THEN
    RAISE EXCEPTION 'Expected reaction table, RPC or legacy constraint missing';
  END IF;
  SELECT count(*) INTO duplicates
  FROM (
    SELECT message_id,user_id FROM public.community_reactions
    GROUP BY message_id,user_id HAVING count(*)>1
  ) dupe_groups;
  IF duplicates>0 THEN
    RAISE EXCEPTION
      'Multiple stored reactions detected (% member/post groups). Review and archive before schema cutover',
      duplicates;
  END IF;
END;
$preflight$;

ALTER TABLE public.community_reactions
  DROP CONSTRAINT community_reactions_reaction_check;
ALTER TABLE public.community_reactions
  ADD CONSTRAINT community_reactions_reaction_check
  CHECK (reaction IN ('like','love','celebrate','support','insightful'));

-- One choice per member and post; different choice updates existing row.
-- This also protects against direct client inserts bypassing the reaction RPC.
ALTER TABLE public.community_reactions
  DROP CONSTRAINT community_reactions_message_id_user_id_reaction_key;
ALTER TABLE public.community_reactions
  ADD CONSTRAINT community_reactions_one_per_member_post
  UNIQUE (message_id,user_id);

CREATE OR REPLACE FUNCTION public.community_toggle_reaction(
  target_message_id uuid,target_reaction text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  member_id uuid:=auth.uid();
  existing_reaction text;
  reaction_count integer;
BEGIN
  IF member_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF target_message_id IS NULL OR
    target_reaction NOT IN ('like','love','celebrate','support','insightful')
  THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=member_id AND p.verification_status='approved'
  ) THEN
    RAISE EXCEPTION 'Approved member access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_messages m
    WHERE m.id=target_message_id AND m.is_deleted=false
  ) THEN
    RAISE EXCEPTION 'Post is unavailable';
  END IF;

  -- Serialize same-member post reaction changes across devices. The unique
  -- constraint remains the final invariant even on direct table requests.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_message_id::text||':'||member_id::text,0
    )
  );
  SELECT r.reaction INTO existing_reaction
  FROM public.community_reactions r
  WHERE r.message_id=target_message_id AND r.user_id=member_id;
  IF existing_reaction=target_reaction THEN
    DELETE FROM public.community_reactions
    WHERE message_id=target_message_id AND user_id=member_id;
  ELSE
    INSERT INTO public.community_reactions(message_id,user_id,reaction)
    VALUES(target_message_id,member_id,target_reaction)
    ON CONFLICT (message_id,user_id)
    DO UPDATE SET reaction=EXCLUDED.reaction;
  END IF;

  SELECT count(*) INTO reaction_count FROM public.community_reactions
  WHERE message_id=target_message_id AND reaction=target_reaction;
  RETURN reaction_count; -- Preserve existing RPC output type / caller contract.
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.community_toggle_reaction(uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_toggle_reaction(uuid,text)
  TO authenticated,service_role;

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.community_reactions'::regclass
      AND c.conname='community_reactions_one_per_member_post'
  ) OR has_function_privilege('anon',
      'public.community_toggle_reaction(uuid,text)'::regprocedure,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Reaction uniqueness or EXECUTE privileges failed';
  END IF;
END;
$verify$;
COMMIT;

-- ISOLATED STAGING AUTHORIZATION TESTS:
-- A reacts Like -> one row; A changes to Love -> still one row, now Love.
-- A clicks Love again -> zero rows, cleared reaction.
-- A changes from Love to Support -> one Support row.
-- Anonymous/unapproved member cannot invoke reaction RPC.
-- A cannot change member B's reaction; client caller identity comes from auth.uid().
-- Direct inserts of a second different reaction fail uniqueness.
-- Concurrent A on two sessions never creates two rows.
-- Deleted post rejects changes; regular post remains readable.
-- Community Hub and Feed show identical selected reaction and count.
-- Existing archived historical duplicate reactions remain queryable only by
-- tightly controlled admins, not by other agents.
-- If any test fails, stop. No automatic production rollback or merge.
