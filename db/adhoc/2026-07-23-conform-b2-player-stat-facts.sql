-- Conform B2 player-stat-fact tables to full-word vocabulary.
-- year -> season_year, seas_type -> season_type (metadata renames, instant);
-- players_status."timestamp" (epoch int) -> observed_at timestamptz (2.7M-row rewrite);
-- players_status.injury_start_date varchar -> date (verified all values match YYYY-MM-DD);
-- player_team_extension_state.last_refreshed_at timestamp-without-tz -> timestamptz;
-- drop dead frozen snapshot player_gamelogs_active_snapshot_2026_05_23 (0 readers; predrop dump taken).
-- yarn db:exec wraps this in a single txn (no BEGIN/COMMIT here). Raise the 40s prod
-- statement_timeout for the players_status rewrite.
SET LOCAL statement_timeout = '60min';

-- ---- year -> season_year : gamelog stat facts (+ unique-constraint name renames) ----
ALTER TABLE public.player_passing_gamelogs RENAME COLUMN year TO season_year;
ALTER TABLE public.player_passing_gamelogs
  RENAME CONSTRAINT player_passing_gamelogs_esbid_pid_year_unique
  TO player_passing_gamelogs_esbid_pid_season_year_unique;

ALTER TABLE public.player_receiving_gamelogs RENAME COLUMN year TO season_year;
ALTER TABLE public.player_receiving_gamelogs
  RENAME CONSTRAINT player_receiving_gamelogs_esbid_pid_year_unique
  TO player_receiving_gamelogs_esbid_pid_season_year_unique;

ALTER TABLE public.player_rushing_gamelogs RENAME COLUMN year TO season_year;
ALTER TABLE public.player_rushing_gamelogs
  RENAME CONSTRAINT player_rushing_gamelogs_esbid_pid_year_unique
  TO player_rushing_gamelogs_esbid_pid_season_year_unique;

ALTER TABLE public.player_defender_gamelogs RENAME COLUMN year TO season_year;
ALTER TABLE public.player_defender_gamelogs
  RENAME CONSTRAINT player_defender_gamelogs_esbid_pid_year_unique
  TO player_defender_gamelogs_esbid_pid_season_year_unique;

-- ---- year + seas_type : player_seasonlogs ----
ALTER TABLE public.player_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.player_seasonlogs RENAME COLUMN seas_type TO season_type;
ALTER INDEX public.idx_player_seasonlogs_year_seas_type_career_year_pid
  RENAME TO idx_player_seasonlogs_season_year_season_type_career_year_pid;

-- ---- year + seas_type : practice (generated nfl_week_id + reg-week CHECK auto-rewire) ----
ALTER TABLE public.practice RENAME COLUMN year TO season_year;
ALTER TABLE public.practice RENAME COLUMN seas_type TO season_type;

-- ---- year -> season_year : the remaining player-stat facts ----
ALTER TABLE public.player_variance RENAME COLUMN year TO season_year;

ALTER TABLE public.player_dfs_ownership RENAME COLUMN year TO season_year;
ALTER INDEX public.idx_player_dfs_ownership_year_week
  RENAME TO idx_player_dfs_ownership_season_year_week;

ALTER TABLE public.player_game_outcome_correlations RENAME COLUMN year TO season_year;
ALTER INDEX public.idx_player_game_outcome_correlations_year
  RENAME TO idx_player_game_outcome_correlations_season_year;

ALTER TABLE public.position_game_outcome_defaults RENAME COLUMN year TO season_year;
ALTER INDEX public.idx_position_game_outcome_defaults_year
  RENAME TO idx_position_game_outcome_defaults_season_year;

ALTER TABLE public.dfs_contests RENAME COLUMN year TO season_year;
ALTER INDEX public.idx_dfs_contests_year_week
  RENAME TO idx_dfs_contests_season_year_week;

-- player_contracts.year is varchar(5) holding "Total" for aggregate rows; rename only, keep type.
ALTER TABLE public.player_contracts RENAME COLUMN year TO season_year;
ALTER TABLE public.player_contracts
  RENAME CONSTRAINT player_contracts_pid_year_unique
  TO player_contracts_pid_season_year_unique;

-- ---- players_status: "timestamp" epoch int -> observed_at timestamptz + injury_start_date -> date ----
-- idx_24905_status (MySQL-migration artifact name) is the (pid, timestamp) unique upsert target.
ALTER TABLE public.players_status
  ALTER COLUMN "timestamp" TYPE timestamp with time zone USING to_timestamp("timestamp");
ALTER TABLE public.players_status RENAME COLUMN "timestamp" TO observed_at;
ALTER TABLE public.players_status
  ALTER COLUMN injury_start_date TYPE date
  USING (CASE WHEN injury_start_date ~ '^\d{4}-\d{2}-\d{2}$' THEN injury_start_date::date ELSE NULL END);
ALTER INDEX public.idx_24905_status RENAME TO players_status_pid_observed_at_key;

-- ---- player_team_extension_state.last_refreshed_at: timestamp-without-tz -> with-tz (stored UTC wall clock) ----
ALTER TABLE public.player_team_extension_state
  ALTER COLUMN last_refreshed_at TYPE timestamp with time zone
  USING last_refreshed_at AT TIME ZONE 'UTC';

-- ---- drop dead frozen snapshot (predrop safeguard dump taken to base-storage) ----
DROP TABLE public.player_gamelogs_active_snapshot_2026_05_23;
