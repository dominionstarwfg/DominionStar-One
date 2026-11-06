-- Synthetic privacy/connection fixture for isolated Postgres 16 CI ONLY.
-- Builds atop tests/sql/community-notifications-fixture.sql in a new disposable
-- database service. No actual member rows/keys/production accounts ever copied.
\set ON_ERROR_STOP on

ALTER TABLE auth.users
  ADD COLUMN raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.member_profiles
  ADD COLUMN email text NOT NULL DEFAULT 'synthetic@example.invalid',
  ADD COLUMN agent_code text NOT NULL DEFAULT 'TEST-000',
  ADD COLUMN smd_name text,
  ADD COLUMN rank text NOT NULL DEFAULT 'TA',
  ADD COLUMN founding_member boolean NOT NULL DEFAULT false,
  ADD COLUMN exclusive_member_number integer,
  ADD COLUMN avatar_path text,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN role text NOT NULL DEFAULT 'member',
  ADD COLUMN is_founder boolean NOT NULL DEFAULT false,
  ADD COLUMN phone text,
  ADD COLUMN address_line1 text,
  ADD COLUMN address_line2 text,
  ADD COLUMN postal_code text,
  ADD COLUMN account_notes text;

-- Founder role is identity-bound in this synthetic test. Production's Founder
-- resolver is NOT replaced, changed, or tested with a real account.
CREATE FUNCTION public.is_dominionstar_founder() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=''
AS $$
  SELECT auth.uid()='00000000-0000-4000-8000-000000000010'::uuid;
$$;
GRANT EXECUTE ON FUNCTION public.is_dominionstar_founder()
  TO authenticated;

DROP POLICY "member sees own profile" ON public.member_profiles;
CREATE POLICY "profile own read"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (id=auth.uid());
CREATE POLICY "profile founder read"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (public.is_dominionstar_founder());
CREATE POLICY "profile approved directory read"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (profile_visibility='members' AND verification_status='approved');
CREATE POLICY "profile founder direct update"
  ON public.member_profiles FOR UPDATE TO authenticated
  USING (public.is_dominionstar_founder())
  WITH CHECK(public.is_dominionstar_founder());

GRANT SELECT,UPDATE ON public.member_profiles TO authenticated;

UPDATE public.member_profiles
SET
  email='test-member-'||right(id::text,3)||'@example.invalid',
  agent_code='SYN-'||right(id::text,3),
  phone='+1-555-0100',
  address_line1='SYNTHETIC ONLY - NOT A REAL ADDRESS',
  account_notes='PRIVATE-SYNTHETIC-NOTES',
  rank='Associate',
  city='Testville',
  state='TX',
  avatar_path='synthetic-avatars/'||id::text||'.png';
UPDATE public.member_profiles
SET is_founder=true,role='founder',rank='SMD'
WHERE id='00000000-0000-4000-8000-000000000010';
UPDATE public.member_profiles
SET profile_visibility='private'
WHERE id='00000000-0000-4000-8000-000000000004';
UPDATE auth.users
SET raw_user_meta_data=jsonb_build_object('dominionstar_settings',
  jsonb_build_object('privacy',
    jsonb_build_object('directoryVisible',false)))
WHERE id='00000000-0000-4000-8000-000000000002';

ALTER TABLE public.community_messages
  ADD COLUMN is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE public.community_chat_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  reply_to uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed rows under table owner; these are fake posts, not real member activity.
INSERT INTO public.community_messages(id,user_id,title,body)
VALUES
('11000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000002',
 'Opted-out synthetic author','Post by opted-out synthetic identity'),
('11000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000003',
 'Visible synthetic author','Post by approved and visible identity');

INSERT INTO public.community_chat_messages(id,user_id,body)
VALUES
('12000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000002',
 'Chat from opted-out synthetic identity'),
('12000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000003',
 'Chat from approved and visible identity');

-- Prepare-phase replaces these under the same exact returned column types.
CREATE FUNCTION public.list_community_feed(result_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,user_id uuid,title text,body text,post_type text,
  is_pinned boolean,is_locked boolean,is_deleted boolean,
  created_at timestamptz,author_full_name text,
  author_preferred_name text,author_rank text,
  author_exclusive_number integer,author_avatar_path text
)
LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$SELECT m.id,m.user_id,m.title,m.body,m.post_type,
  m.is_pinned,m.is_locked,m.is_deleted,m.created_at,
  p.full_name,p.preferred_name,p.rank,p.exclusive_member_number,
  p.avatar_path FROM public.community_messages m
  JOIN public.member_profiles p ON p.id=m.user_id
  ORDER BY m.created_at DESC LIMIT $1$$;

CREATE FUNCTION public.list_community_chat(result_limit integer DEFAULT 200)
RETURNS TABLE(
  id uuid,user_id uuid,body text,reply_to uuid,is_deleted boolean,
  created_at timestamptz,author_full_name text,
  author_preferred_name text,author_rank text,
  author_exclusive_number integer,author_avatar_path text
)
LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $$SELECT m.id,m.user_id,m.body,m.reply_to,m.is_deleted,
  m.created_at,p.full_name,p.preferred_name,p.rank,
  p.exclusive_member_number,p.avatar_path
  FROM public.community_chat_messages m
  JOIN public.member_profiles p ON p.id=m.user_id
  ORDER BY m.created_at ASC LIMIT $1$$;

REVOKE EXECUTE ON FUNCTION public.list_community_feed(integer)
  FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.list_community_chat(integer)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_community_feed(integer),
  public.list_community_chat(integer) TO authenticated;

CREATE TABLE public.member_connections(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.member_profiles(id),
  recipient_id uuid NOT NULL REFERENCES public.member_profiles(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','declined','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_connections_check CHECK(requester_id<>recipient_id),
  CONSTRAINT member_connections_requester_id_recipient_id_key
    UNIQUE(requester_id,recipient_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.member_connections
  TO authenticated;
ALTER TABLE public.member_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read relevant connections"
  ON public.member_connections FOR SELECT TO authenticated
  USING(requester_id=auth.uid() OR recipient_id=auth.uid()
    OR public.is_dominionstar_founder());
CREATE POLICY "members request connections"
  ON public.member_connections FOR INSERT TO authenticated
  WITH CHECK(requester_id=auth.uid());
CREATE POLICY "members respond to connections"
  ON public.member_connections FOR UPDATE TO authenticated
  USING(requester_id=auth.uid() OR recipient_id=auth.uid()
    OR public.is_dominionstar_founder())
  WITH CHECK(requester_id=auth.uid() OR recipient_id=auth.uid()
    OR public.is_dominionstar_founder());

SELECT 'SYNTHETIC_MEMBER_PRIVACY_FIXTURE_PASS' AS result;
