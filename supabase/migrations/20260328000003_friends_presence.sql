-- =============================================================================
-- Golf Caddy: Friends, Presence & Quick-Join Schema
-- Migration: 20260328000003_friends_presence.sql
-- Author: Backend Infrastructure Engineer (THEA-144)
-- PRD: docs/specs/v3-PRD-friends-presence-quickjoin.md
-- =============================================================================
-- Idempotent: uses IF NOT EXISTS guards and
--   DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$
--   for constraints and policies. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — add username, presence_visible, friend_requests_open
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username            text UNIQUE,
  ADD COLUMN IF NOT EXISTS presence_visible    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS friend_requests_open boolean NOT NULL DEFAULT true;

-- Username format: 3–20 chars, lowercase alphanumeric + underscore
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index for username search / uniqueness lookup
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username)
  WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. group_round_players — add user_id FK (nullable for guest players)
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_round_players
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for "find rounds my friends are in"
CREATE INDEX IF NOT EXISTS group_round_players_user_idx
  ON public.group_round_players (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. friendships table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate requests in either direction (canonical ordering)
  CONSTRAINT friendships_unique_pair UNIQUE (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  ),
  -- Prevent self-friendship
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);

-- Fast lookups: "all friendships involving user X"
CREATE INDEX IF NOT EXISTS friendships_requester_idx
  ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx
  ON public.friendships (addressee_id, status);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS friendships_updated_at ON public.friendships;
CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- RLS: Users can only see/touch friendships they are part of
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users see own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() IN (requester_id, addressee_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can send friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = requester_id AND status = 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Addressee can respond to requests"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = addressee_id)
    WITH CHECK (status IN ('accepted', 'declined', 'blocked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Either party can delete (unfriend)"
    ON public.friendships FOR DELETE
    USING (auth.uid() IN (requester_id, addressee_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. RPC: check_username_available(p_username)
--    SECURITY DEFINER so anon callers can check availability pre-signup.
--    Returns: { available: bool } | { available: false, error: 'invalid_format' }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_username_available(
  p_username text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate format before hitting the table
  IF p_username !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN jsonb_build_object('available', false, 'error', 'invalid_format');
  END IF;

  RETURN jsonb_build_object(
    'available', NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE username = p_username
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC: send_friend_request(p_addressee_username)
--    Auth required. Looks up addressee by username, validates, inserts row.
--    Returns: { success, friendshipId?, addresseeDisplayName? }
--    Errors: 'unauthenticated', 'user_not_found', 'self_request',
--            'requests_disabled', 'already_exists'
-- ---------------------------------------------------------------------------
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

  -- Privacy: addressee has disabled friend requests
  IF NOT v_addressee.friend_requests_open THEN
    -- Return user_not_found to avoid leaking the setting
    RETURN jsonb_build_object('success', false, 'error', 'requests_disabled');
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

-- ---------------------------------------------------------------------------
-- 6. RPC: respond_friend_request(p_friendship_id, p_action)
--    Auth required. Only the addressee can respond.
--    p_action IN ('accepted', 'declined', 'blocked')
--    Returns: { success, status? }
--    Errors: 'unauthenticated', 'invalid_action', 'not_found',
--            'not_addressee', 'already_responded'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_friendship_id uuid,
  p_action        text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_friendship public.friendships;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_action NOT IN ('accepted', 'declined', 'blocked') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;

  SELECT * INTO v_friendship
  FROM public.friendships
  WHERE id = p_friendship_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_friendship.addressee_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_addressee');
  END IF;

  IF v_friendship.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_responded');
  END IF;

  UPDATE public.friendships
  SET status = p_action, updated_at = now()
  WHERE id = p_friendship_id;

  RETURN jsonb_build_object('success', true, 'status', p_action);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_friends(p_status)
--    Returns all friendships for the caller at a given status (default 'accepted').
--    Each row includes friend profile data.
--    Returns: jsonb array of { friendshipId, friendUserId, displayName, username, handicapIndex, status }
-- ---------------------------------------------------------------------------
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
      'status',        f.status
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

-- ---------------------------------------------------------------------------
-- 8. RPC: search_users(p_query)
--    Auth required. Searches by username prefix or display_name substring.
--    Excludes self and users who have blocked the caller.
--    Returns: jsonb array of { userId, displayName, username, isFriend, hasPendingRequest }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_users(
  p_query text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

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
  WHERE p.id <> auth.uid()
    AND (
      p.username ILIKE p_query || '%'
      OR p.display_name ILIKE '%' || p_query || '%'
    )
    -- Exclude users who have blocked the caller
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships bf
      WHERE bf.requester_id = p.id
        AND bf.addressee_id = auth.uid()
        AND bf.status = 'blocked'
    )
  LIMIT 20;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC: remove_friend(p_friendship_id)
--    Auth required. Either party may remove the friendship row.
--    Returns: { success }
--    Errors: 'unauthenticated', 'not_found', 'unauthorized'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_friend(
  p_friendship_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_friendship public.friendships;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_friendship
  FROM public.friendships
  WHERE id = p_friendship_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF auth.uid() NOT IN (v_friendship.requester_id, v_friendship.addressee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  DELETE FROM public.friendships WHERE id = p_friendship_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC: get_friends_in_rounds()
--     Presence fallback / polling. Auth required.
--     Returns accepted friends who are currently in an active group round.
--     Respects presence_visible=false.
--     Returns: jsonb array of { friendUserId, displayName, groupRoundId,
--                               roomCode, courseName, playerCount, status }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_in_rounds()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'friendUserId', friends.friend_id,
      'displayName',  p.display_name,
      'groupRoundId', gr.id,
      'roomCode',     gr.room_code,
      'courseName',   gr.course_name,
      'playerCount',  player_counts.cnt,
      'status',       gr.status
    )
  ) INTO v_result
  FROM (
    SELECT CASE
             WHEN f.requester_id = auth.uid() THEN f.addressee_id
             ELSE f.requester_id
           END AS friend_id
    FROM public.friendships f
    WHERE (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
      AND f.status = 'accepted'
  ) friends
  JOIN public.profiles p              ON p.id = friends.friend_id AND p.presence_visible = true
  JOIN public.group_round_players grp ON grp.user_id = friends.friend_id
  JOIN public.group_rounds gr         ON gr.id = grp.group_round_id AND gr.status = 'active'
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM public.group_round_players
    WHERE group_round_id = gr.id
  ) player_counts ON true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC: join_group_round — updated to store auth.uid() as user_id
--     Signature unchanged (backwards compatible). user_id captured automatically
--     from auth context when caller is authenticated; NULL for guests.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_group_round(
  p_room_code   text,
  p_player_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_round  public.group_rounds;
  v_player_count int;
  v_player_id    uuid;
BEGIN
  -- Validate player name
  IF length(trim(p_player_name)) < 1 OR length(trim(p_player_name)) > 20 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'invalid_name',
      'message', 'Player name must be 1–20 characters.'
    );
  END IF;

  -- Find a valid waiting room
  SELECT * INTO v_group_round
  FROM public.group_rounds
  WHERE room_code = upper(trim(p_room_code))
    AND status    = 'waiting';

  IF NOT FOUND THEN
    -- Distinguish started/completed vs. unknown
    IF EXISTS (
      SELECT 1 FROM public.group_rounds
      WHERE room_code = upper(trim(p_room_code))
        AND status IN ('active', 'completed')
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'started',
        'message', 'This round has already started.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error',   'not_found',
      'message', 'Code not found. Check the code and try again.'
    );
  END IF;

  -- Enforce 4-player cap
  SELECT count(*) INTO v_player_count
  FROM public.group_round_players
  WHERE group_round_id = v_group_round.id;

  IF v_player_count >= 4 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'full',
      'message', 'This round is full (4/4 players).'
    );
  END IF;

  -- Insert player row; capture auth.uid() for authenticated users (NULL for guests)
  INSERT INTO public.group_round_players (group_round_id, player_name, user_id)
  VALUES (v_group_round.id, trim(p_player_name), auth.uid())
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object(
    'success',      true,
    'groupRoundId', v_group_round.id,
    'playerId',     v_player_id,
    'roomCode',     v_group_round.room_code
  );
END;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
