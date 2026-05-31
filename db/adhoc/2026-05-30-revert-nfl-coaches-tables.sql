-- Revert 2026-05-30-create-nfl-coaches-tables.sql.
-- Drop bridge first to release FK references to nfl_coaches.

DROP TABLE nfl_game_coaches;
DROP TABLE nfl_coaches;
