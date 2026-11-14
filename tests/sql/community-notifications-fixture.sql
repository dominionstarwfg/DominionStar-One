-- TEST FIXTURE ONLY: synthetic data in a disposable PostgreSQL service.
-- DO NOT run against production or any existing Supabase project.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
-- Supabase creates this database ROLE; here it is synthetic and has no key.
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;

CREATE TABLE auth.users(
  id uuid PRIMARY KEY,
  email text,
  email_confirmed_at timestamptz
);
CREATE TABLE public.member_profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text NOT NULL,
  preferred_name text,
  verification_status text NOT NULL DEFAULT 'pending',
  profile_visibility text NOT NULL DEFAULT 'members'
);
CREATE TABLE public.community_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text,
  body text NOT NULL,
  post_type text DEFAULT 'discussion',
  is_deleted boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false
);
CREATE TABLE public.community_comments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.community_messages(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.executive_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id),
  actor_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority text NOT NULL DEFAULT 'normal',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.community_notify_mentions(uuid,text) RETURNS integer
LANGUAGE sql AS $$SELECT 0$$;

GRANT SELECT ON public.member_profiles TO authenticated;
GRANT SELECT,INSERT ON public.community_messages,public.community_comments TO authenticated;
GRANT SELECT,INSERT ON public.executive_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_notify_mentions(uuid,text)
  TO PUBLIC,anon,authenticated;

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member sees own profile"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (id=auth.uid());
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved member post insert"
  ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id=auth.uid()
    AND EXISTS(SELECT 1 FROM public.member_profiles p
      WHERE p.id=auth.uid() AND p.verification_status='approved')
  );
CREATE POLICY "approved member post read"
  ON public.community_messages FOR SELECT TO authenticated
  USING (is_deleted=false AND EXISTS(
    SELECT 1 FROM public.member_profiles p WHERE p.id=auth.uid()
      AND p.verification_status='approved'
  ));
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved member comment insert"
  ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK(
    user_id=auth.uid()
    AND EXISTS(SELECT 1 FROM public.member_profiles p WHERE
      p.id=auth.uid() AND p.verification_status='approved')
    AND EXISTS(SELECT 1 FROM public.community_messages m WHERE
      m.id=message_id AND m.is_deleted=false AND m.is_locked=false)
  );
CREATE POLICY "approved member comment read"
  ON public.community_comments FOR SELECT TO authenticated
  USING (is_deleted=false AND EXISTS(
    SELECT 1 FROM public.member_profiles p WHERE p.id=auth.uid()
      AND p.verification_status='approved'
  ));
ALTER TABLE public.executive_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipient inbox read"
  ON public.executive_events FOR SELECT TO authenticated
  USING (member_id=auth.uid());
CREATE POLICY "member own event insert"
  ON public.executive_events FOR INSERT TO authenticated
  WITH CHECK (member_id=auth.uid() AND actor_id=auth.uid());

INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT ('00000000-0000-4000-8000-'||lpad(x::text,12,'0'))::uuid,
       'synthetic-user-'||x||'@example.invalid',
       now()
FROM unnest(ARRAY[1,2,3,4,5,10,11,12,13,14,15]) AS x;
INSERT INTO public.member_profiles(id,full_name,preferred_name,
  verification_status,profile_visibility)
VALUES
('00000000-0000-4000-8000-000000000001','Author Agent','Author','approved','members'),
('00000000-0000-4000-8000-000000000002','Ann','Ann','approved','members'),
('00000000-0000-4000-8000-000000000003','Annabelle','Annabelle','approved','members'),
('00000000-0000-4000-8000-000000000004','Private Agent','Private','approved','private'),
('00000000-0000-4000-8000-000000000005','Pending Agent','Pending','pending','members'),
('00000000-0000-4000-8000-000000000010','Person10','Person10','approved','members'),
('00000000-0000-4000-8000-000000000011','Person11','Person11','approved','members'),
('00000000-0000-4000-8000-000000000012','Person12','Person12','approved','members'),
('00000000-0000-4000-8000-000000000013','Person13','Person13','approved','members'),
('00000000-0000-4000-8000-000000000014','Person14','Person14','approved','members'),
('00000000-0000-4000-8000-000000000015','Person15','Person15','approved','members');

-- A real Supabase session supplies request.jwt.claim.sub through trusted API.
-- These local GUCs simulate that behavior only in a throwaway CI database.
