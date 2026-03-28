-- =============================================================================
-- Golf Caddy: Settlement RLS Hardening
-- Migration: 20260328000014_settlement_rls_hardening.sql
-- Author: Backend Infrastructure Engineer (THEA-357)
-- Parent: THEA-344
-- =============================================================================
-- Closes THEA-357: adds server-side guardrails to settlement writes via RLS.
--
-- V1 approach (simpler alternative from ticket):
--   (a) settlement_history INSERT — replace the existing participant-only check
--       with a 3-factor guard:
--         1. Caller must be an authenticated participant in the group round
--         2. The group round must be in 'completed' status
--         3. net_amount must be within [0, 10000]
--   (b) side_game_results INSERT — extend the existing host-only policy to also
--       require the group round is 'completed' and amount_owed is in [0, 10000].
--
-- Why change settlement_history INSERT:
--   The original policy `auth.uid() IN (from_user_id, to_user_id)` breaks for
--   the host writing settlements between OTHER players (host may not be a party).
--   The new policy uses a participant lookup instead, which is more correct and
--   more restrictive.
--
-- Idempotent: DROP POLICY IF EXISTS + DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$ guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Harden settlement_history INSERT
--    Drop the old permissive policy and replace with a 3-factor guard.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "settlement_history_participant_insert" ON public.settlement_history;

-- New policy: participant of the round + round completed + amount bounded
DO $$ BEGIN
  CREATE POLICY "settlement_history_participant_insert_v2"
    ON public.settlement_history FOR INSERT
    WITH CHECK (
      -- Must be authenticated
      auth.uid() IS NOT NULL

      -- Caller must be an authenticated participant of the referenced group round
      AND EXISTS (
        SELECT 1
        FROM public.group_round_players grp
        WHERE grp.group_round_id = round_id
          AND grp.user_id = auth.uid()
      )

      -- The group round must be completed before settlement records are accepted
      AND EXISTS (
        SELECT 1
        FROM public.group_rounds gr
        WHERE gr.id = round_id
          AND gr.status = 'completed'
      )

      -- Amount must be non-negative and within a reasonable ceiling ($10,000)
      AND net_amount >= 0
      AND net_amount <= 10000
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Harden side_game_results INSERT
--    Drop the host-only policy from _008 and replace it with one that also
--    requires the group round to be completed and bounds the amount.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "side_game_results_host_insert" ON public.side_game_results;

-- New policy: host only + round completed + amount bounded
DO $$ BEGIN
  CREATE POLICY "side_game_results_host_insert_v2"
    ON public.side_game_results FOR INSERT
    WITH CHECK (
      -- Must be authenticated
      auth.uid() IS NOT NULL

      -- Caller must be the host of the referenced group round,
      -- AND that round must be completed before results are persisted
      AND EXISTS (
        SELECT 1
        FROM public.group_rounds gr
        WHERE gr.id = group_round_id
          AND gr.host_user_id = auth.uid()
          AND gr.status = 'completed'
      )

      -- Amount must be non-negative and within a reasonable ceiling ($10,000)
      AND amount_owed >= 0
      AND amount_owed <= 10000
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration
-- =============================================================================
