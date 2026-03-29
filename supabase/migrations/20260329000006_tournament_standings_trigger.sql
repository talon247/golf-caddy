-- =============================================================================
-- Golf Caddy: Tournament Standings Computation Trigger + Points Engine
-- Migration: 20260329000006_tournament_standings_trigger.sql
-- Author: Backend Infrastructure Engineer (THEA-419)
-- PRD: THEA-396 (Tournament Mode)
-- =============================================================================
-- Idempotent: uses CREATE OR REPLACE for functions, DROP TRIGGER IF EXISTS,
-- and ALTER TABLE ... ADD COLUMN IF NOT EXISTS. Safe to re-run.
--
-- Deliverables:
--   1. tournament_standings — add last_round_at, total_game_wins columns
--   2. compute_tournament_standings_for(uuid) — internal workhorse (SECURITY DEFINER)
--   3. trg_recompute_tournament_standings()   — trigger function
--   4. tournament_rounds_standings_trigger    — fires AFTER INSERT OR UPDATE
--   5. recompute_tournament_standings(uuid)   — public RPC for manual recompute
--
-- Points presets (stored in tournament_config.points_config jsonb):
--   {"preset":"skins"}     → 2 pts per skin won
--   {"preset":"nassau"}    → 5 pts per nassau leg (front/back/overall)
--   {"preset":"combined"}  → skins (2pts) + nassau (5/5/5)  [default]
--   {"preset":"custom","skins_pts":N,"nassau_front_pts":N,...} → arbitrary values
--
-- Rank ordering:
--   1. total points DESC
--   2. total_game_wins DESC   (head-to-head approximation: most individual wins)
--   3. last_round_at ASC      (earliest to reach current total wins tie)
--
-- Realtime note: tournament_standings changes are pushed to subscribers
-- automatically via Supabase Realtime — no additional setup required.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend tournament_standings with tiebreaker columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournament_standings
  ADD COLUMN IF NOT EXISTS total_game_wins int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_round_at   timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Internal workhorse: compute_tournament_standings_for
