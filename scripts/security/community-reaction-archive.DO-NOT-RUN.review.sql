-- REVIEW ONLY — DO NOT RUN. Explicit archival option for legacy multi-reactions.
-- Do NOT run in production without a reviewed migration, user authorization,
-- and verified staging rollback. This intentionally changes reaction rows.
-- Retain the newest reaction per member/post (created_at, id tie-break).
-- All older reactions are copied to private history BEFORE deleting any row.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.community_reactions') IS NULL
     OR to_regclass('public.member_profiles') IS NULL
  THEN RAISE EXCEPTION 'Expected reaction schema missing'; END IF;
END;
$preflight$;

CREATE SCHEMA IF NOT EXISTS dominionstar_private;
REVOKE ALL ON SCHEMA dominionstar_private FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS dominionstar_private.community_reactions_archived (
  id uuid PRIMARY KEY,
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'single-choice migration: superseded reaction'
);
REVOKE ALL ON dominionstar_private.community_reactions_archived
  FROM PUBLIC,anon,authenticated;

WITH ranked AS (
  SELECT id,ROW_NUMBER() OVER(
    PARTITION BY message_id,user_id ORDER BY created_at DESC,id DESC
  ) AS position
  FROM public.community_reactions
)
INSERT INTO dominionstar_private.community_reactions_archived(
  id,message_id,user_id,reaction,created_at
)
SELECT r.id,r.message_id,r.user_id,r.reaction,r.created_at
FROM public.community_reactions r
JOIN ranked k ON k.id=r.id WHERE k.position>1
ON CONFLICT(id) DO NOTHING;

DO $verify_archive$
DECLARE expected integer;archived integer;
BEGIN
  SELECT count(*) INTO expected FROM (
    SELECT id,ROW_NUMBER() OVER(
      PARTITION BY message_id,user_id ORDER BY created_at DESC,id DESC
    ) AS position FROM public.community_reactions
  ) ranked WHERE position>1;
  SELECT count(*) INTO archived
  FROM public.community_reactions r
  WHERE r.id IN(
    SELECT x.id FROM(
      SELECT id,ROW_NUMBER() OVER(
        PARTITION BY message_id,user_id ORDER BY created_at DESC,id DESC
      ) position FROM public.community_reactions
    ) x WHERE x.position>1
  ) AND EXISTS(
    SELECT 1 FROM dominionstar_private.community_reactions_archived a
    WHERE a.id=r.id AND a.message_id=r.message_id
      AND a.user_id=r.user_id AND a.reaction=r.reaction
      AND a.created_at=r.created_at
  );
  IF expected<>archived THEN
    RAISE EXCEPTION 'Archive verification failed: expected %, archived %',expected,archived;
  END IF;
END;
$verify_archive$;

WITH ranked AS (
  SELECT id,ROW_NUMBER() OVER(
    PARTITION BY message_id,user_id ORDER BY created_at DESC,id DESC
  ) AS position FROM public.community_reactions
)
DELETE FROM public.community_reactions r USING ranked x
WHERE r.id=x.id AND x.position>1
  AND EXISTS(
    SELECT 1 FROM dominionstar_private.community_reactions_archived a
    WHERE a.id=r.id
  );

DO $verify$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.community_reactions
    GROUP BY message_id,user_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Duplicate reactions remain'; END IF;
END;
$verify$;
COMMIT;
-- Run the separate single-reaction schema/RPC cutover only AFTER the above
-- archival integrity is verified, and only in an authorized staging environment.
-- Production data is currently unchanged. Never auto-execute these SQL files.
