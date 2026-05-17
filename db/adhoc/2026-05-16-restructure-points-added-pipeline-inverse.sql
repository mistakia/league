-- Inverse of 2026-05-16-restructure-points-added-pipeline.sql
--
-- Reverts column renames at gamelog/seasonlog/careerlog, drops new _net columns,
-- and narrows league_format_player_projection_values.week back to varchar(3).
--
-- WARNING: only run if no row in league_format_player_projection_values has
-- length(week) > 3. After 'ros_net' has been written, the column narrow will
-- fail. Drop those rows first if needed:
--   DELETE FROM league_format_player_projection_values WHERE week = 'ros_net';
--
-- user_data_views.table_state JSON rewrites are NOT reverted here. If the
-- forward migration's renamed keys were written, they become inert when the
-- new columns are dropped (saved views with renamed keys will fail to resolve
-- the field). Apply the inverse REPLACEs manually only if those saved views
-- need to load against the reverted schema.
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).

------------------------------------------------------------------------
-- gamelog inverse
------------------------------------------------------------------------
ALTER TABLE league_format_player_gamelogs
  DROP COLUMN points_added_net;
ALTER TABLE league_format_player_gamelogs
  RENAME COLUMN points_added_earned TO points_added;

------------------------------------------------------------------------
-- seasonlog inverse
------------------------------------------------------------------------
ALTER TABLE league_format_player_seasonlogs
  DROP COLUMN points_added_net,
  DROP COLUMN points_added_net_per_game;

ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_earned TO points_added;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_earned_per_game TO points_added_per_game;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_earned_rank TO points_added_rnk;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_earned_position_rank TO points_added_pos_rnk;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_earned_per_game_rank TO points_added_per_game_rnk;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_earned_per_game_position_rank TO points_added_per_game_pos_rnk;

------------------------------------------------------------------------
-- careerlog inverse
------------------------------------------------------------------------
ALTER TABLE league_format_player_careerlogs
  DROP COLUMN points_added_net,
  DROP COLUMN points_added_net_per_game,
  DROP COLUMN best_season_points_added_net_per_game,
  DROP COLUMN points_added_net_first_season,
  DROP COLUMN points_added_net_second_season,
  DROP COLUMN points_added_net_third_season,
  DROP COLUMN points_added_net_first_three_seasons,
  DROP COLUMN points_added_net_first_four_seasons,
  DROP COLUMN points_added_net_first_five_seasons;

ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned TO points_added;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_per_game TO points_added_per_game;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN best_season_points_added_earned_per_game TO best_season_points_added_per_game;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_first_season TO points_added_first_seas;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_second_season TO points_added_second_seas;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_third_season TO points_added_third_seas;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_first_three_seasons TO points_added_first_three_seas;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_first_four_seasons TO points_added_first_four_seas;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_earned_first_five_seasons TO points_added_first_five_seas;

------------------------------------------------------------------------
-- projection_values inverse: narrow week back to varchar(3).
-- Will fail if any row has length(week) > 3 (e.g. 'ros_net' written post-forward-migration).
------------------------------------------------------------------------
ALTER TABLE league_format_player_projection_values
  ALTER COLUMN week TYPE character varying(3);
