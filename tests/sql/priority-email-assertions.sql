-- Real Postgres trigger checks with synthetic events and synthetic Auth users.
-- No Resend, no outbound API, no email sent, no production member data.
\set ON_ERROR_STOP on

-- An arbitrary authenticated user may create their own notification event,
-- but cannot cause an email by claiming a high priority or official type.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
INSERT INTO public.executive_events(
  id,member_id,actor_id,event_type,title,description,priority
) VALUES
('70000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'security.alert','Forged self security alert','Synthetic spoof','critical'),
('70000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'founder.urgent','Forged self founder alert','Synthetic spoof','critical'),
('70000000-0000-4000-8000-000000000003',
 '00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'community.like','A routine like','In-app only','high'),
('70000000-0000-4000-8000-000000000004',
 '00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'unknown.critical','Unknown event','In-app only','critical');
RESET ROLE;

-- Official server-created priority notices and appointments queue; low/normal
-- events do not. Auth 5 is intentionally unverified, and Auth 3 opted out.
INSERT INTO public.executive_events(
  id,member_id,actor_id,event_type,title,description,priority,payload
) VALUES
('70000000-0000-4000-8000-000000000005',
 '00000000-0000-4000-8000-000000000002',
 NULL,'account.approved','Account approved','Synthetic official notice','high',
 '{"action_url":"/account-settings/"}'),
('70000000-0000-4000-8000-000000000006',
 '00000000-0000-4000-8000-000000000002',
 NULL,'appointment.confirmed','Confirmed appointment','Synthetic confirmed appointment','normal','{}'),
('70000000-0000-4000-8000-000000000007',
 '00000000-0000-4000-8000-000000000005',
 NULL,'appointment.confirmed','Unverified recipient','Must not queue','normal','{}'),
('70000000-0000-4000-8000-000000000008',
 '00000000-0000-4000-8000-000000000003',
 NULL,'appointment.cancelled','Global opted-out','Must not queue','normal','{}'),
('70000000-0000-4000-8000-000000000009',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000010',
 'founder.urgent','Founder urgent notice','Synthetic urgent notice','high','{}'),
('70000000-0000-4000-8000-000000000010',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000010',
 'founder.announcement','Routine founder notice','In-app only','normal','{}'),
('70000000-0000-4000-8000-000000000011',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'founder.urgent','Forged cross-member founder','Must not queue','high','{}'),
('70000000-0000-4000-8000-000000000012',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000010',
 'founder.announcement','Important founder notice','Synthetic high notice','high','{}'),
('70000000-0000-4000-8000-000000000013',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'message.received','Member message','Recipient has message emails disabled','normal',
 '{"message_id":"50000000-0000-4000-8000-000000000001"}');

-- A pre-existing source is necessary, but insufficient: the member also has
-- to opt into message email and source sender/recipient must match the event.
UPDATE public.notification_preferences SET messages_email_enabled=true
WHERE user_id='00000000-0000-4000-8000-000000000002';

INSERT INTO public.executive_events(
  id,member_id,actor_id,event_type,title,description,priority,payload
) VALUES
('70000000-0000-4000-8000-000000000014',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'message.received','Verified source message','Synthetic inbox alert','normal',
 '{"message_id":"50000000-0000-4000-8000-000000000001"}'),
('70000000-0000-4000-8000-000000000015',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000010',
 'message.received','Wrong actor for same message','Must not queue','normal',
 '{"message_id":"50000000-0000-4000-8000-000000000001"}'),
('70000000-0000-4000-8000-000000000016',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'call.missed','Genuine missed call','Synthetic verified call source','normal',
 '{"call_id":"60000000-0000-4000-8000-000000000001"}');

-- Priority category opt-out for appointments is separate from the global
-- selected-email switch.
UPDATE public.notification_preferences
SET appointments_email_enabled=false
WHERE user_id='00000000-0000-4000-8000-000000000002';
INSERT INTO public.executive_events(
  id,member_id,actor_id,event_type,title,description,priority
) VALUES(
 '70000000-0000-4000-8000-000000000017',
 '00000000-0000-4000-8000-000000000002',
 NULL,'appointment.rescheduled','Appointment changed','Must not queue','high'
);

-- Every posted mention/reply begins as an in-app event. Email is suppressed
-- until explicitly opted in, even when source rows and targets are genuine.
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
 '71000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'Hello @Ann, a routine Community mention without email opt-in.'
);

UPDATE public.notification_preferences SET community_email_enabled=true
WHERE user_id='00000000-0000-4000-8000-000000000002';
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
 '71000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'Hello @Ann, this mention has explicit email opt-in.'
);

-- B is the post author; A comments on B's post. The genuine reply should
-- enqueue only with B's community email opt-in and source relationships.
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
 '71000000-0000-4000-8000-000000000003',
 '00000000-0000-4000-8000-000000000002',
 'Synthetic post authored by Ann.'
);
INSERT INTO public.community_comments(id,message_id,user_id,body)
VALUES(
 '72000000-0000-4000-8000-000000000001',
 '71000000-0000-4000-8000-000000000003',
 '00000000-0000-4000-8000-000000000001',
 'Reply on the source post.'
);

-- Inbound forged event claims with nonexistent source IDs cannot queue.
INSERT INTO public.executive_events(
  id,member_id,actor_id,event_type,title,description,priority,payload
) VALUES(
 '70000000-0000-4000-8000-000000000018',
 '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'community.mention','Fake mention','Not backed by source','high',
 '{"source_id":"00000000-0000-4000-8000-000000999999","post_id":"00000000-0000-4000-8000-000000999999","source_type":"post"}'
);

-- Dedupe: existing queue key is unchanged even if an event is replayed.
DELETE FROM public.executive_events
WHERE id='70000000-0000-4000-8000-000000000005';
INSERT INTO public.executive_events(
  id,member_id,actor_id,event_type,title,description,priority
) VALUES(
 '70000000-0000-4000-8000-000000000005',
 '00000000-0000-4000-8000-000000000002',
 NULL,'account.approved','Same official event ID','Replay must not double queue','high'
);

-- As ordinary member A, a self-authored alert cannot become email.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
DO $deny_direct_outbox$
BEGIN
  BEGIN
    PERFORM 1 FROM public.email_notification_outbox;
    RAISE EXCEPTION 'P0: member can see email outbox';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.queue_member_event_email();
    RAISE EXCEPTION 'P0: member can invoke email queue trigger';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$deny_direct_outbox$;
RESET ROLE;

DO $verify_outbox$
DECLARE
  expected uuid[]:=ARRAY[
    '70000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000009',
    '70000000-0000-4000-8000-000000000012',
    '70000000-0000-4000-8000-000000000014',
    '70000000-0000-4000-8000-000000000016'
  ]::uuid[];
  id uuid;
  actual integer;
  missing integer;
BEGIN
  FOREACH id IN ARRAY expected LOOP
    SELECT count(*) INTO actual FROM public.email_notification_outbox
    WHERE dedupe_key='event:'||id::text;
    IF actual<>1 THEN RAISE EXCEPTION 'Eligible event % queued % instead of 1',id,actual; END IF;
  END LOOP;

  SELECT count(*) INTO actual FROM public.email_notification_outbox
  WHERE dedupe_key LIKE 'event:70000000-%';
  IF actual<>array_length(expected,1) THEN
    RAISE EXCEPTION 'Routine/spoof/opt-out email wrongly queued: count %',actual;
  END IF;

  SELECT count(*) INTO actual FROM public.email_notification_outbox
  WHERE event_type='community.mention'
    AND dedupe_key IN (
      SELECT 'event:'||e.id::text FROM public.executive_events e
      WHERE e.event_type='community.mention'
        AND e.payload->>'post_id'='71000000-0000-4000-8000-000000000002'
    );
  IF actual<>1 THEN RAISE EXCEPTION 'Eligible opted-in mention not queued exactly once'; END IF;

  SELECT count(*) INTO actual FROM public.email_notification_outbox
  WHERE event_type='community.mention'
    AND dedupe_key IN (
      SELECT 'event:'||e.id::text FROM public.executive_events e
      WHERE e.event_type='community.mention'
        AND e.payload->>'post_id'='71000000-0000-4000-8000-000000000001'
    );
  IF actual<>0 THEN RAISE EXCEPTION 'Opted-out mention incorrectly emailed'; END IF;

  SELECT count(*) INTO actual FROM public.email_notification_outbox
  WHERE event_type='community.reply'
    AND dedupe_key IN (
      SELECT 'event:'||e.id::text FROM public.executive_events e
      WHERE e.event_type='community.reply'
        AND e.payload->>'source_id'='72000000-0000-4000-8000-000000000001'
    );
  IF actual<>1 THEN RAISE EXCEPTION 'Genuine opted-in reply not queued once'; END IF;

  IF EXISTS(SELECT 1 FROM public.email_notification_outbox
    WHERE recipient_id='00000000-0000-4000-8000-000000000005'
       OR recipient_id='00000000-0000-4000-8000-000000000003'
       OR recipient_email NOT LIKE 'synthetic-user-%@example.invalid')
  THEN RAISE EXCEPTION 'Unverified/opted-out or untrusted recipient was queued'; END IF;

  IF EXISTS(SELECT 1 FROM public.email_notification_outbox
    GROUP BY dedupe_key HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Duplicate outbox rows'; END IF;
END;
$verify_outbox$;

SELECT 'PRIORITY_EMAIL_POSTGRES_INTEGRATION_PASS' AS result;
