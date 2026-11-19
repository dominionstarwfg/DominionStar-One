-- REVIEW ONLY — DO NOT RUN. High-priority Agent OS email routing candidate.
-- Not an applied migration. No production SQL, real emails, or queue writes.
-- Compatible with the current executive_events, notification_preferences,
-- email_notification_outbox, auth.users and existing service-role processor.
-- A separate approved and isolated staging test is mandatory.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.executive_events') IS NULL OR
     to_regclass('public.notification_preferences') IS NULL OR
     to_regclass('public.email_notification_outbox') IS NULL OR
     to_regprocedure('public.queue_member_event_email()') IS NULL OR
     to_regprocedure('dominionstar_private.has_exact_member_mention(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Missing notification/email dependencies; do not apply';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.executive_events'::regclass
      AND tgname='queue_member_event_email_trigger'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Expected email event trigger is missing';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.queue_member_event_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  destination text;
  email_category text;
  permitted boolean := false;
  validated_source boolean := false;
  prefs public.notification_preferences%rowtype;
BEGIN
  -- Never trust a sender-supplied "priority" to turn an arbitrary feed event
  -- into email. Every eligible event must match an explicit event-type rule.
  CASE
    WHEN new.event_type IN (
      'account.approved','account.suspended','account.access_changed','security.alert'
    ) THEN email_category:='account';
    WHEN new.event_type IN (
      'appointment.confirmed','appointment.rescheduled','appointment.cancelled'
    ) THEN email_category:='appointments';
    WHEN new.event_type IN (
      'meeting.cancelled','meeting.rescheduled'
    ) THEN email_category:='meetings';
    WHEN new.event_type IN ('message.received','call.missed')
      THEN email_category:='messages';
    WHEN new.event_type IN ('community.mention','community.reply')
      THEN email_category:='community';
    WHEN new.event_type IN (
      'founder.urgent','founder.critical','announcement.urgent','announcement.critical'
    ) THEN email_category:='announcements';
    WHEN new.event_type IN ('founder.announcement','announcement.published')
      AND lower(coalesce(new.priority,'normal')) IN ('high','critical')
      THEN email_category:='announcements';
    ELSE RETURN new; -- Likes, reactions, normal posts and unknown events never email.
  END CASE;

  -- Trusted standalone meeting.host_absent emails are queued by the existing
  -- rate-bucketed meeting-host-absent RPC, NOT here, to avoid double email.
  -- Prove legitimate provenance before creating a queue entry. Client-created
  -- executive_events are constrained by RLS to actor_id=member_id=auth.uid();
  -- but security/account or official announcements must be server-authored
  -- (NULL actor_id) or emitted by an approved Founder.
  IF email_category IN ('account','appointments','meetings') THEN
    IF new.actor_id IS NOT NULL THEN RETURN new; END IF;
    validated_source:=true;
  ELSIF email_category='announcements' THEN
    IF new.actor_id IS NULL THEN
      validated_source:=true;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.member_profiles founder
        WHERE founder.id=new.actor_id
          AND founder.verification_status='approved'
          AND founder.is_founder=true
      ) INTO validated_source;
    END IF;
  ELSIF new.event_type='message.received' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.direct_messages m
      WHERE m.id::text=new.payload->>'message_id'
        AND m.sender_id=new.actor_id
        AND m.recipient_id=new.member_id
        AND m.is_deleted=false
    ) INTO validated_source;
  ELSIF new.event_type='call.missed' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.communication_calls c
      WHERE c.id::text=new.payload->>'call_id'
        AND c.caller_id=new.actor_id
        AND c.recipient_id=new.member_id
        AND c.status='missed'
    ) INTO validated_source;
  ELSIF email_category='community' THEN
    -- Verified community source evidence comes from the INSERT-only trigger,
    -- not from a browser-supplied notification payload. Both the original
    -- content and actor/recipient relationship are checked again here.
    IF new.actor_id IS NULL OR new.member_id=new.actor_id THEN
      validated_source:=false;
    ELSIF new.event_type='community.reply'
      AND new.payload->>'source_type'='comment' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.community_comments c
        JOIN public.community_messages m ON m.id=c.message_id
        JOIN public.member_profiles recipient ON recipient.id=m.user_id
        WHERE c.id::text=new.payload->>'source_id'
          AND c.user_id=new.actor_id
          AND m.user_id=new.member_id
          AND m.id::text=new.payload->>'post_id'
          AND c.is_deleted=false AND m.is_deleted=false
          AND recipient.verification_status='approved'
      ) INTO validated_source;
    ELSIF new.event_type='community.mention'
      AND new.payload->>'source_type'='post' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.community_messages m
        JOIN public.member_profiles recipient ON recipient.id=new.member_id
        WHERE m.id::text=new.payload->>'source_id'
          AND m.id::text=new.payload->>'post_id'
          AND m.user_id=new.actor_id
          AND m.is_deleted=false
          AND recipient.verification_status='approved'
          AND recipient.profile_visibility='members'
          AND (
            dominionstar_private.has_exact_member_mention(m.body,recipient.full_name)
            OR dominionstar_private.has_exact_member_mention(m.body,recipient.preferred_name)
          )
      ) INTO validated_source;
    ELSIF new.event_type='community.mention'
      AND new.payload->>'source_type'='comment' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.community_comments c
        JOIN public.community_messages m ON m.id=c.message_id
        JOIN public.member_profiles recipient ON recipient.id=new.member_id
        WHERE c.id::text=new.payload->>'source_id'
          AND m.id::text=new.payload->>'post_id'
          AND c.user_id=new.actor_id
          AND c.is_deleted=false AND m.is_deleted=false
          AND recipient.verification_status='approved'
          AND recipient.profile_visibility='members'
          AND recipient.id<>m.user_id
          AND (
            dominionstar_private.has_exact_member_mention(c.body,recipient.full_name)
            OR dominionstar_private.has_exact_member_mention(c.body,recipient.preferred_name)
          )
      ) INTO validated_source;
    ELSE validated_source:=false;
    END IF;
  END IF;
  IF NOT coalesce(validated_source,false) THEN RETURN new; END IF;

  SELECT * INTO prefs FROM public.notification_preferences
  WHERE user_id=new.member_id;
  IF found AND prefs.email_enabled IS FALSE THEN RETURN new; END IF;
  permitted := CASE email_category
    WHEN 'account' THEN true
    WHEN 'appointments' THEN coalesce(prefs.appointments_email_enabled,true)
    WHEN 'meetings' THEN coalesce(prefs.meeting_room_email_enabled,true)
    WHEN 'announcements' THEN coalesce(prefs.announcements_email_enabled,true)
    WHEN 'messages' THEN coalesce(prefs.messages_email_enabled,false)
    WHEN 'community' THEN coalesce(prefs.community_email_enabled,false)
    ELSE false
  END;
  IF NOT coalesce(permitted,false) THEN RETURN new; END IF;

  -- The email address on file is the latest *verified* Supabase Auth address,
  -- not an editable member profile or an email address inside event payload.
  SELECT u.email INTO destination FROM auth.users u
  WHERE u.id=new.member_id AND u.email_confirmed_at IS NOT NULL
    AND nullif(trim(u.email),'') IS NOT NULL;
  IF destination IS NULL THEN RETURN new; END IF;

  INSERT INTO public.email_notification_outbox(
    recipient_id,recipient_email,event_type,subject,body,action_url,dedupe_key
  ) VALUES(
    new.member_id,destination,new.event_type,
    left(coalesce(new.title,'DominionStar priority update'),180),
    left(coalesce(new.description,''),4000),
    new.payload->>'action_url','event:'||new.id::text
  )
  ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN new;
