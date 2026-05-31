-- Index nfl_games.nflverse_game_id.
--
-- The nfl_game_coaches bridge joins back to nfl_games on this key
-- (see scripts/import-nfl-coaches.mjs and the ## Coaching Attribution
-- section of user:guideline/nfl/league/nfl-database-analysis.md). The
-- import's per-week UPDATE statements also filter on
-- `nflverse_game_id = ANY(?)`. Without this index both paths
-- seq-scan nfl_games.

CREATE INDEX nfl_games_nflverse_game_id ON nfl_games(nflverse_game_id);
