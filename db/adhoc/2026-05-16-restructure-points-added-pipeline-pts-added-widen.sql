-- Hotfix: widen league_format_player_projection_values.pts_added to fit
-- cumulative ros_net values that can exceed numeric(5,2) bounds (>= 999.99
-- absolute). Discovered during cutover: process-projections.mjs threw
-- numeric field overflow when calculate-player-values-rest-of-season started
-- accumulating ros_net across all weeks (positive + negative) for low-scoring
-- bench players where the cumulative negative deviation from baseline goes
-- below -999.99.
--
-- Companion to db/adhoc/2026-05-16-restructure-points-added-pipeline.sql.

ALTER TABLE league_format_player_projection_values
  ALTER COLUMN pts_added TYPE numeric(7,2);
