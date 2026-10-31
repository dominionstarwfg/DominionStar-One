-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION DATABASE APPROVAL.
-- DominionStar Agent OS: direct-message mutation integrity.
-- Replaces broad browser UPDATE access with narrow authenticated RPCs.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.direct_messages') IS NULL THEN
    RAISE EXCEPTION 'public.direct_messages is missing';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.mark_my_direct_messages_read(
  target_other_member_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE changed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;
  IF target_other_member_id IS NULL THEN
    RAISE EXCEPTION 'Conversation member is required';
  END IF;

  UPDATE public.direct_messages
     SET read_at=coalesce(read_at,now())
   WHERE recipient_id=auth.uid()
     AND sender_id=target_other_member_id
     AND read_at IS NULL
     AND is_deleted=false;

  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.mark_my_direct_messages_read(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_my_direct_messages_read(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.edit_my_direct_message(
  target_message_id uuid,
  target_body text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE changed integer := 0;
DECLARE cleaned_body text := trim(coalesce(target_body,''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;
  IF target_message_id IS NULL THEN
    RAISE EXCEPTION 'Message id is required';
  END IF;
  IF length(cleaned_body)<1 OR length(cleaned_body)>10000 THEN
    RAISE EXCEPTION 'Message body must be between 1 and 10000 characters';
  END IF;

  UPDATE public.direct_messages
     SET body=cleaned_body,
         updated_at=now()
   WHERE id=target_message_id
     AND sender_id=auth.uid()
     AND is_deleted=false;

  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed>0;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.edit_my_direct_message(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_my_direct_message(uuid,text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_my_direct_message(
  target_message_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE changed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;
  IF target_message_id IS NULL THEN
    RAISE EXCEPTION 'Message id is required';
  END IF;

  UPDATE public.direct_messages
     SET is_deleted=true,
         updated_at=now()
   WHERE id=target_message_id
     AND sender_id=auth.uid()
     AND is_deleted=false;

  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed>0;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.delete_my_direct_message(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_direct_message(uuid)
  TO authenticated, service_role;

-- Browser clients no longer mutate message rows directly.
DROP POLICY IF EXISTS "members update received direct messages"
  ON public.direct_messages;
REVOKE UPDATE ON TABLE public.direct_messages FROM anon, authenticated;

DO $verify$
DECLARE
  read_oid oid:=to_regprocedure('public.mark_my_direct_messages_read(uuid)');
  edit_oid oid:=to_regprocedure('public.edit_my_direct_message(uuid,text)');
  delete_oid oid:=to_regprocedure('public.delete_my_direct_message(uuid)');
BEGIN
  IF read_oid IS NULL OR edit_oid IS NULL OR delete_oid IS NULL THEN
    RAISE EXCEPTION 'Direct-message integrity RPC setup incomplete';
  END IF;
  IF has_function_privilege('anon',read_oid,'EXECUTE')
     OR has_function_privilege('anon',edit_oid,'EXECUTE')
     OR has_function_privilege('anon',delete_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',read_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',edit_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',delete_oid,'EXECUTE')
     OR has_table_privilege('authenticated','public.direct_messages','UPDATE') THEN
    RAISE EXCEPTION 'Unexpected Direct Message mutation privileges; abort';
  END IF;
END;
$verify$;

COMMIT;

-- Required post-approval checks:
-- 1. Recipient can mark only messages sent to them as read.
-- 2. Sender can edit only their own non-deleted message.
-- 3. Recipient cannot edit or delete the sender's message.
-- 4. Sender can soft-delete only their own message.
-- 5. sender_id, recipient_id, created_at and id cannot be browser-mutated.
-- 6. Edited messages receive a new updated_at timestamp.
-- 7. Re-run Supabase Security Advisor.
