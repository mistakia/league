-- Restructure points_added pipeline:
--   (1) rename points_added* to points_added_earned* at gamelog/seasonlog/careerlog
--   (2) add points_added_net* columns (including careerlog first-N-seasons + best-season buckets)
--   (3) migrate abbreviated suffixes (_seas -> _season(s), _rnk -> _rank, _pos_rnk -> _position_rank)
--   (4) widen league_format_player_projection_values.week to fit the new 'ros_net' synthetic key
--   (5) rewrite user_data_views.table_state JSON keys for the 15 renamed data-view field keys
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).

------------------------------------------------------------------------
-- gamelog
------------------------------------------------------------------------
ALTER TABLE league_format_player_gamelogs
  RENAME COLUMN points_added TO points_added_earned;
ALTER TABLE league_format_player_gamelogs
  ADD COLUMN points_added_net numeric(4,1);

------------------------------------------------------------------------
-- seasonlog: renames + verbose-suffix migration
------------------------------------------------------------------------
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added TO points_added_earned;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_per_game TO points_added_earned_per_game;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_rnk TO points_added_earned_rank;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_pos_rnk TO points_added_earned_position_rank;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_per_game_rnk TO points_added_earned_per_game_rank;
ALTER TABLE league_format_player_seasonlogs
  RENAME COLUMN points_added_per_game_pos_rnk TO points_added_earned_per_game_position_rank;

-- seasonlog: new _net columns
ALTER TABLE league_format_player_seasonlogs
  ADD COLUMN points_added_net numeric(5,1),
  ADD COLUMN points_added_net_per_game numeric(3,1);

------------------------------------------------------------------------
-- careerlog: renames + verbose-suffix migration
------------------------------------------------------------------------
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added TO points_added_earned;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_per_game TO points_added_earned_per_game;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN best_season_points_added_per_game TO best_season_points_added_earned_per_game;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_first_seas TO points_added_earned_first_season;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_second_seas TO points_added_earned_second_season;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_third_seas TO points_added_earned_third_season;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_first_three_seas TO points_added_earned_first_three_seasons;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_first_four_seas TO points_added_earned_first_four_seasons;
ALTER TABLE league_format_player_careerlogs
  RENAME COLUMN points_added_first_five_seas TO points_added_earned_first_five_seasons;

-- careerlog: new _net columns (career + per-game + best-season + first-N-season buckets)
ALTER TABLE league_format_player_careerlogs
  ADD COLUMN points_added_net numeric(6,1),
  ADD COLUMN points_added_net_per_game numeric(3,1),
  ADD COLUMN best_season_points_added_net_per_game numeric(3,1),
  ADD COLUMN points_added_net_first_season numeric(6,1),
  ADD COLUMN points_added_net_second_season numeric(6,1),
  ADD COLUMN points_added_net_third_season numeric(6,1),
  ADD COLUMN points_added_net_first_three_seasons numeric(6,1),
  ADD COLUMN points_added_net_first_four_seasons numeric(6,1),
  ADD COLUMN points_added_net_first_five_seasons numeric(6,1);

------------------------------------------------------------------------
-- projection_values: widen `week` to fit 'ros_net' (7 chars).
-- Current varchar(3) holds numeric weeks ("0".."18") and "ros".
-- Verified 2026-05-16 via SELECT DISTINCT week ...; no unexpected long values present.
------------------------------------------------------------------------
ALTER TABLE league_format_player_projection_values
  ALTER COLUMN week TYPE character varying(10);

------------------------------------------------------------------------
-- user_data_views.table_state JSON rewrite for renamed data-view field keys.
-- Each UPDATE search/replace string is double-quote-anchored so it matches
-- the whole JSON string value and cannot partial-substring-match a longer key
-- (e.g. "player_points_added_from_seasonlogs" cannot match inside
-- "player_points_added_per_game_from_seasonlogs"). Do not drop the quoting.
--
-- Verified 2026-05-16: matching rowcount across all 15 keys = 0; these UPDATEs
-- are currently no-op but are kept for idempotency and to handle any rows
-- written between the verification query and the migration apply.
------------------------------------------------------------------------

-- seasonlog field keys (6)
UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_from_seasonlogs"',
  '"player_points_added_earned_from_seasonlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_from_seasonlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_per_game_from_seasonlogs"',
  '"player_points_added_earned_per_game_from_seasonlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_per_game_from_seasonlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_rank_from_seasonlogs"',
  '"player_points_added_earned_rank_from_seasonlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_rank_from_seasonlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_position_rank_from_seasonlogs"',
  '"player_points_added_earned_position_rank_from_seasonlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_position_rank_from_seasonlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_per_game_rank_from_seasonlogs"',
  '"player_points_added_earned_per_game_rank_from_seasonlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_per_game_rank_from_seasonlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_per_game_position_rank_from_seasonlogs"',
  '"player_points_added_earned_per_game_position_rank_from_seasonlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_per_game_position_rank_from_seasonlogs"%';

-- careerlog field keys (9)
UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_from_careerlogs"',
  '"player_points_added_earned_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_per_game_from_careerlogs"',
  '"player_points_added_earned_per_game_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_per_game_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_best_season_points_added_per_game_from_careerlogs"',
  '"player_best_season_points_added_earned_per_game_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_best_season_points_added_per_game_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_first_season_from_careerlogs"',
  '"player_points_added_earned_first_season_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_first_season_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_second_season_from_careerlogs"',
  '"player_points_added_earned_second_season_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_second_season_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_third_season_from_careerlogs"',
  '"player_points_added_earned_third_season_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_third_season_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_first_three_seasons_from_careerlogs"',
  '"player_points_added_earned_first_three_seasons_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_first_three_seasons_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_first_four_seasons_from_careerlogs"',
  '"player_points_added_earned_first_four_seasons_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_first_four_seasons_from_careerlogs"%';

UPDATE user_data_views
SET table_state = REPLACE(table_state::text,
  '"player_points_added_first_five_seasons_from_careerlogs"',
  '"player_points_added_earned_first_five_seasons_from_careerlogs"')::json
WHERE table_state::text LIKE '%"player_points_added_first_five_seasons_from_careerlogs"%';
