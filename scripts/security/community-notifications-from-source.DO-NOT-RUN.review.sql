-- REVIEW ONLY — DO NOT RUN. Stage with synthetic approved members first.
-- No database changes or notifications are performed by this GitHub artifact.
-- Replaces client-triggered, untrusted community_notify_mentions requests with
-- INSERT-only server-owned events from genuine saved posts and comments.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.community_messages') IS NULL
     OR to_regclass('public.community_comments') IS NULL
     OR to_regclass('public.executive_events') IS NULL
     OR to_regclass('public.member_profiles') IS NULL
  THEN RAISE EXCEPTION 'Community notification dependencies missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgname IN ('agent_os_community_post_notifications',
                       'agent_os_community_comment_notifications')
      AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'Community notification trigger already exists; review drift'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.executive_events
    WHERE event_type IN ('community.mention','community.reply')
      AND payload ? 'source_id'
    GROUP BY member_id,event_type,(payload->>'source_id')
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Existing community notification source dedupe conflict'; END IF;
END;
$preflight$;

CREATE SCHEMA IF NOT EXISTS dominionstar_private;
REVOKE ALL ON SCHEMA dominionstar_private FROM PUBLIC,anon,authenticated;

-- Exact literal @member-name recognition with boundaries, not user-controlled
-- LIKE wildcards or regexes. Handles multiple occurrences of the same name,
-- and deliberately rejects @Anna within @Annabelle.
CREATE OR REPLACE FUNCTION dominionstar_private.has_exact_member_mention(
  source_text text,member_name text
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path=''
AS $function$
DECLARE
  haystack text:=lower(coalesce(source_text,''));
  needle text:='@'||lower(btrim(coalesce(member_name,'')));
  pos integer;
  next_pos integer;
  before_char text;
  after_char text;
BEGIN
  IF char_length(needle)<3 OR char_length(needle)>90
    OR char_length(haystack)>5000
  THEN RETURN false; END IF;
  pos:=pg_catalog.strpos(haystack,needle);
  WHILE pos>0 LOOP
    before_char:=CASE WHEN pos=1 THEN '' ELSE pg_catalog.substr(haystack,pos-1,1) END;
    after_char:=pg_catalog.substr(haystack,pos+char_length(needle),1);
    IF (before_char='' OR before_char !~ '[[:alnum:]_]')
      AND (after_char='' OR after_char !~ '[[:alnum:]_]')
    THEN RETURN true; END IF;
    next_pos:=pg_catalog.strpos(pg_catalog.substr(haystack,pos+1),needle);
    IF next_pos=0 THEN EXIT; END IF;
    pos:=pos+next_pos;
  END LOOP;
  RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION dominionstar_private.has_exact_member_mention(text,text)
  FROM PUBLIC,anon,authenticated;

-- Duplicate INSERT attempts cannot produce two events for the same
-- recipient, source item and event type. No member private data is indexed.
CREATE UNIQUE INDEX executive_community_notifications_source_once_idx
ON public.executive_events(
  member_id,event_type,(payload->>'source_id')
)
WHERE event_type IN ('community.mention','community.reply')
  AND payload ? 'source_id';

CREATE OR REPLACE FUNCTION dominionstar_private.emit_community_notifications()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  actor_name text;
  source_body text;
  source_id uuid;
  source_type text;
  post_id uuid;
  post_author uuid;
  recipient record;
  destination text;
BEGIN
  IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
  IF NEW.is_deleted THEN RETURN NEW; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=NEW.user_id AND p.verification_status='approved'
  ) THEN RETURN NEW; END IF;
  SELECT coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),'A member')
  INTO actor_name FROM public.member_profiles p WHERE p.id=NEW.user_id;

  source_id:=NEW.id;
  source_body:=NEW.body;
  IF TG_TABLE_NAME='community_comments' THEN
    source_type:='comment';post_id:=NEW.message_id;
  ELSIF TG_TABLE_NAME='community_messages' THEN
    source_type:='post';post_id:=NEW.id;
  ELSE
    RAISE EXCEPTION 'Unexpected community notification trigger source';
  END IF;
  -- Only active posts may cause new notifications. Comments on removed
  -- posts and unavailable source records are excluded.
  SELECT m.user_id INTO post_author
  FROM public.community_messages m
  WHERE m.id=post_id AND m.is_deleted=false;
  IF post_author IS NULL THEN RETURN NEW; END IF;

  destination:='/community/?post='||post_id::text;
  IF source_type='comment' AND post_author<>NEW.user_id
    AND EXISTS (
      SELECT 1 FROM public.member_profiles p
      WHERE p.id=post_author AND p.verification_status='approved'
    )
  THEN
    INSERT INTO public.executive_events(
      member_id,actor_id,event_type,title,description,payload,priority
    ) VALUES(
      post_author,NEW.user_id,'community.reply',
      left(actor_name,80)||' replied to your post',
      'A member commented on your DominionStar Community post.',
      jsonb_build_object('source_type','comment','source_id',source_id::text,
        'post_id',post_id::text,'action_url',destination),
      'normal'
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Limit one saved item to five mentioned recipients. This prevents
  -- unbounded fan-out from deliberately crafted social content.
  FOR recipient IN
    SELECT p.id
    FROM public.member_profiles p
    WHERE p.verification_status='approved'
      AND p.profile_visibility='members'
      AND p.id<>NEW.user_id
      AND (source_type<>'comment' OR p.id<>post_author)
      AND (
        dominionstar_private.has_exact_member_mention(source_body,p.full_name)
        OR dominionstar_private.has_exact_member_mention(source_body,p.preferred_name)
      )
    ORDER BY p.id LIMIT 5
  LOOP
    INSERT INTO public.executive_events(
      member_id,actor_id,event_type,title,description,payload,priority
    ) VALUES(
      recipient.id,NEW.user_id,'community.mention',
      left(actor_name,80)||' mentioned you',
      'You were mentioned in DominionStar Community.',
      jsonb_build_object('source_type',source_type,'source_id',source_id::text,
        'post_id',post_id::text,'action_url',destination),
      'normal'
    ) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION dominionstar_private.emit_community_notifications()
  FROM PUBLIC,anon,authenticated;

-- Notifications are produced only after real rows pass database INSERT/RLS.
CREATE TRIGGER agent_os_community_post_notifications
AFTER INSERT ON public.community_messages
FOR EACH ROW EXECUTE FUNCTION dominionstar_private.emit_community_notifications();

CREATE TRIGGER agent_os_community_comment_notifications
AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION dominionstar_private.emit_community_notifications();

-- The legacy RPC accepts arbitrary message_body and target_message_id and
-- is deliberately never made callable by authenticated/anonymous clients.
REVOKE EXECUTE ON FUNCTION public.community_notify_mentions(uuid,text)
  FROM PUBLIC,anon,authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon',
       'public.community_notify_mentions(uuid,text)'::regprocedure,'EXECUTE')
    OR has_function_privilege('authenticated',
       'public.community_notify_mentions(uuid,text)'::regprocedure,'EXECUTE')
    OR has_function_privilege('authenticated',
       'dominionstar_private.emit_community_notifications()'::regprocedure,
       'EXECUTE')
    OR NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public'
        AND indexname='executive_community_notifications_source_once_idx'
    )
  THEN RAISE EXCEPTION 'Community notifications permission or dedupe failure'; END IF;
END;
$verify$;
COMMIT;

-- STAGING POSITIVE TESTS:
-- Approved A inserts "@Member B" in new post => B receives one mention event.
-- Approved A comments on B's post => B receives one reply event.
-- Approved A both mentions B and comments on B's post => only reply to B.
-- Comments inserted from Feed and Community both use this same trigger.
-- User B sees event link in their own executive_events inbox.
-- STAGING NEGATIVE TESTS:
-- Unapproved user, deleted source, repeated delivery replay, private profile,
-- @Ann vs @Anna collision, false @-substrings, arbitrary RPC payload,
-- anonymous requests, fabricated client event for another member all fail.
-- Five mentions maximum per saved post/comment; never email by default.
-- Note: if executive_events insert fails, source INSERT also rolls back.
-- This is a deliberate consistency choice requiring release approval.
-- This script is NOT a production deployment.
