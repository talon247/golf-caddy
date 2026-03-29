-- THEA-439: Add spectator mode columns to group_rounds
-- spectators_enabled: host opt-in (off by default for privacy)
-- spectator_side_games_visible: whether spectators can see side game standings

ALTER TABLE group_rounds
  ADD COLUMN IF NOT EXISTS spectators_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS spectator_side_games_visible BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN group_rounds.spectators_enabled IS 'Whether spectators can view this round via the /watch/:roomCode link';
COMMENT ON COLUMN group_rounds.spectator_side_games_visible IS 'Whether spectators can see side game standings (default: hidden)';
