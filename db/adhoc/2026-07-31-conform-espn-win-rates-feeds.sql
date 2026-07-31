-- STATUS: APPLIED 2026-07-31 against league_production
--
-- 2026-07-31: Conform the ESPN win-rates time-series feeds to the schema standard.
--
-- Cluster: the four tables of the ESPN win-rates feed, which are two genuine
-- _history/_index temporal pairs (not snapshot/derived tables):
--   espn_player_win_rates_history / espn_player_win_rates_index
--   espn_team_win_rates_history   / espn_team_win_rates_index
--
-- Both pairs were verified as genuine temporal feeds by rebuilding each _index
-- from its _history and comparing full rows in both directions against the live
-- _index in league_production (2026-07-31):
--
--   player: DISTINCT ON (player_name, espn_id, espn_win_rate_type, season_year)
--           ORDER BY ... observed_at DESC
--           -> 500 rebuilt vs 500 index, 0 rows either direction
--   team:   DISTINCT ON (team, season_year) ORDER BY ... observed_at DESC
--           -> 96 rebuilt vs 96 index, 0 rows either direction
--
-- The DISTINCT ON keys are exactly the importer's onConflict targets in
-- scripts/import-espn-line-win-rates.mjs, so the _index is reproducible from
-- _history by construction and the pair classification is correct.
--
-- These tables already carry season_year (conformed) and timestamptz observed_at,
-- so this cluster is two renames and nothing else:
--
--   espn_id -> espn_player_id   external-id columns follow {system}_{entitytype}_id.
--                               `player.espn_player_id` is the existing precedent and
--                               the importer already queries player by that name.
--   team    -> nfl_team         `team` is a bare ambiguous team-role spelling; the
--                               conformed spelling for an NFL club reference is
--                               nfl_team (as on the dvoa and pff seasonlogs).
--
-- Clears 6 of the 77 findings reported by db/adhoc/audit-schema-conformance.mjs
-- (2 external_id, 4 ambiguous_team). No other rule fires on these tables.
--
-- Primary keys embed both renamed columns:
--   espn_player_win_rates_history_pkey (player_name, espn_id, espn_win_rate_type, observed_at)
--   espn_player_win_rates_index_pkey   (player_name, espn_id, espn_win_rate_type, season_year)
--   espn_team_win_rates_history_pkey   (team, observed_at)
--   espn_team_win_rates_index_pkey     (team, season_year)
-- ALTER TABLE ... RENAME COLUMN carries index and constraint definitions with the
-- column, and none of these constraint or index names embed a renamed column name
-- (idx_espn_player_win_rates_history_espn_win_rate_type names a different column),
-- so no constraint or index is renamed or rebuilt here.
--
-- No foreign keys reference these tables, and no view or rule depends on them.

ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN espn_id TO espn_player_id;
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN team TO nfl_team;

ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN espn_id TO espn_player_id;
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN team TO nfl_team;

ALTER TABLE public.espn_team_win_rates_history RENAME COLUMN team TO nfl_team;

ALTER TABLE public.espn_team_win_rates_index RENAME COLUMN team TO nfl_team;
