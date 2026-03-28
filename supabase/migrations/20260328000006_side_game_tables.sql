-- =============================================================================
-- Golf Caddy: Side Game Tables
-- Migration: 20260328000006_side_game_tables.sql
-- Author: Backend Infrastructure Engineer (THEA-196)
-- PRD: docs/specs/v3-PRD-side-games-skins.md §8 Data Model
-- Parent: THEA-193
-- =============================================================================
-- Idempotent: uses IF NOT EXISTS guards and
--   DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$
--   for constraints and policies. Safe to re-run.
--
-- RLS note: group_rounds uses open/anonymous access (no host_user_id column).
--   side_game_configs and side_game_results follow the same open policy pattern.
--   settlement_history uses auth.uid()-based policies since it has user_id columns.
--   Host-enforced RLS for configs will require a future migration that adds
--   host_user_id to group_rounds.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Alter group_rounds — add side_games_enabled
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_rounds
  ADD COLUMN IF NOT EXISTS side_games_enabled boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. side_game_configs
--    One config row per group round (enforced by UNIQUE on group_round_id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.side_game_configs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_round_id          uuid        NOT NULL REFERENCES public.group_rounds(id) ON DELETE CASCADE,
  game_types              jsonb       NOT NULL DEFAULT '[]'::jsonb,
                                      -- e.g. ["skins", "nassau", "press", "stableford"]
  stake_per_skin          numeric,    -- nullable; dollar amount per skin
  nassau_stake_front      numeric,
  nassau_stake_back       numeric,
  nassau_stake_overall    numeric,
  press_enabled           boolean     NOT NULL DEFAULT true,
  press_trigger_threshold int         NOT NULL DEFAULT 2,
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT side_game_configs_one_per_round UNIQUE (group_round_id)
);

-- Note: no separate index needed — the UNIQUE constraint on group_round_id
--   creates an implicit unique index that serves all lookup purposes.

ALTER TABLE public.side_game_configs ENABLE ROW LEVEL SECURITY;

-- Open policies: group rounds are anonymous/public in MVP; no host_user_id exists
DO $$ BEGIN
  CREATE POLICY "side_game_configs_public_select"
    ON public.side_game_configs FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "side_game_configs_public_insert"
    ON public.side_game_configs FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "side_game_configs_public_update"
    ON public.side_game_configs FOR UPDATE
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. side_game_results
--    One row per resolved game segment (skin, nassau leg, press, stableford).
--    winner/loser are player rows from group_round_players; nullable for ties.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.side_game_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_round_id   uuid        NOT NULL REFERENCES public.group_rounds(id) ON DELETE CASCADE,
  game_type        text        NOT NULL
                   CHECK (game_type IN (
                     'skins', 'nassau_front', 'nassau_back', 'nassau_overall',
                     'press', 'stableford'
                   )),
  winner_player_id uuid        REFERENCES public.group_round_players(id) ON DELETE SET NULL,
  loser_player_id  uuid        REFERENCES public.group_round_players(id) ON DELETE SET NULL,
  amount_owed      numeric     NOT NULL DEFAULT 0,
  hole_range       int4range,  -- e.g. [1,9] for front 9, [1,18] for overall
  metadata         jsonb,      -- carry count, press sub-id, stableford points, etc.
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS side_game_results_round_idx
  ON public.side_game_results (group_round_id);

CREATE INDEX IF NOT EXISTS side_game_results_game_type_idx
  ON public.side_game_results (group_round_id, game_type);

ALTER TABLE public.side_game_results ENABLE ROW LEVEL SECURITY;

-- Open policies: tied to public group_round rows
DO $$ BEGIN
  CREATE POLICY "side_game_results_public_select"
    ON public.side_game_results FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "side_game_results_public_insert"
    ON public.side_game_results FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. settlement_history
--    Records net amounts owed between authenticated users at round end.
--    from_user_id owes to_user_id net_amount.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid        NOT NULL REFERENCES public.group_rounds(id) ON DELETE CASCADE,
  from_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  net_amount    numeric     NOT NULL DEFAULT 0,
  settled_at    timestamptz NOT NULL DEFAULT now(),

  -- Prevent exact duplicates for the same round/direction
  CONSTRAINT settlement_history_unique_pair UNIQUE (round_id, from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS settlement_history_round_idx
  ON public.settlement_history (round_id);

CREATE INDEX IF NOT EXISTS settlement_history_from_user_idx
  ON public.settlement_history (from_user_id);

CREATE INDEX IF NOT EXISTS settlement_history_to_user_idx
  ON public.settlement_history (to_user_id);

ALTER TABLE public.settlement_history ENABLE ROW LEVEL SECURITY;

-- Auth-based policies: users can only see settlements they are party to
DO $$ BEGIN
  CREATE POLICY "settlement_history_participant_select"
    ON public.settlement_history FOR SELECT
    USING (auth.uid() IN (from_user_id, to_user_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Either participant may write the settlement record at round end
DO $$ BEGIN
  CREATE POLICY "settlement_history_participant_insert"
    ON public.settlement_history FOR INSERT
    WITH CHECK (auth.uid() IN (from_user_id, to_user_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration
-- =============================================================================
