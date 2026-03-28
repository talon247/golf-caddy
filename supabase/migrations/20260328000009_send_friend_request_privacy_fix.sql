-- =============================================================================
-- Golf Caddy: Fix send_friend_request privacy leak
-- Migration: 20260328000009_send_friend_request_privacy_fix.sql
-- Author: Backend Infrastructure Engineer (THEA-231)
-- Parent: THEA-227
-- =============================================================================
-- Security fix: the send_friend_request() function returned 'requests_disabled'
-- when the addressee had disabled friend requests. The comment in the original
-- code documented the intent ("Return user_not_found to avoid leaking the
-- setting") but the implementation returned the wrong value.
--
-- Returning 'requests_disabled' reveals:
--   1. The username exists in the system
--   2. That specific user has disabled friend requests
--
-- Fix: return 'user_not_found' in both the "user doesn't exist" and "user has
-- disabled requests" branches, so the caller cannot distinguish between them.
--
-- Frontend impact: none. src/lib/friends.ts sendFriendRequest() already maps
-- 'user_not_found' → "User not found." and displays the same message.
-- The 'requests_disabled' entry in the client error map becomes dead code
-- (it is safe to leave in place or remove in a future cleanup).
-- =============================================================================

-- Recreate the function with the privacy fix applied.
-- Uses CREATE OR REPLACE — idempotent, no data loss.
CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_addressee_username text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_addressee  public.profiles;
  v_new_id     uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  -- Look up addressee by username (case-insensitive stored as lowercase)
  SELECT * INTO v_addressee
  FROM public.profiles
  WHERE username = lower(trim(p_addressee_username));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- Self-request guard
  IF v_addressee.id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_request');
  END IF;

  -- Privacy: addressee has disabled friend requests.
  -- Return user_not_found (not requests_disabled) to avoid revealing
  -- that the account exists or what their privacy setting is.
  IF NOT v_addressee.friend_requests_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- Check for existing friendship in either direction
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = auth.uid() AND addressee_id = v_addressee.id)
       OR (requester_id = v_addressee.id AND addressee_id = auth.uid())
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_exists');
  END IF;

  -- Insert pending request
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (auth.uid(), v_addressee.id, 'pending')
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success',              true,
    'friendshipId',         v_new_id,
    'addresseeDisplayName', v_addressee.display_name
  );
END;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
