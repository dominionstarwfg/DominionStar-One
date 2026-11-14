-- TEST ONLY: assert real PostgreSQL one-choice reaction semantics after archive.
\set ON_ERROR_STOP on

DO $verify_archival$
DECLARE archived integer;retained integer;
BEGIN
  SELECT count(*) INTO archived
  FROM dominionstar_private.community_reactions_archived;
  SELECT count(*) INTO retained FROM public.community_reactions;
  IF archived<>3 OR retained<>6 THEN
    RAISE EXCEPTION 'Archive/retained totals wrong: % archived, % live',
      archived,retained;
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.community_reactions
    WHERE id='30000000-0000-4000-8000-000000000003'
      AND reaction='insightful'
  ) OR EXISTS(
    SELECT 1 FROM public.community_reactions
    WHERE id IN('30000000-0000-4000-8000-000000000001',
                '30000000-0000-4000-8000-000000000002')
  ) THEN RAISE EXCEPTION 'Newest reaction was not preserved'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.community_reactions
    GROUP BY message_id,user_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'One-reaction unique invariant failed'; END IF;
  IF has_function_privilege('anon',
    'public.community_toggle_reaction(uuid,text)'::regprocedure,'EXECUTE')
  THEN RAISE EXCEPTION 'Anonymous reaction RPC permission remains'; END IF;
END;
$verify_archival$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

-- A already had "insightful" on post 1001.
-- Changing to Love must replace the row, never add another.
SELECT public.community_toggle_reaction(
  '10000000-0000-4000-8000-000000000001','love'
);
DO $verify_love$
BEGIN
  IF (SELECT count(*) FROM public.community_reactions WHERE
    message_id='10000000-0000-4000-8000-000000000001'
    AND user_id='00000000-0000-4000-8000-000000000001'
    AND reaction='love')<>1
  THEN RAISE EXCEPTION 'Love did not replace prior reaction'; END IF;
  IF (SELECT count(*) FROM public.community_reactions WHERE
    message_id='10000000-0000-4000-8000-000000000001'
    AND user_id='00000000-0000-4000-8000-000000000001')<>1
  THEN RAISE EXCEPTION 'A has duplicate reactions after Love'; END IF;
END;
$verify_love$;

-- Clicking the selected choice again should remove the reaction.
SELECT public.community_toggle_reaction(
  '10000000-0000-4000-8000-000000000001','love'
);
DO $verify_toggle_off$
BEGIN
  IF EXISTS(SELECT 1 FROM public.community_reactions
    WHERE message_id='10000000-0000-4000-8000-000000000001'
      AND user_id='00000000-0000-4000-8000-000000000001')
  THEN RAISE EXCEPTION 'Same choice failed to toggle off'; END IF;
END;
$verify_toggle_off$;

-- And the member can choose Support, then Like, without a second row.
SELECT public.community_toggle_reaction(
  '10000000-0000-4000-8000-000000000001','support'
);
SELECT public.community_toggle_reaction(
  '10000000-0000-4000-8000-000000000001','like'
);
DO $verify_change$
BEGIN
  IF (SELECT count(*) FROM public.community_reactions WHERE
    message_id='10000000-0000-4000-8000-000000000001'
    AND user_id='00000000-0000-4000-8000-000000000001'
    AND reaction='like')<>1
  THEN RAISE EXCEPTION 'Support -> Like replacement failed'; END IF;
  IF (SELECT count(*) FROM public.community_reactions WHERE
    message_id='10000000-0000-4000-8000-000000000001'
    AND user_id='00000000-0000-4000-8000-000000000002'
    AND reaction='like')<>1
  THEN RAISE EXCEPTION 'B reaction changed when A chose Like'; END IF;
END;
$verify_change$;

-- Direct second reaction insertion must fail at the UNIQUE constraint.
DO $verify_direct_duplicate$
BEGIN
  BEGIN
    INSERT INTO public.community_reactions(message_id,user_id,reaction)
    VALUES(
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'celebrate'
    );
    RAISE EXCEPTION 'P0: inserted second reaction for same member/post';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END;
$verify_direct_duplicate$;

-- A must not be allowed to directly mutate B's reaction row (no UPDATE ACL).
DO $verify_peer_update$
BEGIN
  BEGIN
    UPDATE public.community_reactions SET reaction='support'
    WHERE user_id='00000000-0000-4000-8000-000000000002'
      AND message_id='10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'P0: a member updated another reaction directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$verify_peer_update$;

-- Pending E may not use the authenticated RPC.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',false);
DO $verify_pending$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.community_toggle_reaction(
      '10000000-0000-4000-8000-000000000001','like'
    );
  EXCEPTION WHEN raise_exception THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'P0: unapproved member reacted'; END IF;
END;
$verify_pending$;

-- Approved A cannot react to an unavailable/deleted post.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $verify_deleted$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.community_toggle_reaction(
      '10000000-0000-4000-8000-000000000003','like'
    );
  EXCEPTION WHEN raise_exception THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'P0: reacted to deleted post'; END IF;
END;
$verify_deleted$;

-- Agent cannot read the private audit table.
DO $verify_private_archive$
BEGIN
  BEGIN
    PERFORM count(*) FROM dominionstar_private.community_reactions_archived;
    RAISE EXCEPTION 'P0: agent can read private reaction archive';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$verify_private_archive$;

RESET ROLE;
SET ROLE anon;
DO $verify_anon$
BEGIN
  BEGIN
    PERFORM public.community_toggle_reaction(
      '10000000-0000-4000-8000-000000000001','like'
    );
    RAISE EXCEPTION 'P0: anonymous caller reached reaction RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$verify_anon$;
RESET ROLE;

DO $verify_final$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.community_reactions
    GROUP BY message_id,user_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Final duplicate reaction invariant failed'; END IF;
  IF (SELECT count(*) FROM dominionstar_private.community_reactions_archived)<>3
  THEN RAISE EXCEPTION 'Private legacy audit history changed unexpectedly'; END IF;
END;
$verify_final$;

SELECT 'COMMUNITY_SINGLE_REACTION_POSTGRES_INTEGRATION_PASS' AS result;
