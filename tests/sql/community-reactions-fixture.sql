-- TEST FIXTURE ONLY: three synthetic excess reactions in disposable CI.
-- Must run AFTER community-notifications-fixture/assertions.
\set ON_ERROR_STOP on
CREATE TABLE public.community_reactions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reactions_message_id_user_id_reaction_key
    UNIQUE(message_id,user_id,reaction),
  CONSTRAINT community_reactions_reaction_check
    CHECK (reaction IN ('like','celebrate','support','insightful'))
);
GRANT SELECT,INSERT,DELETE ON public.community_reactions TO authenticated;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approved members see reactions"
  ON public.community_reactions FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.member_profiles p
    WHERE p.id=auth.uid() AND p.verification_status='approved'));
CREATE POLICY "members insert own reactions"
  ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK(user_id=auth.uid() AND EXISTS(
    SELECT 1 FROM public.member_profiles p WHERE p.id=auth.uid()
      AND p.verification_status='approved'
  ));
CREATE POLICY "members delete own reactions"
  ON public.community_reactions FOR DELETE TO authenticated
  USING(user_id=auth.uid());
CREATE FUNCTION public.community_toggle_reaction(
  target_message_id uuid,target_reaction text
) RETURNS integer LANGUAGE sql AS $$SELECT 0$$;
GRANT EXECUTE ON FUNCTION public.community_toggle_reaction(uuid,text)
  TO PUBLIC,anon,authenticated;

-- 9 synthetic rows across 6 member/post pairs, mirroring only aggregate
-- production shape (NO production rows or identifiers are copied).
INSERT INTO public.community_reactions(
  id,message_id,user_id,reaction,created_at
) VALUES
('30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'like','2026-11-01T01:00:00Z'),
('30000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'celebrate','2026-11-02T01:00:00Z'),
('30000000-0000-4000-8000-000000000003',
 '10000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000001',
 'insightful','2026-11-03T01:00:00Z'),
('30000000-0000-4000-8000-000000000004',
 '10000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000002',
 'like','2026-11-03T02:00:00Z'),
('30000000-0000-4000-8000-000000000005',
 '10000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000003',
 'support','2026-11-03T03:00:00Z'),
('30000000-0000-4000-8000-000000000006',
 '10000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000001',
 'like','2026-11-03T04:00:00Z'),
('30000000-0000-4000-8000-000000000007',
 '10000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000002',
 'like','2026-11-03T05:00:00Z'),
('30000000-0000-4000-8000-000000000008',
 '10000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000002',
 'celebrate','2026-11-04T05:00:00Z'),
('30000000-0000-4000-8000-000000000009',
 '10000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000003',
 'insightful','2026-11-04T06:00:00Z');

DO $verify_fixture$
DECLARE total integer;unique_pairs integer;
BEGIN
  SELECT count(*),count(DISTINCT (message_id,user_id))
  INTO total,unique_pairs FROM public.community_reactions;
  IF total<>9 OR unique_pairs<>6 THEN
    RAISE EXCEPTION 'Expected disposable 9 rows / 6 pairs, got % / %',
      total,unique_pairs;
  END IF;
END;
$verify_fixture$;
