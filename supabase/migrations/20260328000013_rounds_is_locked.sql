-- =============================================================================
-- Golf Caddy: Add is_locked to rounds + lock logic for group rounds with side bets
-- Migration: 20260328000013_rounds_is_locked.sql
-- Author: Backend Infrastructure Engineer (THEA-282)
-- Parent: THEA-280 (Lock completed group rounds from deletion)
-- =============================================================================
-- Adds is_locked column to rounds. Locked rounds cannot be soft-deleted.
-- Provides lock_rounds_for_group_round() RPC to lock all participant rounds
-- when a group round with side games completes.
-- Idempotent: ADD COLUMN IF NOT EXISTS; CREATE OR REPLACE for functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add is_locked column to rounds
-- ---------------------------------------------------------------------------
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Index for fast "find locked rounds" queries (sparse, only locked rows)
CREATE INDEX IF NOT EXISTS rounds_is_locked_idx
  ON public.rounds (is_locked)
  WHERE is_locked = true;

-- ---------------------------------------------------------------------------
-- 2. lock_rounds_for_group_round(p_group_round_id uuid)
--    Locks all completed rounds belonging to authenticated participants of a
--    group round that has side_games_enabled = true.
--
--    Match criteria (no direct FK from rounds → group_rounds):
--      - user_id IN (players with user_id IS NOT NULL for this group round)
--      - started_at >= group_round.created_at - 2h  (tolerance for clock skew)
--      - started_at <= group_round.updated_at + 2h   (completed within 2h of group round end)
--      - deleted_at IS NULL
--
--    Returns: jsonb with { locked_count, skipped_reason? }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_rounds_for_group_round(
  p_group_round_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_round   public.group_rounds;
  v_user_ids      uuid[];
  v_locked_count  int;
BEGIN
  -- Validate group round exists
  SELECT * INTO v_group_round
  FROM public.group_rounds
  WHERE id = p_group_round_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'Group round not found.'
    );
  END IF;

  -- Only lock when side games were enabled
  IF NOT v_group_round.side_games_enabled THEN
    RETURN jsonb_build_object(
      'success', true,
      'locked_count', 0,
      'skipped_reason', 'side_games_not_enabled'
    );
  END IF;

  -- Collect authenticated participant user_ids (guests have NULL user_id)
  SELECT ARRAY_AGG(DISTINCT grp.user_id)
    INTO v_user_ids
  FROM public.group_round_players grp
  WHERE grp.group_round_id = p_group_round_id
    AND grp.user_id IS NOT NULL;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'locked_count', 0,
      'skipped_reason', 'no_authenticated_participants'
    );
  END IF;

  -- Lock matching rounds: owned by participants, started within group round window
  UPDATE public.rounds
  SET is_locked = true,
      updated_at = now()
  WHERE user_id = ANY(v_user_ids)
    AND deleted_at IS NULL
    AND is_locked = false
    AND started_at >= (v_group_round.created_at - interval '2 hours')
    AND started_at <= (COALESCE(v_group_round.updated_at, v_group_round.created_at) + interval '2 hours');

  GET DIAGNOSTICS v_locked_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'locked_count', v_locked_count
  );
END;
$$;

-- Grant execute to authenticated users (they call this when completing a group round)
GRANT EXECUTE ON FUNCTION public.lock_rounds_for_group_round(uuid) TO authenticated;

-- =============================================================================
-- End of migration
-- =============================================================================
