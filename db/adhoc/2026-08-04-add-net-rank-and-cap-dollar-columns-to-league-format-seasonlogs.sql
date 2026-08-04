-- Give league_format_player_seasonlogs the five net columns its generator writes
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- dd48ce077 made the realized seasonlog side symmetric: the net variant gained
-- the four rank columns the earned side already had, and gained a cap-dollar
-- column now that calculatePrices prices both variants. That commit is PUSHED,
-- and none of the five columns exist -- so the moment it deploys,
-- `generate-league-format-player-seasonlogs.mjs` throws
-- `column "points_added_net_rank" ... does not exist` on its insert, taking the
-- whole stats pipeline with it (libs-server/stats-pipeline.mjs:194, and the
-- format-data-generation config that drives it).
--
-- The suite could not catch this. `test/global.mjs` loads db/schema.postgres.sql,
-- which did not carry the columns either, and no spec runs this generator -- so
-- 2947 tests passed over a writer that cannot execute against any database.
--
-- The failure is NOT the table-emptying shape that guards the projection-values
-- writer. This one deletes with `whereNotIn('pid', pids)`, so it removes only
-- excess rows and the throw leaves the table stale rather than empty. Stale is
-- the better failure, but the pipeline still stops.
--
-- Types mirror the earned side exactly: smallint ranks, and a numeric(6,2)
-- cap-dollar column matching earned_salary. Note the earned side spells its
-- cap-dollar column `earned_salary`, which names neither its variant nor its
-- unit; the net column is named for both, per the 2026-08-04 domain rule. The
-- earned column's rename rides the cutover owned by
-- user:task/league/projection-rest-of-season-redesign.md.

ALTER TABLE public.league_format_player_seasonlogs
  ADD COLUMN points_added_net_rank smallint,
  ADD COLUMN points_added_net_position_rank smallint,
  ADD COLUMN points_added_net_per_game_rank smallint,
  ADD COLUMN points_added_net_per_game_position_rank smallint,
  ADD COLUMN points_added_net_cap_dollars numeric(6,2);
