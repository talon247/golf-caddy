-- Fix get_friends to include direction info so frontend can distinguish
-- incoming vs outgoing pending requests.
-- Bug: THEA-269 — users see both incoming and outgoing pending requests
-- but can only accept incoming ones (where they are the addressee).

CREATE OR REPLACE FUNCTION public.get_friends(
  p_status text DEFAULT 'accepted'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'friendshipId',  f.id,
      'friendUserId',  CASE
                         WHEN f.requester_id = auth.uid() THEN f.addressee_id
                         ELSE f.requester_id
                       END,
      'displayName',   p.display_name,
      'username',      p.username,
      'handicapIndex', p.handicap_index,
      'status',        f.status,
      'isIncoming',    (f.addressee_id = auth.uid()),
      'createdAt',     f.created_at
    )
    ORDER BY p.display_name
  ) INTO v_result
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE
                WHEN f.requester_id = auth.uid() THEN f.addressee_id
                ELSE f.requester_id
              END
  WHERE (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND f.status = p_status;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
