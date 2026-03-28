-- =============================================================================
-- Golf Caddy: Lock side_game_configs after first score
-- Migration: 20260328000007_side_game_config_locked.sql
-- Author: Software Engineer 2 (THEA-232)
-- Parent: THEA-199
-- =============================================================================
-- Adds a `locked` boolean column to side_game_configs.
-- Once the host enters the first score on any hole, the client sets this to true.
-- The UI then renders the config as read-only and disallows further edits.
-- Idempotent: ADD COLUMN IF NOT EXISTS guard.
-- =============================================================================

ALTER TABLE public.side_game_configs
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- =============================================================================
-- End of migration
-- =============================================================================
