-- ---------------------------------------------------------------------------
-- Migration: Fix search_users RPC NULL auth.uid() exclusion bug
-- THEA-252: WHERE p.id <> auth.uid() returns no rows when auth.uid() IS NULL
-- Fix: guard with (auth.uid() IS NULL OR p.id <> auth.uid())
-- Also: strip leading '@' from p_query before pattern matching
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_users(
  p_query text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result  jsonb;
  v_cleaned text;
BEGIN
  -- Strip leading '@' that the UI may send (e.g. "@kevin" → "kevin")
  v_cleaned := ltrim(p_query, '@');

  SELECT jsonb_agg(
    jsonb_build_object(
      'userId',            p.id,
      'displayName',       p.display_name,
      'username',          p.username,
      'isFriend',          EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
            OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
          AND f.status = 'accepted'
      ),
      'hasPendingRequest', EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE ((f.requester_id = auth.uid() AND f.addressee_id = p.id)
            OR (f.requester_id = p.id AND f.addressee_id = auth.uid()))
          AND f.status = 'pending'
      )
    )
    ORDER BY p.display_name
  ) INTO v_result
  FROM public.profiles p
  WHERE (auth.uid() IS NULL OR p.id <> auth.uid())
    AND (
      p.username ILIKE v_cleaned || '%'
      OR p.display_name ILIKE '%' || v_cleaned || '%'
    )
    -- Exclude users who have blocked the caller
    AND (
      auth.uid() IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.friendships bf
        WHERE bf.requester_id = p.id
          AND bf.addressee_id = auth.uid()
          AND bf.status = 'blocked'
      )
    )
  LIMIT 20;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
