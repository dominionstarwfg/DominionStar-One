-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION DATABASE APPROVAL.
-- DominionStar Agent OS: true Web Push foundation + trusted message notification source.
-- This file does not modify DominionStar Meet.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.executive_events') IS NULL
     OR to_regclass('public.direct_messages') IS NULL
     OR to_regclass('public.member_profiles') IS NULL THEN
    RAISE EXCEPTION 'Required Agent OS tables are missing; abort';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.web_push_subscriptions FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.web_push_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.register_my_push_subscription(
  target_endpoint text,
  target_p256dh text,
  target_auth text,
  target_user_agent text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $function$
DECLARE
  subscription_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated member required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'
  ) THEN RAISE EXCEPTION 'Approved member required'; END IF;
  IF length(coalesce(target_endpoint,''))<20
     OR length(coalesce(target_endpoint,''))>4096
     OR length(coalesce(target_p256dh,''))<20
     OR length(coalesce(target_auth,''))<8 THEN
    RAISE EXCEPTION 'Invalid push subscription';
  END IF;

  -- Never let one account claim another account's existing endpoint.
  -- Explicit logout unsubscribes the browser; a new login should create a
  -- fresh PushSubscription before registration under another account.
  IF EXISTS(
    SELECT 1 FROM public.web_push_subscriptions
    WHERE endpoint=target_endpoint AND user_id<>auth.uid()
  ) THEN
    RAISE EXCEPTION 'Push endpoint belongs to another account';
  END IF;

  INSERT INTO public.web_push_subscriptions(
    user_id,endpoint,p256dh,auth,user_agent,enabled,updated_at
  ) VALUES (
    auth.uid(),target_endpoint,target_p256dh,target_auth,left(target_user_agent,500),true,now()
  )
  ON CONFLICT(endpoint) DO UPDATE SET
    user_id=excluded.user_id,
    p256dh=excluded.p256dh,
    auth=excluded.auth,
    user_agent=excluded.user_agent,
    enabled=true,
    updated_at=now()
  RETURNING id INTO subscription_id;

  RETURN subscription_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.register_my_push_subscription(text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_my_push_subscription(text,text,text,text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.remove_my_push_subscription(
  target_endpoint text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $function$
DECLARE changed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated member required'; END IF;
  DELETE FROM public.web_push_subscriptions
   WHERE user_id=auth.uid() AND endpoint=target_endpoint;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed>0;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.remove_my_push_subscription(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_my_push_subscription(text)
  TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.push_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.executive_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  action_url text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS push_notification_outbox_pending_idx
  ON public.push_notification_outbox(status,next_attempt_at,created_at);
ALTER TABLE public.push_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_notification_outbox FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.push_notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.emit_direct_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE sender_name text;
BEGIN
  -- Call-event rows have their own lifecycle handling; normal messages are
  -- authoritative here because the row has already passed direct_messages RLS.
  IF new.body LIKE '[call-event]%' THEN RETURN new; END IF;

  SELECT coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),'DominionStar member')
    INTO sender_name
  FROM public.member_profiles p
  WHERE p.id=new.sender_id;

  INSERT INTO public.executive_events(
    event_type,member_id,actor_id,title,description,payload,priority
  ) VALUES (
    'message.received',
    new.recipient_id,
    new.sender_id,
    'New message from '||coalesce(sender_name,'DominionStar member'),
    left(new.body,180),
    jsonb_build_object(
      'message_id',new.id::text,
      'sender_id',new.sender_id::text,
      'conversation_member_id',new.sender_id::text,
      'action_url','/direct-messages/?member='||new.sender_id::text
    ),
    'normal'
  );
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS emit_direct_message_notification_trigger
  ON public.direct_messages;
CREATE TRIGGER emit_direct_message_notification_trigger
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.emit_direct_message_notification();
REVOKE EXECUTE ON FUNCTION public.emit_direct_message_notification()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_member_event_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE valid_cross_member boolean := false;
BEGIN
  -- Server-authored and self-authored events are eligible. Cross-member events
  -- are eligible only when backed by the exact persisted direct message.
  IF new.actor_id IS NOT NULL AND new.actor_id<>new.member_id THEN
    IF new.event_type='message.received' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.direct_messages m
        WHERE m.id::text=new.payload->>'message_id'
          AND m.sender_id=new.actor_id
          AND m.recipient_id=new.member_id
          AND m.is_deleted=false
      ) INTO valid_cross_member;
    END IF;
    IF NOT valid_cross_member THEN RETURN new; END IF;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.web_push_subscriptions s
    WHERE s.user_id=new.member_id AND s.enabled=true
  ) THEN RETURN new; END IF;

  INSERT INTO public.push_notification_outbox(
    recipient_id,event_id,title,body,action_url,priority
  ) VALUES (
    new.member_id,new.id,left(new.title,180),left(new.description,1000),
    new.payload->>'action_url',coalesce(new.priority,'normal')
  )
  ON CONFLICT(event_id) DO NOTHING;

  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS queue_member_event_push_trigger
  ON public.executive_events;
