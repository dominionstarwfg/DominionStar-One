-- Disposable-only legacy email RPC simulation. No real email/outbox table.
-- Existing community fixture supplies synthetic anon/authenticated roles.
CREATE OR REPLACE FUNCTION public.queue_community_message_email(target_message_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $synthetic$
BEGIN
  RETURN 0;
END;
$synthetic$;
REVOKE ALL ON FUNCTION public.queue_community_message_email(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_community_message_email(uuid)
  TO authenticated;
DO $assert$
BEGIN
  IF NOT has_function_privilege(
    'authenticated','public.queue_community_message_email(uuid)'::regprocedure,'EXECUTE'
  ) OR has_function_privilege(
    'anon','public.queue_community_message_email(uuid)'::regprocedure,'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Synthetic legacy RPC setup invalid';
  END IF;
END;
$assert$;
