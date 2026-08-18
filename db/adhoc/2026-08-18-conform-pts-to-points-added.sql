-- Conform the pts token to points_added across four tables.
--
-- Task: user:task/league/conform-points-added-vocabulary.md
-- Standard: user:guideline/nfl/league/points-added-valuation.md
--   § "Name the tense, the variant, and the unit"
--
-- 15 RENAME COLUMN statements: the pts-token columns the schema-conformance
-- audit reports, MINUS the three salary_adj_pts_added columns on
-- league_*_projection_values. Those three carry BOTH the adj and the pts token
-- and land with rename-adjusted-valuation-columns, which applies second and
-- takes them to projected_points_added_positive_including_cap_savings in one
-- step. Renaming them here would make that a two-hop rename for no gain and
-- would put an intermediate spelling on the wire.
--
-- Tense is made explicit everywhere. Variant is made explicit only where the
-- producer establishes one:
--
--   `earned` -> `positive` on every column carrying it (the retired token read
--   as tense while meaning variant).
--
--   league_format_player_projection_values{,_history}.pts_added carries NO
--   single variant and does not get one. Measured at
--   libs-shared/calculate-player-values-rest-of-season.mjs:20-42: the variant
--   is carried by the `week` row key, not the column -- 'ros' is positive-only
--   and 'ros_net' is signed, and both live in the same column. Numeric-week
--   rows are signed. A variant token here would be false on most rows. It
--   becomes namable when the period split gives each variant its own column.
--
--   roster_asset_holding.projected_pts_added_at_acquisition inherits that same
--   column (compute-snapshots-bulk.mjs:196-203 reads it at week='0'), so it
--   inherits the same unnamable variant.
--   projected_pts_added_remaining_at_termination is written null by its only
--   writer (generate-roster-asset-lineage.mjs:163) and has no producer to read
--   a variant from.
--
-- db-exec.sh supplies the transaction. No BEGIN/COMMIT here.
--
-- STATUS: APPLIED 2026-08-18 against league_production

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- league_format_player_projection_values (1)
ALTER TABLE league_format_player_projection_values RENAME COLUMN pts_added TO projected_points_added;

-- league_format_player_projection_values_history (1)
ALTER TABLE league_format_player_projection_values_history RENAME COLUMN pts_added TO projected_points_added;

-- league_team_player_seasonlogs (6)
ALTER TABLE league_team_player_seasonlogs RENAME COLUMN pts_added_earned_rostered TO realized_points_added_positive_rostered;
ALTER TABLE league_team_player_seasonlogs RENAME COLUMN pts_added_net_rostered TO realized_points_added_net_rostered;
ALTER TABLE league_team_player_seasonlogs RENAME COLUMN pts_added_earned_started TO realized_points_added_positive_started;
ALTER TABLE league_team_player_seasonlogs RENAME COLUMN pts_added_net_started TO realized_points_added_net_started;
ALTER TABLE league_team_player_seasonlogs RENAME COLUMN pts_added_earned_optimal TO realized_points_added_positive_optimal;
ALTER TABLE league_team_player_seasonlogs RENAME COLUMN pts_added_net_optimal TO realized_points_added_net_optimal;

-- roster_asset_holding (7)
ALTER TABLE roster_asset_holding RENAME COLUMN projected_pts_added_at_acquisition TO projected_points_added_at_acquisition;
ALTER TABLE roster_asset_holding RENAME COLUMN projected_pts_added_remaining_at_termination TO projected_points_added_remaining_at_termination;
ALTER TABLE roster_asset_holding RENAME COLUMN realized_pts_added_net_through_termination TO realized_points_added_net_through_termination;
ALTER TABLE roster_asset_holding RENAME COLUMN realized_pts_added_earned_through_termination TO realized_points_added_positive_through_termination;
ALTER TABLE roster_asset_holding RENAME COLUMN realized_pts_added_net_in_active_slot TO realized_points_added_net_in_active_slot;
ALTER TABLE roster_asset_holding RENAME COLUMN realized_pts_added_net_in_started_slot TO realized_points_added_net_in_started_slot;
ALTER TABLE roster_asset_holding RENAME COLUMN realized_pts_added_net_in_practice_squad_slot TO realized_points_added_net_in_practice_squad_slot;

-- view_trade_asset_flow (1 output alias)
--
-- Postgres rewrites a view's stored parse tree when the underlying column is
-- renamed, so the view body above follows automatically -- but the view's OWN
-- output column is an ALIAS, and an alias does not move. Without this the
-- rename leaves a pts-token name on the view, which the table audit does not
-- see because it reads CREATE TABLE only. The alias has no code consumer
-- (git grep: the view definition and three historical adhoc files, nothing
-- else), so conforming it now is free.
ALTER VIEW view_trade_asset_flow RENAME COLUMN pts_added_before_trade TO realized_points_added_net_before_trade;
