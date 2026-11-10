-- Disposable synthetic PostgreSQL connection integrity tests.
-- Requires fixture, public projection prepare/enforce, connection migration.
\set ON_ERROR_STOP on

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

-- Approved A may invite approved visible C, pending only.
INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
VALUES(
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003','pending'
);

-- The original directional UNIQUE constraint misses the reciprocal C→A.
-- With both approved and public-safe, only unordered pair uniqueness can
-- prevent two parallel connection requests and duplicate notifications.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',false);
DO $deny_reciprocal_invite$
BEGIN
  BEGIN
    INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
    VALUES(
      '40000000-0000-4000-8000-000000000008',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001','pending'
    );
    RAISE EXCEPTION 'P0: reciprocal connection bypassed pair uniqueness';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END;
$deny_reciprocal_invite$;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

DO $deny_preaccepted$
BEGIN
  BEGIN
    INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
    VALUES(
      '40000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000010','accepted'
    );
    RAISE EXCEPTION 'P0: preaccepted connection inserted by requester';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_preaccepted$;

DO $deny_self_connect$
BEGIN
  BEGIN
    INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
    VALUES(
      '40000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001','pending'
    );
    RAISE EXCEPTION 'P0: self-invitation inserted';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
END;
$deny_self_connect$;

DO $deny_direct_status$
BEGIN
  BEGIN
    UPDATE public.member_connections SET status='accepted'
      WHERE id='40000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'P0: direct status UPDATE is allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    DELETE FROM public.member_connections
      WHERE id='40000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'P0: direct connection DELETE is allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_direct_status$;

DO $deny_requester_response$
BEGIN
  IF public.respond_my_member_connection(
    '40000000-0000-4000-8000-000000000001','accepted'
  ) THEN RAISE EXCEPTION 'P0: requester accepted own invitation'; END IF;
END;
$deny_requester_response$;

-- Unrelated approved B cannot respond/cancel A -> C.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',false);
DO $deny_unrelated$
BEGIN
  IF public.respond_my_member_connection(
    '40000000-0000-4000-8000-000000000001','declined'
  ) THEN RAISE EXCEPTION 'P0: unrelated member declined invitation'; END IF;
  IF public.cancel_my_member_connection(
    '40000000-0000-4000-8000-000000000001'
  ) THEN RAISE EXCEPTION 'P0: unrelated member cancelled invitation'; END IF;
END;
$deny_unrelated$;

-- Recipient C accepts only their pending invitation.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',false);
DO $accept_once$
BEGIN
  IF NOT public.respond_my_member_connection(
    '40000000-0000-4000-8000-000000000001','accepted'
  ) THEN RAISE EXCEPTION 'Recipient could not accept pending connection'; END IF;
  IF public.respond_my_member_connection(
    '40000000-0000-4000-8000-000000000001','declined'
  ) THEN RAISE EXCEPTION 'Recipient changed already accepted connection'; END IF;
  BEGIN
    PERFORM public.respond_my_member_connection(
      '40000000-0000-4000-8000-000000000001','blocked'
    );
    RAISE EXCEPTION 'Invalid connection response status allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Unsupported connection response' THEN RAISE; END IF;
  END;
END;
$accept_once$;

-- Requester A cannot cancel a connection that is already accepted.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $deny_cancel_accepted$
BEGIN
  IF public.cancel_my_member_connection(
    '40000000-0000-4000-8000-000000000001'
  ) THEN RAISE EXCEPTION 'Requester cancelled an accepted connection'; END IF;
END;
$deny_cancel_accepted$;

-- B has opted out of public directory; the approved-but-private target
-- must not be invited through the public Members UI.
DO $deny_private_directory_invite$
BEGIN
  BEGIN
    INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
    VALUES(
      '40000000-0000-4000-8000-000000000007',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002','pending'
    );
    RAISE EXCEPTION 'P0: hidden member can receive new directory invitation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_private_directory_invite$;

-- A can invite and cancel a separate pending invitation to visible founder F.
INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
VALUES(
  '40000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000010','pending'
);
DO $cancel_pending$
BEGIN
  IF NOT public.cancel_my_member_connection(
    '40000000-0000-4000-8000-000000000004'
  ) THEN RAISE EXCEPTION 'Pending requester could not cancel own invitation'; END IF;
  IF public.cancel_my_member_connection(
    '40000000-0000-4000-8000-000000000004'
  ) THEN RAISE EXCEPTION 'Deleted invitation cancelled twice'; END IF;
END;
$cancel_pending$;

-- A cannot invite an unapproved member after Founder reset their status.
RESET ROLE;
UPDATE public.member_profiles SET verification_status='pending'
WHERE id='00000000-0000-4000-8000-000000000005';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $deny_unapproved_target$
BEGIN
  BEGIN
    INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
    VALUES(
      '40000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000005','pending'
    );
    RAISE EXCEPTION 'P0: invitation to unapproved member allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_unapproved_target$;

-- Unapproved requester cannot invite an approved recipient.
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',false);
DO $deny_unapproved_requester$
BEGIN
  BEGIN
    INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
    VALUES(
      '40000000-0000-4000-8000-000000000006',
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000001','pending'
    );
    RAISE EXCEPTION 'P0: pending member initiated invitation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.respond_my_member_connection(
      '40000000-0000-4000-8000-000000000001','accepted'
    );
    RAISE EXCEPTION 'P0: unapproved member invoked accepted response';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Approved membership required' THEN RAISE; END IF;
  END;
END;
$deny_unapproved_requester$;

RESET ROLE;
SET ROLE anon;
DO $deny_anon_rpcs$
BEGIN
  BEGIN
    PERFORM public.respond_my_member_connection(
      '40000000-0000-4000-8000-000000000001','accepted'
    );
    RAISE EXCEPTION 'P0: anon executed respond RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.cancel_my_member_connection(
      '40000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'P0: anon executed cancel RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_anon_rpcs$;
RESET ROLE;

DO $verify_connection_state$
BEGIN
  IF (SELECT status FROM public.member_connections
    WHERE id='40000000-0000-4000-8000-000000000001')<>'accepted'
  THEN RAISE EXCEPTION 'Final accepted connection state changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.member_connections
    WHERE id='40000000-0000-4000-8000-000000000004')
  THEN RAISE EXCEPTION 'Cancelled pending connection remains'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='member_connections'
      AND indexname='member_connections_unordered_pair_once_idx'
  ) THEN RAISE EXCEPTION 'Unordered connection pair uniqueness index missing'; END IF;
  IF has_table_privilege('authenticated','public.member_connections','UPDATE')
    OR has_table_privilege('authenticated','public.member_connections','DELETE')
  THEN RAISE EXCEPTION 'Broad member connection write privileges remain'; END IF;
END;
$verify_connection_state$;

SELECT 'MEMBER_CONNECTION_POSTGRES_INTEGRATION_PASS' AS result;
