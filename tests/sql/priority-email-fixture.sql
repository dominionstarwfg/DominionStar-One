-- Synthetic ONLY: partial production-shaped email notification schema.
-- Execute with a GitHub Actions disposable PostgreSQL service, never Supabase.
\set ON_ERROR_STOP on

ALTER TABLE public.member_profiles
  ADD COLUMN is_founder boolean NOT NULL DEFAULT false;
UPDATE public.member_profiles SET is_founder=true
WHERE id='00000000-0000-4000-8000-000000000010';

-- A synthetic unconfirmed Auth address must not receive any mail.
UPDATE auth.users SET email_confirmed_at=NULL
WHERE id='00000000-0000-4000-8000-000000000005';

CREATE TABLE public.notification_preferences(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  email_enabled boolean NOT NULL DEFAULT true,
  announcements_email_enabled boolean NOT NULL DEFAULT true,
  appointments_email_enabled boolean NOT NULL DEFAULT true,
  meeting_room_email_enabled boolean NOT NULL DEFAULT true,
  messages_email_enabled boolean NOT NULL DEFAULT false,
  community_email_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE public.email_notification_outbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  recipient_id uuid REFERENCES auth.users(id),
  recipient_email text NOT NULL,
  event_type text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  action_url text,
  dedupe_key text,
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN('pending','processing','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_notification_outbox_dedupe_idx
ON public.email_notification_outbox(dedupe_key)
WHERE dedupe_key IS NOT NULL;
REVOKE ALL ON TABLE public.email_notification_outbox FROM PUBLIC,anon,authenticated;

-- Synthetic inbox records; all content and actors invented for the test.
INSERT INTO public.notification_preferences(user_id)
SELECT id FROM auth.users;
UPDATE public.notification_preferences SET email_enabled=false
WHERE user_id='00000000-0000-4000-8000-000000000003';

CREATE TABLE public.direct_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.communication_calls(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'ringing'
);

INSERT INTO public.direct_messages(id,sender_id,recipient_id,body)
VALUES(
  '50000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'A fictional direct message'
);
INSERT INTO public.communication_calls(id,caller_id,recipient_id,status)
VALUES(
  '60000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'missed'
);

-- Production has an existing, locked-down trigger and RPC. Reproduce its
-- signature/grants so CREATE OR REPLACE and preflight are actually verified.
CREATE OR REPLACE FUNCTION public.queue_member_event_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$BEGIN RETURN NEW; END;$$;
REVOKE EXECUTE ON FUNCTION public.queue_member_event_email()
FROM PUBLIC,anon,authenticated;
CREATE TRIGGER queue_member_event_email_trigger
AFTER INSERT ON public.executive_events
FOR EACH ROW EXECUTE FUNCTION public.queue_member_event_email();

SELECT 'PRIORITY_EMAIL_SYNTHETIC_FIXTURE_PASS' AS result;
