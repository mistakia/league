-- Materialize league_team_player_seasonlogs rollup at
-- (lid, tid, pid, year, league_format_hash) grain.
--
-- Captures per-player surplus-value contribution to a specific team in a
-- specific season. Mirrors the league_team_daily_values materialization
-- pattern at player-team-season grain. Both _earned (positive-only) and
-- _net (cumulative) pts_added variants are exposed across rostered,
-- started, and optimal lenses.
--
-- Salary attribution uses start-team-bears-cap: salary_paid is the full
-- league_player_seasonlogs.salary iff tid = start_tid, else 0. Trade-return
-- value lives in a downstream analysis layer joining trades_players.
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).

CREATE TABLE league_team_player_seasonlogs (
  lid integer NOT NULL,
  tid integer NOT NULL,
  pid varchar(25) NOT NULL,
  year smallint NOT NULL,
  league_format_hash varchar(64) NOT NULL,
  weeks_rostered smallint NOT NULL DEFAULT 0,
  weeks_started smallint NOT NULL DEFAULT 0,
  pts_added_earned_rostered numeric(5,1),
  pts_added_net_rostered numeric(5,1),
  pts_added_earned_started numeric(5,1),
  pts_added_net_started numeric(5,1),
  pts_added_earned_optimal numeric(5,1),
  pts_added_net_optimal numeric(5,1),
  salary_paid integer,
  acquisition_type smallint,
  is_start_team boolean NOT NULL,
  is_end_team boolean NOT NULL,
  PRIMARY KEY (lid, tid, pid, year, league_format_hash)
);

CREATE INDEX league_team_player_seasonlogs_lid_tid_year_idx
  ON league_team_player_seasonlogs (lid, tid, year);

CREATE INDEX league_team_player_seasonlogs_lid_pid_year_idx
  ON league_team_player_seasonlogs (lid, pid, year);

COMMENT ON TABLE league_team_player_seasonlogs IS
  'Per-player surplus-value contribution to a specific team in a specific season at (lid, tid, pid, year, league_format_hash) grain. Salary attribution follows start-team-bears-cap: salary_paid carries the full league_player_seasonlogs.salary on the start-team row and 0 on subsequent holders. Trade-return value is computed downstream via trades_players joins.';
