-- =============================================================================
-- Golf Caddy: Group Round Course Config + start_group_round RPC
-- Migration: 20260327000005_group_round_course_config.sql
-- Author: Software Engineer (THEA-105)
-- Parent: THEA-104 (Group round flow redesign)
-- =============================================================================
-- Changes:
--   1. Add course_name, hole_count, pars columns to group_rounds
--   2. Create start_group_round() RPC — sets course config + status=active
--   3. Replace get_group_round_lobby() — adds courseName, holeCount, pars
--   4. Replace join_group_round() — allows catch-up joins on active rounds
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add course config columns to group_rounds
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_rounds
  ADD COLUMN IF NOT EXISTS course_name TEXT,
  ADD COLUMN IF NOT EXISTS hole_count  INT,
  ADD COLUMN IF NOT EXISTS pars        INT[];

-- ---------------------------------------------------------------------------
-- 2. start_group_round
--    Called by the host when they tap "Start Round" after setup.
--    Sets course config + transitions status to 'active'.
--    Returns jsonb — check 'success' key; 'error' key describes failure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_group_round(
  p_group_round_id UUID,
  p_course_name    TEXT,
  p_hole_count     INT,
  p_pars           INT[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row public.group_rounds;
BEGIN
  UPDATE public.group_rounds
  SET course_name = p_course_name,
      hole_count  = p_hole_count,
      pars        = p_pars,
      status      = 'active',
      updated_at  = now()
  WHERE id = p_group_round_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'groupRoundId', v_row.id,
    'courseName',   v_row.course_name,
    'holeCount',    v_row.hole_count,
    'pars',         v_row.pars
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. get_group_round_lobby (updated)
--    Adds courseName, holeCount, pars to the returned JSONB so joiners
--    can read course config when the round transitions to active.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_group_round_lobby(
  p_room_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_round  public.group_rounds;
  v_players      jsonb;
BEGIN
  SELECT * INTO v_group_round
  FROM public.group_rounds
  WHERE room_code = upper(trim(p_room_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',         grp.id,
      'playerName', grp.player_name,
      'joinedAt',   grp.joined_at
    ) ORDER BY grp.joined_at
  ) INTO v_players
  FROM public.group_round_players grp
  WHERE grp.group_round_id = v_group_round.id;

  RETURN jsonb_build_object(
    'id',         v_group_round.id,
    'roomCode',   v_group_round.room_code,
    'hostName',   v_group_round.host_name,
    'status',     v_group_round.status,
    'courseName', v_group_round.course_name,
    'holeCount',  v_group_round.hole_count,
    'pars',       v_group_round.pars,
    'players',    coalesce(v_players, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. join_group_round (updated)
--    Now allows catch-up joins on active rounds (status 'waiting' OR 'active').
--    Returns course config in the success response so the joiner can skip Setup.
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

  -- Find a valid waiting or active room
  SELECT * INTO v_group_round
  FROM public.group_rounds
  WHERE room_code = upper(trim(p_room_code))
    AND status IN ('waiting', 'active');

  IF NOT FOUND THEN
    -- Distinguish completed vs. unknown
    IF EXISTS (
      SELECT 1 FROM public.group_rounds
      WHERE room_code = upper(trim(p_room_code))
        AND status = 'completed'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'completed',
        'message', 'This round has already completed.'
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

  -- Insert player row
  INSERT INTO public.group_round_players (group_round_id, player_name)
  VALUES (v_group_round.id, trim(p_player_name))
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object(
    'success',      true,
    'groupRoundId', v_group_round.id,
    'playerId',     v_player_id,
    'roomCode',     v_group_round.room_code,
    'status',       v_group_round.status,
    'courseName',   v_group_round.course_name,
    'holeCount',    v_group_round.hole_count,
    'pars',         v_group_round.pars
  );
END;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
