-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION DATABASE APPROVAL.
-- DominionStar Agent OS: trusted call lifecycle and missed-call persistence.
-- Uses public.communication_calls as the authoritative call record.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.communication_calls') IS NULL
     OR to_regclass('public.direct_messages') IS NULL
     OR to_regclass('public.executive_events') IS NULL
     OR to_regclass('public.member_profiles') IS NULL THEN
    RAISE EXCEPTION 'Required communication tables are missing';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.start_my_communication_call(
  target_recipient_id uuid,
  target_call_type text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;
  IF target_recipient_id IS NULL OR target_recipient_id=auth.uid() THEN
    RAISE EXCEPTION 'A different recipient is required';
  END IF;
  IF target_call_type NOT IN ('audio','video') THEN
    RAISE EXCEPTION 'Invalid call type';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid()
      AND p.verification_status='approved'
      AND nullif(trim(coalesce(p.agent_code,'')),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Approved caller required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.member_profiles p
    WHERE p.id=target_recipient_id
      AND p.verification_status='approved'
      AND nullif(trim(coalesce(p.agent_code,'')),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Approved recipient required';
  END IF;

  INSERT INTO public.communication_calls(
    caller_id,recipient_id,call_type,status,metadata
  ) VALUES (
    auth.uid(),target_recipient_id,target_call_type,'ringing',
    jsonb_build_object('source','agent_os')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.start_my_communication_call(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_my_communication_call(uuid,text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.answer_my_communication_call(
  target_call_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  changed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;

  UPDATE public.communication_calls
     SET status='connected',
         answered_at=coalesce(answered_at,now())
   WHERE id=target_call_id
     AND recipient_id=auth.uid()
     AND status='ringing';

  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed>0;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.answer_my_communication_call(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_my_communication_call(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finish_my_communication_call(
  target_call_id uuid,
  target_outcome text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  call_row public.communication_calls%rowtype;
  changed integer := 0;
  caller_name text;
  recipient_name text;
  label text;
  event_description text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated member required';
  END IF;
  IF target_outcome NOT IN ('missed','declined','cancelled','ended') THEN
    RAISE EXCEPTION 'Invalid call outcome';
  END IF;

  SELECT *
    INTO call_row
  FROM public.communication_calls
  WHERE id=target_call_id
  FOR UPDATE;

  IF call_row.id IS NULL THEN
    RETURN false;
  END IF;
  IF auth.uid()<>call_row.caller_id AND auth.uid()<>call_row.recipient_id THEN
    RAISE EXCEPTION 'Call participant required';
  END IF;

  IF target_outcome='missed' THEN
    IF call_row.status<>'ringing' THEN RETURN false; END IF;
    UPDATE public.communication_calls
       SET status='missed',ended_at=coalesce(ended_at,now())
     WHERE id=call_row.id AND status='ringing';
  ELSIF target_outcome='declined' THEN
    IF auth.uid()<>call_row.recipient_id OR call_row.status<>'ringing' THEN RETURN false; END IF;
    UPDATE public.communication_calls
       SET status='declined',ended_at=coalesce(ended_at,now())
     WHERE id=call_row.id AND status='ringing';
  ELSIF target_outcome='cancelled' THEN
    IF auth.uid()<>call_row.caller_id OR call_row.status<>'ringing' THEN RETURN false; END IF;
    UPDATE public.communication_calls
       SET status='cancelled',ended_at=coalesce(ended_at,now())
     WHERE id=call_row.id AND status='ringing';
  ELSE
    IF call_row.status<>'connected' THEN RETURN false; END IF;
    UPDATE public.communication_calls
       SET status='ended',ended_at=coalesce(ended_at,now())
     WHERE id=call_row.id AND status='connected';
  END IF;

  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed=0 THEN RETURN false; END IF;

  SELECT coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.email,'DominionStar member')
    INTO caller_name
  FROM public.member_profiles p
  WHERE p.id=call_row.caller_id;

  SELECT coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.email,'DominionStar member')
    INTO recipient_name
  FROM public.member_profiles p
  WHERE p.id=call_row.recipient_id;

  label := CASE WHEN call_row.call_type='video' THEN 'video call' ELSE 'audio call' END;

  IF target_outcome='missed' THEN
    INSERT INTO public.direct_messages(sender_id,recipient_id,body)
    VALUES(
      call_row.caller_id,
      call_row.recipient_id,
      '[call-event]missed|'||call_row.call_type||'|Missed '||label
    );

    event_description := coalesce(caller_name,'DominionStar member')||
      ' tried to reach you by '||label||'.';

    INSERT INTO public.executive_events(
      event_type,member_id,actor_id,title,description,payload,priority
    ) VALUES (
      'call.missed',
      call_row.recipient_id,
      call_row.caller_id,
      'Missed call',
      event_description,
      jsonb_build_object(
        'call_id',call_row.id,
        'member_id',call_row.caller_id,
        'call_type',call_row.call_type,
        'action_url','/direct-messages/?member='||call_row.caller_id::text
      ),
      'high'
    );
  ELSIF target_outcome='declined' THEN
    INSERT INTO public.direct_messages(sender_id,recipient_id,body)
    VALUES(
      call_row.caller_id,
      call_row.recipient_id,
      '[call-event]declined|'||call_row.call_type||'|'||
      coalesce(recipient_name,'DominionStar member')||' declined the '||label
    );

    INSERT INTO public.executive_events(
      event_type,member_id,actor_id,title,description,payload,priority
    ) VALUES (
      'call.declined',
      call_row.caller_id,
      call_row.recipient_id,
      'Call declined',
      coalesce(recipient_name,'DominionStar member')||' declined your '||label||'.',
      jsonb_build_object(
        'call_id',call_row.id,
        'member_id',call_row.recipient_id,
        'call_type',call_row.call_type,
        'action_url','/direct-messages/?member='||call_row.recipient_id::text
      ),
      'normal'
    );
  END IF;

  RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.finish_my_communication_call(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_my_communication_call(uuid,text)
  TO authenticated, service_role;

-- Call rows are readable only through the existing participant RLS policy.
-- Browser mutation is routed through the narrow lifecycle RPCs above.
REVOKE ALL ON TABLE public.communication_calls FROM anon, authenticated;
GRANT SELECT ON TABLE public.communication_calls TO authenticated;

DO $verify$
DECLARE
  start_oid oid:=to_regprocedure('public.start_my_communication_call(uuid,text)');
  answer_oid oid:=to_regprocedure('public.answer_my_communication_call(uuid)');
  finish_oid oid:=to_regprocedure('public.finish_my_communication_call(uuid,text)');
BEGIN
  IF start_oid IS NULL OR answer_oid IS NULL OR finish_oid IS NULL THEN
    RAISE EXCEPTION 'Communication call lifecycle RPC setup incomplete';
  END IF;
  IF has_function_privilege('anon',start_oid,'EXECUTE')
     OR has_function_privilege('anon',answer_oid,'EXECUTE')
     OR has_function_privilege('anon',finish_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',start_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',answer_oid,'EXECUTE')
     OR NOT has_function_privilege('authenticated',finish_oid,'EXECUTE')
     OR has_table_privilege('authenticated','public.communication_calls','INSERT')
     OR has_table_privilege('authenticated','public.communication_calls','UPDATE')
     OR has_table_privilege('authenticated','public.communication_calls','DELETE')
     OR NOT has_table_privilege('authenticated','public.communication_calls','SELECT') THEN
    RAISE EXCEPTION 'Unexpected communication_calls privileges; abort';
  END IF;
END;
$verify$;

COMMIT;

-- Post-approval checks:
-- 1. Approved caller can create only a call from self to another approved member.
-- 2. Recipient can answer only a ringing call addressed to them.
-- 3. Either participant can atomically mark an unanswered ringing call missed.
-- 4. Only recipient can decline; only caller can cancel; connected participants can end.
-- 5. Duplicate timeout/decline finalization creates no duplicate history/event.
-- 6. Missed-call Direct Message is server-authored as the real caller, never browser impersonation.
-- 7. Missed-call executive event records caller as actor and recipient as member.
-- 8. Anonymous and direct browser INSERT/UPDATE/DELETE on communication_calls are denied.
-- 9. Re-run Supabase Security Advisor.
