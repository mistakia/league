-- STATUS: APPLIED 2026-09-03 against league_production
-- Correct the predicate in db/adhoc/2026-09-03-season-board-unpriced-rows.sql,
-- which was too strict and left 1,020 rows behind.
--
-- NO DDL. One UPDATE against nullable columns.
--
-- THE INVARIANT IS PER VARIANT, not per row. The earlier file required BOTH
-- points-added columns to be NULL before clearing either salary, which reads
-- like caution and is simply the wrong pairing. Each salary column is derived
-- from its OWN aggregate in build-league-format-period-inserts.mjs:
--
--   market_salary_positive <- market_salary['season']     (pairs with projected_points_added_positive)
--   market_salary_net      <- market_salary['season_net'] (pairs with projected_points_added_net)
--
-- So a row may legitimately have no season POSITIVE -- the player was never in
-- the drawn pool -- while still carrying a season NET, which is a sum over the
-- weekly board and a different computation. All 1,020 rows left behind are
-- exactly that shape: positive NULL, net populated and spanning -26.80 to 7.03,
-- and market_salary_positive sitting at 0.00 for every one of them. That 0.00 is
-- the sentinel-era artifact, priced from the -999 and floored, and it is what the
-- first file was written to remove.
--
-- The REST-OF-SEASON table is the control and it already satisfies this
-- invariant with zero violations on both variants, because the deployed writer
-- rewrote it after league 28c83caa2. The season board cannot converge that way
-- -- it seals at the start of week 1 -- which is the whole reason these files
-- exist rather than a note saying to wait for the writer.
--
-- Measured 2026-09-03 before applying: 1,020 positive-variant violations, 0
-- net-variant violations, all in 2026, every salary exactly 0.00.

SET lock_timeout = '30s';
SET statement_timeout = 0;

UPDATE public.league_format_player_season_projection_values
SET market_salary_positive = NULL
WHERE projected_points_added_positive IS NULL
  AND market_salary_positive IS NOT NULL;

UPDATE public.league_format_player_season_projection_values
SET market_salary_net = NULL
WHERE projected_points_added_net IS NULL
  AND market_salary_net IS NOT NULL;

UPDATE public.league_format_player_rest_of_season_projection_values
SET market_salary_positive = NULL
WHERE projected_points_added_positive IS NULL
  AND market_salary_positive IS NOT NULL;

UPDATE public.league_format_player_rest_of_season_projection_values
SET market_salary_net = NULL
WHERE projected_points_added_net IS NULL
  AND market_salary_net IS NOT NULL;
