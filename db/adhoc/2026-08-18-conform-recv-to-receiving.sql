-- Conform the recv_ prefix to receiving_ across seven tables.
--
-- Task: user:task/league/conform-recv-prefix-to-receiving.md
-- Ruling: recv -> receiving, 2026-08-13, guideline/nfl/league/database-schema-standards.md
--
-- 41 RENAME COLUMN statements across nfl_team_seasonlogs (17),
-- player_receiving_gamelogs (18), player_defender_gamelogs (2), nfl_plays (1, parent
-- only -- propagates to all 27 partition children), nfl_plays_current_week (1),
-- espn_receiving_metrics_history (1) and player_seasonlogs (1).
--
-- Plus the percentiles data migration: percentiles.field stores COLUMN NAMES as data,
-- 2,120 rows across 17 field values. The sole writer merges on (percentile_key, field),
-- so a rerun after the rename would write new-name rows and strand the old ones
-- permanently -- the live cpoe failure mode. 125 of those rows are ALREADY stranded at
-- recv_avg_target_separation, whose column was renamed to recv_average_target_separation
-- by an earlier batch without the data migration; this file repairs that strand too.
--
-- db-exec.sh supplies the transaction. No BEGIN/COMMIT here.
--
-- STATUS: APPLIED 2026-08-18 against league_production

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- nfl_team_seasonlogs (17)
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_yards_per_reception TO receiving_yards_per_reception;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_yards_per_route TO receiving_yards_per_route;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_epa TO receiving_epa;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_epa_per_target TO receiving_epa_per_target;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_epa_per_route TO receiving_epa_per_route;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_drops TO receiving_drops;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_drop_rate TO receiving_drop_rate;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_yards_after_catch TO receiving_yards_after_catch;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN expected_recv_yards_after_catch TO expected_receiving_yards_after_catch;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_yards_after_catch_over_expected TO receiving_yards_after_catch_over_expected;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_yards_after_catch_per_reception TO receiving_yards_after_catch_per_reception;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_average_target_separation TO receiving_average_target_separation;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_air_yards TO receiving_air_yards;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_air_yards_per_target TO receiving_air_yards_per_target;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_deep_target_percentage TO receiving_deep_target_percentage;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_tight_window_percentage TO receiving_tight_window_percentage;
ALTER TABLE nfl_team_seasonlogs RENAME COLUMN recv_yards_15_plus_rate TO receiving_yards_15_plus_rate;

-- player_receiving_gamelogs (18)
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_per_reception TO receiving_yards_per_reception;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_per_route TO receiving_yards_per_route;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_epa TO receiving_epa;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_epa_per_target TO receiving_epa_per_target;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_epa_per_route TO receiving_epa_per_route;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_drops TO receiving_drops;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_drop_rate TO receiving_drop_rate;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_after_catch TO receiving_yards_after_catch;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN expected_recv_yards_after_catch TO expected_receiving_yards_after_catch;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_after_catch_over_expected TO receiving_yards_after_catch_over_expected;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_after_catch_per_reception TO receiving_yards_after_catch_per_reception;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_average_target_separation TO receiving_average_target_separation;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_air_yards TO receiving_air_yards;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_air_yards_per_target TO receiving_air_yards_per_target;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_deep_target_percentage TO receiving_deep_target_percentage;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_tight_window_percentage TO receiving_tight_window_percentage;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_15_plus_rate TO receiving_yards_15_plus_rate;
ALTER TABLE player_receiving_gamelogs RENAME COLUMN recv_yards_15_plus_count TO receiving_yards_15_plus_count;

-- player_defender_gamelogs (2)
ALTER TABLE player_defender_gamelogs RENAME COLUMN recv_yards_nearest_defender TO receiving_yards_nearest_defender;
ALTER TABLE player_defender_gamelogs RENAME COLUMN recv_touchdowns_nearest_defender TO receiving_touchdowns_nearest_defender;

-- nfl_plays (1)
-- PARENT only; the rename propagates to all 27 partition children.
ALTER TABLE nfl_plays RENAME COLUMN recv_yards TO receiving_yards;

-- nfl_plays_current_week (1)
ALTER TABLE nfl_plays_current_week RENAME COLUMN recv_yards TO receiving_yards;

-- espn_receiving_metrics_history (1)
ALTER TABLE espn_receiving_metrics_history RENAME COLUMN espn_rtm_recv_yards TO espn_rtm_receiving_yards;

-- player_seasonlogs (1)
ALTER TABLE player_seasonlogs RENAME COLUMN espn_rtm_recv_yards TO espn_rtm_receiving_yards;

-- percentiles.field data migration (2,120 rows across 17 values).
-- Every target value has zero rows today, so no unique-key collision is possible.
UPDATE percentiles SET field = 'receiving_yards_per_reception' WHERE field = 'recv_yards_per_reception';
UPDATE percentiles SET field = 'receiving_yards_per_route' WHERE field = 'recv_yards_per_route';
UPDATE percentiles SET field = 'receiving_epa' WHERE field = 'recv_epa';
UPDATE percentiles SET field = 'receiving_epa_per_target' WHERE field = 'recv_epa_per_target';
UPDATE percentiles SET field = 'receiving_epa_per_route' WHERE field = 'recv_epa_per_route';
UPDATE percentiles SET field = 'receiving_drops' WHERE field = 'recv_drops';
UPDATE percentiles SET field = 'receiving_drop_rate' WHERE field = 'recv_drop_rate';
UPDATE percentiles SET field = 'receiving_yards_after_catch' WHERE field = 'recv_yards_after_catch';
UPDATE percentiles SET field = 'expected_receiving_yards_after_catch' WHERE field = 'expected_recv_yards_after_catch';
UPDATE percentiles SET field = 'receiving_yards_after_catch_over_expected' WHERE field = 'recv_yards_after_catch_over_expected';
UPDATE percentiles SET field = 'receiving_yards_after_catch_per_reception' WHERE field = 'recv_yards_after_catch_per_reception';
UPDATE percentiles SET field = 'receiving_average_target_separation' WHERE field = 'recv_average_target_separation';
UPDATE percentiles SET field = 'receiving_air_yards' WHERE field = 'recv_air_yards';
UPDATE percentiles SET field = 'receiving_air_yards_per_target' WHERE field = 'recv_air_yards_per_target';
UPDATE percentiles SET field = 'receiving_deep_target_percentage' WHERE field = 'recv_deep_target_percentage';
UPDATE percentiles SET field = 'receiving_tight_window_percentage' WHERE field = 'recv_tight_window_percentage';
UPDATE percentiles SET field = 'receiving_yards_15_plus_rate' WHERE field = 'recv_yards_15_plus_rate';

-- Orphan repair: the column became recv_average_target_separation in an earlier batch
-- but its 125 percentile rows were never moved off the pre-rename spelling.
UPDATE percentiles SET field = 'receiving_average_target_separation' WHERE field = 'recv_avg_target_separation';
