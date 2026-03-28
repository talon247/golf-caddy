-- =============================================================================
-- Golf Caddy: Add course_rating/slope_rating to group_rounds + update RPCs
-- Migration: 20260328000001_group_round_handicap_fields.sql
-- Author: Software Engineer (THEA-122)
-- Parent: THEA-121 (Course search + auto-populate pars in group round host)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add handicap fields to group_rounds table
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_rounds
  ADD COLUMN IF NOT EXISTS course_rating NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS slope_rating  INT;

-- ---------------------------------------------------------------------------
-- 2. start_group_round (updated)
--    Accepts and stores course_rating + slope_rating.
--    NOTE: p_host_name removed — host_name is set on insert, not here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_group_round(
  p_group_round_id UUID,
  p_course_name    TEXT,
  p_hole_count     INT,
  p_pars           INT[],
  p_course_rating  NUMERIC DEFAULT NULL,
  p_slope_rating   INT DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row public.group_rounds;
BEGIN
  UPDATE public.group_rounds
  SET course_name   = p_course_name,
      hole_count    = p_hole_count,
      pars          = p_pars,
      course_rating = p_course_rating,
      slope_rating  = p_slope_rating,
      status        = 'active',
      updated_at    = now()
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
    'pars',         v_row.pars,
    'courseRating', v_row.course_rating,
    'slopeRating',  v_row.slope_rating
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. get_group_round_lobby (updated)
--    Returns courseRating + slopeRating so joiners get full course context.
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
    'id',           v_group_round.id,
    'roomCode',     v_group_round.room_code,
    'hostName',     v_group_round.host_name,
    'status',       v_group_round.status,
    'courseName',   v_group_round.course_name,
    'holeCount',    v_group_round.hole_count,
    'pars',         v_group_round.pars,
    'courseRating', v_group_round.course_rating,
    'slopeRating',  v_group_round.slope_rating,
    'players',      coalesce(v_players, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. join_group_round (updated)
--    Returns courseRating + slopeRating so catch-up joiners get handicap data.
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
    'pars',         v_group_round.pars,
    'courseRating', v_group_round.course_rating,
    'slopeRating',  v_group_round.slope_rating
  );
END;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