--    SECURITY DEFINER so trigger can write standings without user-facing policy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_tournament_standings_for(
  p_tournament_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_config      jsonb;
  v_preset             text;
  v_skins_pts          numeric;
  v_nassau_front_pts   numeric;
  v_nassau_back_pts    numeric;
  v_nassau_overall_pts numeric;
BEGIN
  -- ------------------------------------------------------------------
  -- Resolve points_config (defaults to combined preset if absent)
  -- ------------------------------------------------------------------
  SELECT COALESCE(tc.points_config, '{}'::jsonb)
  INTO v_points_config
  FROM public.tournament_config tc
  WHERE tc.tournament_id = p_tournament_id;

  -- Fall back to combined if no config row exists yet
  IF v_points_config IS NULL THEN
    v_points_config := '{}'::jsonb;
  END IF;

  v_preset := COALESCE(v_points_config->>'preset', 'combined');

  CASE v_preset
    WHEN 'skins' THEN
      v_skins_pts          := COALESCE((v_points_config->>'skins_pts')::numeric,          2);
      v_nassau_front_pts   := 0;
      v_nassau_back_pts    := 0;
      v_nassau_overall_pts := 0;

    WHEN 'nassau' THEN
      v_skins_pts          := 0;
      v_nassau_front_pts   := COALESCE((v_points_config->>'nassau_front_pts')::numeric,   5);
      v_nassau_back_pts    := COALESCE((v_points_config->>'nassau_back_pts')::numeric,    5);
      v_nassau_overall_pts := COALESCE((v_points_config->>'nassau_overall_pts')::numeric, 5);

    WHEN 'custom' THEN
      v_skins_pts          := COALESCE((v_points_config->>'skins_pts')::numeric,          0);
      v_nassau_front_pts   := COALESCE((v_points_config->>'nassau_front_pts')::numeric,   0);
      v_nassau_back_pts    := COALESCE((v_points_config->>'nassau_back_pts')::numeric,    0);
      v_nassau_overall_pts := COALESCE((v_points_config->>'nassau_overall_pts')::numeric, 0);

    ELSE -- 'combined' (default)
      v_skins_pts          := COALESCE((v_points_config->>'skins_pts')::numeric,          2);
      v_nassau_front_pts   := COALESCE((v_points_config->>'nassau_front_pts')::numeric,   5);
      v_nassau_back_pts    := COALESCE((v_points_config->>'nassau_back_pts')::numeric,    5);
      v_nassau_overall_pts := COALESCE((v_points_config->>'nassau_overall_pts')::numeric, 5);
  END CASE;

  -- ------------------------------------------------------------------
  -- Upsert standings for all authenticated tournament members
  -- Points are sourced from side_game_results for each non-voided round.
  -- guest_name players (no user_id) are included with 0 points until
  -- a future migration links guest scores.
  -- ------------------------------------------------------------------
  INSERT INTO public.tournament_standings (
    tournament_id, user_id, guest_name,
    points, total_game_wins, rounds_played, last_round_at,
    rank, updated_at
  )
  SELECT
    p_tournament_id,
    tm.user_id,
    tm.guest_name,
    COALESCE(pts.total_points,    0),
    COALESCE(pts.total_game_wins, 0),
    COALESCE(pts.rounds_played,   0),
    pts.last_round_at,
    0,    -- rank assigned in the next step
    now()
  FROM public.tournament_members tm
  LEFT JOIN (
    -- ---------------------------------------------------------------
    -- Aggregate per-player stats across all non-voided rounds
    -- ---------------------------------------------------------------
    SELECT
      tr.player_id                                       AS user_id,
      COUNT(DISTINCT tr.id)                              AS rounds_played,
      MAX(tr.counted_at)                                 AS last_round_at,
      -- Total game-segment wins (head-to-head approximation)
      COALESCE(SUM(
        COALESCE(w.skins_wins,        0) +
        COALESCE(w.nassau_front_wins, 0) +
        COALESCE(w.nassau_back_wins,  0) +
        COALESCE(w.nassau_overall_wins, 0)
      ), 0)                                              AS total_game_wins,
      -- Weighted points
      COALESCE(SUM(
        COALESCE(w.skins_wins,          0) * v_skins_pts          +
        COALESCE(w.nassau_front_wins,   0) * v_nassau_front_pts   +
        COALESCE(w.nassau_back_wins,    0) * v_nassau_back_pts    +
        COALESCE(w.nassau_overall_wins, 0) * v_nassau_overall_pts
      ), 0)                                              AS total_points
    FROM public.tournament_rounds tr
    -- Per-round, per-player win counts via LATERAL
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (
          WHERE sgr.game_type = 'skins'
        )                                                AS skins_wins,
        COUNT(*) FILTER (
          WHERE sgr.game_type = 'nassau_front'
        )                                                AS nassau_front_wins,
        COUNT(*) FILTER (
          WHERE sgr.game_type = 'nassau_back'
        )                                                AS nassau_back_wins,
        COUNT(*) FILTER (
          WHERE sgr.game_type = 'nassau_overall'
        )                                                AS nassau_overall_wins
      FROM public.side_game_results sgr
      JOIN public.group_round_players grp
        ON grp.id       = sgr.winner_player_id
       AND grp.user_id  = tr.player_id          -- link back to authenticated user
      WHERE sgr.group_round_id = tr.group_round_id
    ) w ON true
    WHERE tr.tournament_id  = p_tournament_id
      AND tr.voided_at      IS NULL             -- exclude voided rounds
      AND tr.player_id      IS NOT NULL         -- authenticated players only
      AND tr.group_round_id IS NOT NULL         -- must have a group round for side games
    GROUP BY tr.player_id
  ) pts ON pts.user_id = tm.user_id
  WHERE tm.tournament_id = p_tournament_id
    AND tm.user_id IS NOT NULL                  -- skip guest-only rows for now
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET
    points          = EXCLUDED.points,
    total_game_wins = EXCLUDED.total_game_wins,
    rounds_played   = EXCLUDED.rounds_played,
    last_round_at   = EXCLUDED.last_round_at,
    updated_at      = now();

  -- ------------------------------------------------------------------
  -- Assign ranks using RANK() window function with tiebreakers:
  --   1. points DESC
  --   2. total_game_wins DESC  (head-to-head: most individual wins)
  --   3. last_round_at ASC     (earlier achievement of current total)
  -- RANK() allows ties — players with identical scores share the same rank.
  -- ------------------------------------------------------------------
  WITH ranked AS (
    SELECT
      ts.id,
      RANK() OVER (
        PARTITION BY ts.tournament_id
        ORDER BY
          ts.points           DESC,
          ts.total_game_wins  DESC,
          ts.last_round_at    ASC NULLS LAST
      ) AS new_rank
    FROM public.tournament_standings ts
    WHERE ts.tournament_id = p_tournament_id
  )
  UPDATE public.tournament_standings ts
  SET rank = ranked.new_rank
  FROM ranked
  WHERE ts.id = ranked.id;

END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger function: delegates to compute_tournament_standings_for
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_recompute_tournament_standings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT: always recompute (new round added)
  -- UPDATE: only recompute if voided_at changed (round voided or un-voided)
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND OLD.voided_at IS DISTINCT FROM NEW.voided_at)
  THEN
    PERFORM public.compute_tournament_standings_for(NEW.tournament_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Attach trigger to tournament_rounds
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tournament_rounds_standings_trigger ON public.tournament_rounds;

CREATE TRIGGER tournament_rounds_standings_trigger
  AFTER INSERT OR UPDATE ON public.tournament_rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_tournament_standings();

-- ---------------------------------------------------------------------------
-- 5. Public RPC: recompute_tournament_standings
--    For manual recomputation by commissioner/creator (e.g., after data fix).
--    Returns void — client should re-subscribe to tournament_standings Realtime.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_tournament_standings(
  p_tournament_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: creator or commissioner/host only
  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND t.creator_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tournament_members tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.user_id       = auth.uid()
      AND tm.role IN ('commissioner', 'host')
  ) THEN
    RAISE EXCEPTION 'unauthorized: only tournament creator or commissioner may recompute standings';
  END IF;

  PERFORM public.compute_tournament_standings_for(p_tournament_id);
END;
$$;

-- Grant execute to authenticated role for the public RPC
GRANT EXECUTE ON FUNCTION public.recompute_tournament_standings(uuid) TO authenticated;

-- =============================================================================
-- End of migration
-- =============================================================================
