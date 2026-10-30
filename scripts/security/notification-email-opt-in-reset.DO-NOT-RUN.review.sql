-- REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT PRODUCTION DATABASE APPROVAL.
-- DominionStar Agent OS: notification email defaults at cutover.
-- Message and Community email are explicit opt-in categories.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.notification_preferences') IS NULL THEN
    RAISE EXCEPTION 'public.notification_preferences is missing';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notification_preferences'
      AND column_name='messages_email_enabled' AND data_type='boolean'
  ) OR NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notification_preferences'
      AND column_name='community_email_enabled' AND data_type='boolean'
  ) THEN
    RAISE EXCEPTION 'Expected message/community email preference columns are missing';
  END IF;
END;
$preflight$;

-- The former Community screen could write these values without a deliberate
-- centralized opt-in. Reset them once at the new Settings cutover.
UPDATE public.notification_preferences
SET messages_email_enabled=false,
    community_email_enabled=false,
    updated_at=now()
WHERE messages_email_enabled IS DISTINCT FROM false
   OR community_email_enabled IS DISTINCT FROM false;

ALTER TABLE public.notification_preferences
  ALTER COLUMN messages_email_enabled SET DEFAULT false,
  ALTER COLUMN community_email_enabled SET DEFAULT false;

DO $verify$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.notification_preferences
    WHERE messages_email_enabled<>false OR community_email_enabled<>false
  ) THEN
    RAISE EXCEPTION 'Message/community email opt-in reset incomplete';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notification_preferences'
      AND column_name='messages_email_enabled'
      AND column_default='false'
  ) OR NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notification_preferences'
      AND column_name='community_email_enabled'
      AND column_default='false'
  ) THEN
    RAISE EXCEPTION 'Notification email defaults were not hardened';
  END IF;
END;
$verify$;

COMMIT;

-- Post-approval checks:
-- 1. Existing message/community email preferences are OFF.
-- 2. Appointment and announcement email preferences are unchanged.
-- 3. New preference rows default message/community email to OFF.
-- 4. Agent Settings can explicitly enable either category.
