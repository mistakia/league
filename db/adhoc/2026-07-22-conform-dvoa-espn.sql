-- Conform the DVOA + ESPN win-rates + receiving-metrics time-series cluster.
--
-- BATCH cron-import tables (writers: scripts/import-dvoa-sheets.mjs,
-- scripts/import-espn-line-win-rates.mjs,
-- scripts/import-espn-receiving-tracking-metrics.mjs); no continuous PM2 worker,
-- so a coordinated metadata flip is safe. Combined per-table-group conform:
--   bare `year`      -> season_year
--   `seas_type`      -> season_type   (espn_receiving_metrics_history only)
--   epoch `timestamp`(int/bigint) -> observed_at timestamptz  (USING to_timestamp)
-- No epoch DEFAULT is present on any timestamp column in this batch, so no
-- DROP DEFAULT step is needed. footballoutsiders (dead table, drop-review) is
-- EXCLUDED pending an operator drop-vs-keep ruling.
--
-- Mirrors db/adhoc/2026-07-22-nfl-team-gamelogs-conform.sql (rename +
-- constraint/index rename) and db/adhoc/2026-07-22-changelog-unify-small.sql
-- (epoch->timestamptz retype).
--
-- yarn db:exec db/adhoc/2026-07-22-conform-dvoa-espn.sql
-- yarn export:schema

SET LOCAL statement_timeout = 0;

-- =============================================================================
-- DVOA cluster (writer: scripts/import-dvoa-sheets.mjs).
-- =============================================================================

-- dvoa_team_gamelogs (PK name generic, no rename needed)
ALTER TABLE public.dvoa_team_gamelogs RENAME COLUMN year TO season_year;
ALTER TABLE public.dvoa_team_gamelogs
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.dvoa_team_gamelogs RENAME COLUMN "timestamp" TO observed_at;

-- dvoa_team_seasonlogs_history (UNIQUE name embeds "year")
ALTER TABLE public.dvoa_team_seasonlogs_history RENAME COLUMN year TO season_year;
ALTER TABLE public.dvoa_team_seasonlogs_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.dvoa_team_seasonlogs_history RENAME COLUMN "timestamp" TO observed_at;
ALTER TABLE public.dvoa_team_seasonlogs_history
  RENAME CONSTRAINT dvoa_team_seasonlogs_history_year_team_week_key
  TO dvoa_team_seasonlogs_history_season_year_team_week_key;

-- dvoa_team_seasonlogs_index (PK name generic, no rename needed)
ALTER TABLE public.dvoa_team_seasonlogs_index RENAME COLUMN year TO season_year;
ALTER TABLE public.dvoa_team_seasonlogs_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.dvoa_team_seasonlogs_index RENAME COLUMN "timestamp" TO observed_at;

-- dvoa_team_unit_seasonlogs_history (UNIQUE name embeds "year"; literal swap would
-- exceed the 63-byte identifier limit at 65 chars -- drop the redundant "team_"
-- before "team_unit" to fit at 60 chars).
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN year TO season_year;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.dvoa_team_unit_seasonlogs_history RENAME COLUMN "timestamp" TO observed_at;
ALTER TABLE public.dvoa_team_unit_seasonlogs_history
  RENAME CONSTRAINT dvoa_team_unit_seasonlogs_his_year_team_team_unit_week_key
  TO dvoa_team_unit_seasonlogs_his_season_year_team_unit_week_key;

-- dvoa_team_unit_seasonlogs_index (UNIQUE name embeds "year", fits at 62 chars)
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN year TO season_year;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.dvoa_team_unit_seasonlogs_index RENAME COLUMN "timestamp" TO observed_at;
ALTER TABLE public.dvoa_team_unit_seasonlogs_index
  RENAME CONSTRAINT dvoa_team_unit_seasonlogs_index_year_team_team_unit_key
  TO dvoa_team_unit_seasonlogs_index_season_year_team_team_unit_key;

-- =============================================================================
-- ESPN win-rates cluster (writer: scripts/import-espn-line-win-rates.mjs).
-- =============================================================================

-- espn_player_win_rates_history (PK name generic)
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN year TO season_year;
ALTER TABLE public.espn_player_win_rates_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.espn_player_win_rates_history RENAME COLUMN "timestamp" TO observed_at;
ALTER INDEX public.idx_espn_player_win_rates_history_year
  RENAME TO idx_espn_player_win_rates_history_season_year;

-- espn_player_win_rates_index (PK name generic)
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN year TO season_year;
ALTER TABLE public.espn_player_win_rates_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.espn_player_win_rates_index RENAME COLUMN "timestamp" TO observed_at;

-- espn_team_win_rates_history (PK name generic)
ALTER TABLE public.espn_team_win_rates_history RENAME COLUMN year TO season_year;
ALTER TABLE public.espn_team_win_rates_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.espn_team_win_rates_history RENAME COLUMN "timestamp" TO observed_at;
ALTER INDEX public.idx_espn_team_win_rates_history_year
  RENAME TO idx_espn_team_win_rates_history_season_year;

-- espn_team_win_rates_index (PK name generic)
ALTER TABLE public.espn_team_win_rates_index RENAME COLUMN year TO season_year;
ALTER TABLE public.espn_team_win_rates_index
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.espn_team_win_rates_index RENAME COLUMN "timestamp" TO observed_at;

-- =============================================================================
-- espn_receiving_metrics_history (writer:
-- scripts/import-espn-receiving-tracking-metrics.mjs). No PK; the unique index
-- name does not embed year/seas_type/timestamp, so it auto-follows the renames.
-- Still missing its _index partner (out of scope, not created here).
-- =============================================================================
ALTER TABLE public.espn_receiving_metrics_history RENAME COLUMN year TO season_year;
ALTER TABLE public.espn_receiving_metrics_history RENAME COLUMN seas_type TO season_type;
ALTER TABLE public.espn_receiving_metrics_history
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.espn_receiving_metrics_history RENAME COLUMN "timestamp" TO observed_at;
