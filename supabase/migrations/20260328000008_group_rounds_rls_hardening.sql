-- =============================================================================
-- Golf Caddy: Harden Group Rounds RLS
-- Migration: 20260328000008_group_rounds_rls_hardening.sql
-- Author: Backend Infrastructure Engineer (THEA-230)
-- Parent: THEA-227
-- =============================================================================
-- Security fix: addresses four tables with fully open anonymous RLS.
-- Closes THEA-230 findings:
--   (1) Game result tampering — open INSERT on side_game_results
--   (2) Round hijacking     — open UPDATE on group_rounds
--   (3) Uninvited joins     — open INSERT on group_round_players (direct path)
--   (4) Overly permissive   — open INSERT/UPDATE on side_game_configs
--
-- Design decisions:
--   - host_user_id is nullable so existing rows are not broken.
--   - Public SELECT is kept on all four tables (lobby/scoreboard UX requires it).
--   - join_group_round() is SECURITY DEFINER — it bypasses RLS, so guests can
--     still join via the validated RPC. Direct INSERT to group_round_players
--     now requires auth.uid() IS NOT NULL, closing the raw insert path.
--   - All write policies on side_game_configs/results require the caller to be
--     the host of the referenced group round.
--
-- Frontend note (for SE team):
--   GroupRoundHost.tsx must populate host_user_id = auth.uid() when calling
--   supabase.from('group_rounds').insert({...}).
--   Room code generation should also be updated to 6+ alphanumeric chars;
--   the DB schema and unique index support any code length already.
--
-- Idempotent: DROP POLICY IF EXISTS + DO $$ BEGIN ... END $$ guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add host_user_id to group_rounds
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_rounds
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS group_rounds_host_user_idx
  ON public.group_rounds (host_user_id);

-- ---------------------------------------------------------------------------
-- 2. Harden group_rounds policies
--    Keep SELECT public (needed for lobby join UX — players look up by code).
--    Restrict INSERT to authenticated hosts; UPDATE/DELETE to host only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "group_rounds_public_insert" ON public.group_rounds;
DROP POLICY IF EXISTS "group_rounds_public_update" ON public.group_rounds;

-- INSERT: authenticated users only; caller must self-identify as host
DO $$ BEGIN
  CREATE POLICY "group_rounds_auth_insert"
    ON public.group_rounds FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL AND
      host_user_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATE: host only
DO $$ BEGIN
  CREATE POLICY "group_rounds_host_update"
    ON public.group_rounds FOR UPDATE
    USING  (auth.uid() = host_user_id)
    WITH CHECK (auth.uid() = host_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DELETE: host only
DO $$ BEGIN
  CREATE POLICY "group_rounds_host_delete"
    ON public.group_rounds FOR DELETE
    USING (auth.uid() = host_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. Harden group_round_players policies
--    Keep SELECT public (all players need the player list).
--    Restrict direct INSERT to authenticated users (RPC path bypasses via
--    SECURITY DEFINER so guest joins via join_group_round() still work).
--    Restrict DELETE to host only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "group_round_players_public_insert" ON public.group_round_players;
DROP POLICY IF EXISTS "group_round_players_public_delete" ON public.group_round_players;

-- INSERT: authenticated users only for direct inserts
DO $$ BEGIN
  CREATE POLICY "group_round_players_auth_insert"
    ON public.group_round_players FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DELETE: host only
DO $$ BEGIN
  CREATE POLICY "group_round_players_host_delete"
    ON public.group_round_players FOR DELETE
    USING (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_rounds gr
        WHERE gr.id = group_round_id
          AND gr.host_user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. Harden side_game_configs policies
--    Keep SELECT public (all players see game config).
--    Restrict INSERT/UPDATE to the host of the referenced group round.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "side_game_configs_public_insert" ON public.side_game_configs;
DROP POLICY IF EXISTS "side_game_configs_public_update" ON public.side_game_configs;

-- INSERT: host only
DO $$ BEGIN
  CREATE POLICY "side_game_configs_host_insert"
    ON public.side_game_configs FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_rounds gr
        WHERE gr.id = group_round_id
          AND gr.host_user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATE: host only (locked=false enforcement stays at the application layer)
DO $$ BEGIN
  CREATE POLICY "side_game_configs_host_update"
    ON public.side_game_configs FOR UPDATE
    USING (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_rounds gr
        WHERE gr.id = group_round_id
          AND gr.host_user_id = auth.uid()
      )
    )
    WITH CHECK (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_rounds gr
        WHERE gr.id = group_round_id
          AND gr.host_user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 5. Harden side_game_results policies
--    Keep SELECT public (all players see results/scores).
--    Restrict INSERT to the host of the referenced group round.
--    (The host is the one computing and persisting game results at round end.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "side_game_results_public_insert" ON public.side_game_results;

-- INSERT: host only
DO $$ BEGIN
  CREATE POLICY "side_game_results_host_insert"
    ON public.side_game_results FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.group_rounds gr
        WHERE gr.id = group_round_id
          AND gr.host_user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration
-- =============================================================================
