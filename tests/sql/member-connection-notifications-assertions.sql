-- Disposable synthetic PostgreSQL tests: connection event source integrity.
-- Must run AFTER member privacy projection, connection RLS and event-trigger draft.
-- Never execute against a connected Supabase project.
\set ON_ERROR_STOP on

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

-- A new approved request to an approved visible member is the only alert source.
INSERT INTO public.member_connections(
  id,requester_id,recipient_id,status
) VALUES (
  '41000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000011','pending'
);

-- A cannot see B's request in A's RLS-protected executive inbox.
DO $private_inbox$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.executive_events
    WHERE payload->>'connection_id'='41000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Requester can read recipient-only connection alert';
  END IF;
END;
$private_inbox$;

-- A cannot forge the recipient's connection event through normal Data API RLS.
DO $deny_browser_spoof$
BEGIN
  BEGIN
    INSERT INTO public.executive_events(
      member_id,actor_id,event_type,title
    ) VALUES (
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000001',
      'connection.request','Forged connection alert'
    );
    RAISE EXCEPTION 'P0: member-created cross-member connection alert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_browser_spoof$;

SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000011',false);
DO $request_received$
BEGIN
  IF (SELECT count(*) FROM public.executive_events
    WHERE member_id=auth.uid()
      AND event_type='connection.request'
      AND payload->>'connection_id'='41000000-0000-4000-8000-000000000001'
      AND payload->>'action_url'='/member-directory/'
      AND priority='normal')<>1
  THEN RAISE EXCEPTION 'Recipient did not receive one trusted request alert'; END IF;
  IF NOT public.respond_my_member_connection(
    '41000000-0000-4000-8000-000000000001','accepted'
  ) THEN RAISE EXCEPTION 'Recipient could not accept verified request'; END IF;
END;
$request_received$;

SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $acceptance_received$
BEGIN
  IF (SELECT count(*) FROM public.executive_events
    WHERE member_id=auth.uid()
      AND event_type='connection.accepted'
      AND actor_id='00000000-0000-4000-8000-000000000011'
      AND payload->>'connection_id'='41000000-0000-4000-8000-000000000001'
      AND payload->>'action_url'='/member-directory/'
      AND priority='normal')<>1
  THEN RAISE EXCEPTION 'Requester did not receive one trusted acceptance alert'; END IF;
END;
$acceptance_received$;

-- Decline is deliberately silent: no decline notification or acceptance.
INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
VALUES(
  '41000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000012','pending'
);
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000012',false);
SELECT public.respond_my_member_connection(
 '41000000-0000-4000-8000-000000000002','declined'
);
RESET ROLE;

-- The owner bypass below deliberately simulates a privileged source state,
-- not a browser action. It must not create forged or repeated notifications.
UPDATE public.member_connections SET status='accepted'
WHERE id='41000000-0000-4000-8000-000000000001';

INSERT INTO public.member_connections(id,requester_id,recipient_id,status)
VALUES
(
  '41000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002','pending'
),
(
  '41000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000013','pending'
),
(
  '41000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000014','accepted'
);

DO $all_source_assertions$
BEGIN
  IF (SELECT count(*) FROM public.executive_events WHERE
    event_type='connection.request'
    AND payload->>'connection_id'='41000000-0000-4000-8000-000000000001')<>1
  THEN RAISE EXCEPTION 'Original request event duplicated'; END IF;
  IF (SELECT count(*) FROM public.executive_events WHERE
    event_type='connection.accepted'
    AND payload->>'connection_id'='41000000-0000-4000-8000-000000000001')<>1
  THEN RAISE EXCEPTION 'Replayed acceptance event'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.executive_events WHERE
    event_type LIKE 'connection.%' AND payload->>'connection_id' IN (
      '41000000-0000-4000-8000-000000000003',
      '41000000-0000-4000-8000-000000000004',
      '41000000-0000-4000-8000-000000000005')
  ) THEN RAISE EXCEPTION 'Private/pending/preaccepted source forged a notification'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.executive_events WHERE
      event_type='connection.accepted'
      AND payload->>'connection_id'='41000000-0000-4000-8000-000000000002'
  ) THEN RAISE EXCEPTION 'Declined connection generated acceptance'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.executive_events WHERE event_type LIKE 'connection.%'
    GROUP BY member_id,event_type,(payload->>'connection_id')
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Duplicate connection source event'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.executive_events
    WHERE event_type LIKE 'connection.%'
      AND (priority<>'normal' OR actor_id IS NULL
        OR payload->>'action_url'<>'/member-directory/')
  ) THEN RAISE EXCEPTION 'Connection alert violates priority/actor/action gate'; END IF;
  IF has_function_privilege('anon',
      'dominionstar_private.emit_connection_notifications()'::regprocedure,
      'EXECUTE')
    OR has_function_privilege('authenticated',
      'dominionstar_private.emit_connection_notifications()'::regprocedure,
      'EXECUTE')
  THEN RAISE EXCEPTION 'Connection trigger callable by browser roles'; END IF;
END;
$all_source_assertions$;

SELECT 'CONNECTION_SOURCE_EVENT_POSTGRES_INTEGRATION_PASS' AS result;
