-- Isolated disposable PostgreSQL assertion suite. All identities synthetic.
-- If any assertion fails, psql exits nonzero; never contacts Supabase.
\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

-- Prefix matching: "@Annabelle" must not falsely alert "@Ann".
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Hello @Annabelle, @Private and @Pending, welcome.'
);
-- Repeated explicit @Ann mentions produce a single notification.
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Welcome @Ann. Please confirm, @Ann!'
);

SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',false);
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'Welcome to the new Community Feed.'
);

SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
-- B is the author and explicitly mentioned in the reply; send only a reply.
INSERT INTO public.community_comments(id,message_id,user_id,body)
VALUES(
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  'Thanks @Ann, I agree.'
);
-- Comment on B's post also mentions C: B gets reply, C gets mention.
INSERT INTO public.community_comments(id,message_id,user_id,body)
VALUES(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  'I will follow up with @Annabelle on this.'
);

-- Six valid mentions are deliberately capped at five.
INSERT INTO public.community_messages(id,user_id,body)
VALUES(
  '10000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  'Hi @Person10 @Person11 @Person12 @Person13 @Person14 @Person15'
);

-- A cannot view B's or C's notifications despite table-level SELECT grant.
DO $verify_member_inbox$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.executive_events
  ) THEN
    RAISE EXCEPTION 'P0: member A can see events belonging to B/C';
  END IF;
END;
$verify_member_inbox$;

-- A cannot spoof event insertion for B.
DO $verify_member_spoof$
BEGIN
  BEGIN
    INSERT INTO public.executive_events(
      member_id,actor_id,event_type,title,description
    ) VALUES(
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      'community.mention','Fake user alert','Spoofed by member A'
    );
    RAISE EXCEPTION 'P0: member created alert for a different member';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- RLS denial is required.
  END;
END;
$verify_member_spoof$;

-- Browser clients must never invoke the legacy arbitrary-message RPC.
DO $verify_legacy_rpc$
BEGIN
  BEGIN
    PERFORM public.community_notify_mentions(
      '10000000-0000-4000-8000-000000000003'::uuid,
      '@Ann and @Annabelle'
    );
    RAISE EXCEPTION 'P0: legacy arbitrary-text mention RPC executable';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$verify_legacy_rpc$;

-- An approved member may not author a post under another member's identity.
DO $verify_spoof_source$
BEGIN
  BEGIN
    INSERT INTO public.community_messages(id,user_id,body)
    VALUES(
      '10000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000002','Spoofed post @Annabelle'
    );
    RAISE EXCEPTION 'P0: author-spoofed post accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$verify_spoof_source$;
-- Pending member is refused a post (and cannot trigger mentions).
SELECT set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',false);
DO $verify_pending$
BEGIN
  BEGIN
    INSERT INTO public.community_messages(id,user_id,body)
    VALUES(
      '10000000-0000-4000-8000-000000000006',
      '00000000-0000-4000-8000-000000000005','Pending member @Annabelle'
    );
    RAISE EXCEPTION 'P0: pending member posted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$verify_pending$;
RESET ROLE;

-- Admin-only aggregate assertions; do not display any real member records.
DO $verify_results$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.mention'
     AND member_id='00000000-0000-4000-8000-000000000003'
     AND payload->>'source_id'='10000000-0000-4000-8000-000000000001';
  IF c<>1 THEN RAISE EXCEPTION '@Annabelle failed exact mention, count=%',c; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.mention'
     AND member_id='00000000-0000-4000-8000-000000000002'
     AND payload->>'source_id'='10000000-0000-4000-8000-000000000001';
  IF c<>0 THEN RAISE EXCEPTION '@Ann was incorrectly matched in @Annabelle'; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.mention'
     AND member_id='00000000-0000-4000-8000-000000000002'
     AND payload->>'source_id'='10000000-0000-4000-8000-000000000002';
  IF c<>1 THEN RAISE EXCEPTION 'Repeated @Ann generated % events',c; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.reply'
     AND member_id='00000000-0000-4000-8000-000000000002'
     AND payload->>'source_id'='20000000-0000-4000-8000-000000000001';
  IF c<>1 THEN RAISE EXCEPTION 'Comment did not generate one reply for author'; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.mention'
     AND member_id='00000000-0000-4000-8000-000000000002'
     AND payload->>'source_id'='20000000-0000-4000-8000-000000000001';
  IF c<>0 THEN RAISE EXCEPTION 'Author received reply and duplicate mention'; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.mention'
     AND member_id='00000000-0000-4000-8000-000000000003'
     AND payload->>'source_id'='20000000-0000-4000-8000-000000000002';
  IF c<>1 THEN RAISE EXCEPTION 'Comment mention to C missing'; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE event_type='community.mention'
     AND payload->>'source_id'='10000000-0000-4000-8000-000000000004';
  IF c<>5 THEN RAISE EXCEPTION 'Mention fanout cap failed: %',c; END IF;

  SELECT count(*) INTO c FROM public.executive_events
   WHERE member_id IN(
     '00000000-0000-4000-8000-000000000004',
     '00000000-0000-4000-8000-000000000005',
     '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000015'
   );
  IF c<>0 THEN RAISE EXCEPTION 'Private/pending/self/capped recipient received alerts'; END IF;

  IF EXISTS(
    SELECT 1 FROM public.executive_events
    WHERE event_type IN ('community.mention','community.reply')
    GROUP BY member_id,event_type,(payload->>'source_id')
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Duplicate notification source events'; END IF;
END;
$verify_results$;

-- Deleting a source before a new comment insert must never notify.
UPDATE public.community_messages SET is_deleted=true
WHERE id='10000000-0000-4000-8000-000000000003';
-- Insert as table owner to test trigger's own guard, not the comment RLS.
INSERT INTO public.community_comments(id,message_id,user_id,body)
VALUES('20000000-0000-4000-8000-000000000003',
       '10000000-0000-4000-8000-000000000003',
       '00000000-0000-4000-8000-000000000001',
       'Deleted source @Annabelle');
DO $verify_deleted$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.executive_events
    WHERE payload->>'source_id'='20000000-0000-4000-8000-000000000003'
  ) THEN RAISE EXCEPTION 'Deleted source created notifications'; END IF;
END;
$verify_deleted$;

SELECT 'COMMUNITY_NOTIFICATION_POSTGRES_INTEGRATION_PASS' AS result;