END;
$function$;

-- CREATE OR REPLACE retains the existing function signature and EXECUTE ACL.
-- The existing trigger remains in place, and no new public function grant
-- should ever be added for this privileged trigger.
DO $verify$
BEGIN
  IF to_regprocedure('public.queue_member_event_email()') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE oid='public.queue_member_event_email()'::regprocedure
        AND prosecdef=true
    )
    OR has_function_privilege('anon',
        'public.queue_member_event_email()'::regprocedure,'EXECUTE')
    OR has_function_privilege('authenticated',
        'public.queue_member_event_email()'::regprocedure,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Unsafe queue trigger grants or metadata; abort';
  END IF;
END;
$verify$;
COMMIT;

-- REQUIRED STAGING NEGATIVE TESTS:
-- 1. Post likes/reactions, ordinary community posts and low-priority Founder
--    announcements always stay in-app; no new outbox row.
-- 2. A high-priority Founder notice from a validated Founder reaches the
--    recipient's verified Auth email only if they opted into announcements.
-- 3. An actor spoofed by an ordinary approved member cannot email another.
-- 4. Approved/verified member appointment confirmed/rescheduled/cancelled
--    server events enqueue once; unverified accounts never enqueue.
-- 5. Server-authored security/account alerts are eligible; self-spoofed
--    fake account/security events are not.
-- 6. Genuine direct message/missed call requires source-row validation AND
--    explicit message email opt-in; opted-out means in-app only.
-- 7. Community reply/mention email requires explicit opt-in and original
--    content/actor/recipient verification in server-generated source rows.
--    source until a full comment provenance validator is deployed.
-- 8. Email opt-out must be rechecked by the delivery worker before sending.
-- 9. Preserve the special direct meeting-host-absent queue path with its own
--    verified-email/preference/rate-limit review.
-- 10. Verify exact event emitters: some named event types may not yet exist.
-- Do not run in production, do not perform an actual email send in CI.