CREATE TRIGGER queue_member_event_push_trigger
AFTER INSERT ON public.executive_events
FOR EACH ROW EXECUTE FUNCTION public.queue_member_event_push();
REVOKE EXECUTE ON FUNCTION public.queue_member_event_push()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_push_notification_batch(
  batch_size integer DEFAULT 25
) RETURNS SETOF public.push_notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id FROM public.push_notification_outbox
    WHERE status='pending' AND next_attempt_at<=now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1,least(batch_size,100))
  )
  UPDATE public.push_notification_outbox o
     SET status='processing',
         attempts=o.attempts+1,
         updated_at=now()
    FROM claimable c
   WHERE o.id=c.id
  RETURNING o.*;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.claim_push_notification_batch(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_notification_batch(integer)
  TO service_role;

-- Replace the event-email trigger so selected private-message email alerts are
-- allowed only when the cross-member event is backed by the exact stored row.
CREATE OR REPLACE FUNCTION public.queue_member_event_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $function$
DECLARE
  destination text;
  allowed boolean := false;
  valid_cross_member boolean := false;
  prefs public.notification_preferences%rowtype;
BEGIN
  IF new.actor_id IS NOT NULL AND new.actor_id<>new.member_id THEN
    IF new.event_type='message.received' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.direct_messages m
        WHERE m.id::text=new.payload->>'message_id'
          AND m.sender_id=new.actor_id
          AND m.recipient_id=new.member_id
          AND m.is_deleted=false
      ) INTO valid_cross_member;
    END IF;
    IF NOT valid_cross_member THEN RETURN new; END IF;
  END IF;

  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id=new.member_id;
  IF found AND NOT prefs.email_enabled THEN RETURN new; END IF;

  allowed := CASE
    WHEN new.event_type LIKE 'meeting.%' THEN coalesce(prefs.meeting_room_email_enabled,true)
    WHEN new.event_type LIKE 'message.%' OR new.event_type='call.missed'
      THEN coalesce(prefs.messages_email_enabled,false)
    WHEN new.event_type LIKE 'appointment.%'
      THEN coalesce(prefs.appointments_email_enabled,true)
    WHEN new.event_type LIKE 'announcement.%' OR new.event_type LIKE 'founder.%'
      THEN coalesce(prefs.announcements_email_enabled,true)
    WHEN new.event_type LIKE 'community.%'
      THEN coalesce(prefs.community_email_enabled,false)
    ELSE new.priority IN ('high','critical')
  END;
  IF NOT allowed THEN RETURN new; END IF;

  SELECT email INTO destination
  FROM auth.users
  WHERE id=new.member_id AND email_confirmed_at IS NOT NULL;
  IF destination IS NULL THEN RETURN new; END IF;

  INSERT INTO public.email_notification_outbox(
    recipient_id,recipient_email,event_type,subject,body,action_url,dedupe_key
  ) VALUES (
    new.member_id,destination,new.event_type,left(new.title,180),
    left(new.description,4000),new.payload->>'action_url','event:'||new.id::text
  )
  ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN new;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.queue_member_event_email()
  FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE
  register_oid oid:=to_regprocedure('public.register_my_push_subscription(text,text,text,text)');
  remove_oid oid:=to_regprocedure('public.remove_my_push_subscription(text)');
  claim_oid oid:=to_regprocedure('public.claim_push_notification_batch(integer)');
BEGIN
  IF register_oid IS NULL OR remove_oid IS NULL OR claim_oid IS NULL THEN
    RAISE EXCEPTION 'Push RPC setup incomplete';
  END IF;
  IF has_function_privilege('anon',register_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',register_oid,'EXECUTE')
     OR has_function_privilege('anon',remove_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',remove_oid,'EXECUTE')
     OR has_function_privilege('anon',claim_oid,'EXECUTE')
     OR has_function_privilege('authenticated',claim_oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',claim_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected Web Push function privileges; abort';
  END IF;
END;
$verify$;

COMMIT;

-- Required post-approval checks:
-- 1. Approved member can register only the current authenticated browser endpoint.
-- 2. Anonymous registration/removal and outbox claim are rejected.
-- 3. Sending a real direct message creates exactly one message.received event.
-- 4. Forged cross-member executive_events do not enter push/email outboxes.
-- 5. Closed-browser push reaches the subscribed test browser.
-- 6. Focused DominionStar tab suppresses duplicate service-worker popup.
-- 7. Explicit logout removes the browser subscription.
-- 8. Re-run Supabase Security Advisor and monitor both outboxes.
