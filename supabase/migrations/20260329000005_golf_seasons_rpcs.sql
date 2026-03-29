-- =============================================================================
-- Golf Caddy: Golf Seasons RPCs
-- Migration: 20260329000005_golf_seasons_rpcs.sql
-- Author: Backend Infrastructure Engineer (THEA-432)
-- PRD: THEA-278 (Golf Seasons)
-- =============================================================================
-- Depends on: 20260329000004_golf_seasons_schema.sql
--
-- Functions:
--   - create_season(p_name, p_start_date, p_end_date, p_points_config)
--   - join_season(p_season_id)
--   - leave_season(p_season_id)
--   - settle_season_points(p_season_id, p_group_round_id, p_settlements)
--   - complete_season(p_season_id)
--
-- All functions are SECURITY DEFINER with explicit auth.uid() checks.
-- Idempotent: CREATE OR REPLACE FUNCTION.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. create_season(p_name, p_start_date, p_end_date, p_points_config)
-- ---------------------------------------------------------------------------
-- Creates a season and adds creator as first member with 100pt balance.
-- Returns: { season_id, name, status }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_season(
  p_name          text,
  p_start_date    date DEFAULT NULL,
  p_end_date      date DEFAULT NULL,
  p_points_config jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_season_id uuid;
  v_default_config jsonb := '{
    "skins_pts": 2,
    "nassau_front": 5,
    "nassau_back": 5,
    "nassau_overall": 5
  }'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  INSERT INTO public.seasons (name, creator_id, status, start_date, end_date, points_config)
  VALUES (
    p_name,
    v_user_id,
    'draft',
    p_start_date,
    p_end_date,
    COALESCE(p_points_config, v_default_config)
  )
  RETURNING id INTO v_season_id;

  -- Creator joins as first member with default 100pt balance
  INSERT INTO public.season_members (season_id, user_id, points_balance)
  VALUES (v_season_id, v_user_id, 100);

  RETURN jsonb_build_object(
    'season_id', v_season_id,
    'name',      p_name,
    'status',    'draft'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_season(text, date, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_season(text, date, date, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. join_season(p_season_id)
-- ---------------------------------------------------------------------------
-- Authenticated user joins an active/draft season.
-- Returns: { season_id, points_balance }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_season(
  p_season_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_season    record;
  v_existing  record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT id, status, creator_id
  INTO v_season
  FROM public.seasons
  WHERE id = p_season_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'season_not_found');
  END IF;

  IF v_season.status NOT IN ('draft', 'active') THEN
    RETURN jsonb_build_object('error', 'season_not_open');
  END IF;

  -- Check if already a member (including those who left)
  SELECT season_id, left_at INTO v_existing
  FROM public.season_members
  WHERE season_id = p_season_id AND user_id = v_user_id;

  IF FOUND THEN
    IF v_existing.left_at IS NULL THEN
      RETURN jsonb_build_object('error', 'already_member');
    ELSE
      -- Rejoin: clear left_at, reset balance to 100
      UPDATE public.season_members
      SET left_at = NULL, points_balance = 100, joined_at = now()
      WHERE season_id = p_season_id AND user_id = v_user_id;

      RETURN jsonb_build_object(
        'season_id',      p_season_id,
        'points_balance', 100
      );
    END IF;
  END IF;

  INSERT INTO public.season_members (season_id, user_id, points_balance)
  VALUES (p_season_id, v_user_id, 100);

  RETURN jsonb_build_object(
    'season_id',      p_season_id,
    'points_balance', 100
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_season(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. leave_season(p_season_id)
-- ---------------------------------------------------------------------------
-- Sets left_at on the member row. Historical transactions preserved.
-- Returns: { success: bool }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_season(
  p_season_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_season   record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT id, creator_id, status INTO v_season
  FROM public.seasons WHERE id = p_season_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'season_not_found');
  END IF;

  -- Creator cannot leave their own season
  IF v_season.creator_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'creator_cannot_leave');
  END IF;

  UPDATE public.season_members
  SET left_at = now()
  WHERE season_id = p_season_id
    AND user_id = v_user_id
    AND left_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_a_member');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_season(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. settle_season_points(p_season_id, p_group_round_id, p_settlements)
-- ---------------------------------------------------------------------------
-- Records points transfers after a round. Deducts from payer, credits payee.
-- p_settlements is a JSON array of:
--   { payer_user_id, payee_user_id, points, game_type }
--
-- Returns: { settled: int, transactions: [...] }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_season_points(
  p_season_id      uuid,
  p_group_round_id uuid DEFAULT NULL,
  p_settlements    jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_season     record;
  v_settlement jsonb;
  v_payer      uuid;
  v_payee      uuid;
  v_points     numeric(10,2);
  v_game_type  public.season_game_type;
  v_txn_id     uuid;
  v_txn_ids    uuid[] := '{}';
  v_count      int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT id, status, creator_id INTO v_season
  FROM public.seasons WHERE id = p_season_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'season_not_found');
  END IF;

  -- Only creator or active member can settle
  IF v_season.status NOT IN ('active', 'draft') THEN
    RETURN jsonb_build_object('error', 'season_not_active');
  END IF;

  IF v_season.creator_id <> v_user_id THEN
    -- Caller must be an active member
    IF NOT EXISTS (
      SELECT 1 FROM public.season_members
      WHERE season_id = p_season_id
        AND user_id = v_user_id
        AND left_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'unauthorized');
    END IF;
  END IF;

  -- Process each settlement
  FOR v_settlement IN SELECT * FROM jsonb_array_elements(p_settlements)
  LOOP
    v_payer     := (v_settlement->>'payer_user_id')::uuid;
    v_payee     := (v_settlement->>'payee_user_id')::uuid;
    v_points    := (v_settlement->>'points')::numeric(10,2);
    v_game_type := (v_settlement->>'game_type')::public.season_game_type;

    -- Validate both parties are active members
    IF NOT EXISTS (
      SELECT 1 FROM public.season_members
      WHERE season_id = p_season_id AND user_id = v_payer AND left_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'payer_not_member', 'payer', v_payer);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.season_members
      WHERE season_id = p_season_id AND user_id = v_payee AND left_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'payee_not_member', 'payee', v_payee);
    END IF;

    -- Insert immutable transaction record
    INSERT INTO public.season_transactions (
      season_id, group_round_id, payer_user_id, payee_user_id, points, game_type
    ) VALUES (
      p_season_id, p_group_round_id, v_payer, v_payee, v_points, v_game_type
    )
    RETURNING id INTO v_txn_id;

    v_txn_ids := array_append(v_txn_ids, v_txn_id);

    -- Adjust balances: deduct from payer, add to payee
    UPDATE public.season_members
    SET points_balance = points_balance - v_points
    WHERE season_id = p_season_id AND user_id = v_payer;

    UPDATE public.season_members
    SET points_balance = points_balance + v_points
    WHERE season_id = p_season_id AND user_id = v_payee;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'settled',      v_count,
    'transaction_ids', to_json(v_txn_ids)::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_season_points(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_season_points(uuid, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. complete_season(p_season_id)
-- ---------------------------------------------------------------------------
-- Creator only. Sets status='completed'. Irreversible.
-- Returns: { success: bool, season_id }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_season(
  p_season_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_season  record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT id, status, creator_id INTO v_season
  FROM public.seasons WHERE id = p_season_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'season_not_found');
  END IF;

  IF v_season.creator_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF v_season.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  IF v_season.status = 'archived' THEN
    RETURN jsonb_build_object('error', 'season_archived');
  END IF;

  UPDATE public.seasons
  SET status = 'completed', updated_at = now()
  WHERE id = p_season_id;

  RETURN jsonb_build_object(
    'success',   true,
    'season_id', p_season_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_season(uuid) TO authenticated;
