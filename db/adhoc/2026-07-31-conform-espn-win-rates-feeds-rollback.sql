-- STATUS: PENDING
--
-- ROLLBACK for db/adhoc/2026-07-31-conform-espn-win-rates-feeds.sql.
--
-- Do NOT apply this as part of the forward migration. It exists so the espn
-- win-rates conform can be reversed without re-deriving the mapping under
-- pressure. Applying it requires reverting the consumer sweep in the same
-- commit, exactly as the forward direction did.
--
-- Reverses the 6 renames:
--   espn_player_id -> espn_id   (espn_player_win_rates_history, _index)
--   nfl_team       -> team      (both player tables and both team tables)
--
-- Primary keys and indexes follow the column through RENAME in both directions,
-- so nothing else needs restating here.

ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN espn_player_id TO espn_id;
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN nfl_team TO team;

ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN espn_player_id TO espn_id;
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN nfl_team TO team;

ALTER TABLE public.espn_team_win_rates_history RENAME COLUMN nfl_team TO team;

ALTER TABLE public.espn_team_win_rates_index RENAME COLUMN nfl_team TO team;
