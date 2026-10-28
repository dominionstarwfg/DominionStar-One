-- REVIEW-ONLY REPLACEMENT: DO NOT EXECUTE WITHOUT EXPLICIT PRODUCTION APPROVAL.
-- Retains the existing signature used by assets/js/community-chat.js.
-- Security properties:
--   1. Requires a signed-in, approved member and sender_id = auth.uid().
--   2. Requires matching real, nondeleted chat message authored by that member
--      in the last two minutes; client text alone cannot trigger an email.
--   3. Uses a per-message, per-recipient dedupe key and the existing partial
--      unique index to prevent repeated recipients for the same chat message.
--   4. Honors recipient preferences for all email and Community email.
--   5. Removes anonymous EXECUTE while retaining authenticated callers.
-- Do not call the function as part of preflight: it writes to the email outbox.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.queue_community_email_notifications(uuid,text)') IS NULL
    OR to_regclass('public.email_notification_outbox_dedupe_idx') IS NULL THEN
    RAISE EXCEPTION 'Expected RPC or unique dedupe index missing; abort';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.queue_community_email_notifications(
  sender_id uuid, chat_body text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  chat_message_id uuid;
  recipient record;
  inserted_id uuid;
  queued integer := 0;
BEGIN
  IF auth.uid() IS NULL OR sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated chat author required';
  END IF;

  SELECT coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.email)
    INTO sender_name
  FROM public.member_profiles p
  WHERE p.id=sender_id AND p.verification_status='approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved member required';
  END IF;

  SELECT m.id INTO chat_message_id
  FROM public.community_chat_messages m
  WHERE m.user_id=sender_id AND m.body=chat_body
    AND m.is_deleted=false
    AND m.created_at >= now()-interval '2 minutes'
  ORDER BY m.created_at DESC, m.id DESC
  LIMIT 1;

  IF chat_message_id IS NULL THEN
    RAISE EXCEPTION 'A matching recent published chat message is required';
  END IF;

  FOR recipient IN
    SELECT p.id,p.email
    FROM public.member_profiles p
    LEFT JOIN public.notification_preferences np ON np.user_id=p.id
    WHERE p.id<>sender_id AND p.verification_status='approved'
      AND p.email IS NOT NULL
      AND coalesce(np.email_enabled,true)=true
      AND coalesce(np.community_email_enabled,false)=true
  LOOP
    inserted_id := null;
    INSERT INTO public.email_notification_outbox(
      user_id,recipient_email,event_type,subject,body,dedupe_key
    ) VALUES (
      recipient.id,recipient.email,'community_chat',
      'New DominionStar Community Chat Message',
      coalesce(sender_name,'A DominionStar member') ||
        ' posted a new message in Community Chat: ' || left(chat_body,300),
      'community-chat:' || chat_message_id::text || ':' || recipient.id::text
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id INTO inserted_id;
    IF inserted_id IS NOT NULL THEN
      queued := queued + 1;
    END IF;
  END LOOP;

  RETURN queued;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.queue_community_email_notifications(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_community_email_notifications(uuid,text)
  TO authenticated, service_role;

DO $verify$
DECLARE fn_oid oid := to_regprocedure('public.queue_community_email_notifications(uuid,text)');
BEGIN
  IF fn_oid IS NULL
    OR has_function_privilege('anon',fn_oid,'EXECUTE')
    OR NOT has_function_privilege('authenticated',fn_oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',fn_oid,'EXECUTE')
  THEN
    RAISE EXCEPTION 'Unexpected function privileges; abort transaction';
  END IF;
END;
$verify$;
COMMIT;

-- Required approved-release tests:
-- * signed-out and impersonated sender rejected; no outbox rows inserted
-- * approved user can send only their own already-published, nondeleted message
-- * repeat invocation queues 0 extra emails for that same message
-- * email_enabled=false and community_email_enabled=false recipients excluded
-- * regular Community Chat send flow still succeeds after replacement
-- * existing email processor processes a synthetic safe test record
