-- STATUS: APPLIED 2026-09-03 against league_production
-- Clear the market salary on season rows that carry no points added.
--
-- NO DDL. One UPDATE against a nullable column.
--
-- THE LAST RESIDUE OF THE SENTINEL ERA on the season board. Under the old
-- encoding a player who was never in the drawn pool carried `-999`, and
-- calculate-prices multiplied that by the rate, floored the negative product at
-- zero and stored $0. So the row said "worth nothing" where it meant "not in the
-- pool" -- the same conflation the NULL spelling removed from the points-added
-- column, sitting one column over in the price derived from it.
--
-- The code already agrees: since league 28c83caa2, calculate-prices DELETES the
-- aggregate's salary key when it declines to price, so a fresh run writes NULL
-- here. The rest-of-season board converged on its own within one cron cycle of
-- that deploy, from 1,680 stale rows to zero.
--
-- THE SEASON BOARD CANNOT CONVERGE THAT WAY, which is why this file exists
-- rather than a note saying "wait for the writer". The season row SEALS at the
-- start of week 1 -- `current_season.is_offseason || year !== current_season.year`
-- -- so nothing rewrites the live year again until the next offseason. Waiting
-- would leave the conflation in place for a season, and the seal is correct and
-- should not be weakened to fix a data artifact.
--
-- Measured 2026-09-03, and the population is closed on every axis:
--   * 1,020 rows, ALL in 2026. Every historical year is already NULL/NULL,
--     because the backfill ran under the new code.
--   * Every one holds market_salary_positive = 0.00 EXACTLY.
--   * ZERO rows anywhere carry a non-zero salary against a NULL points added.
--     That last count is the one that makes this safe: had it come back nonzero,
--     something other than the sentinel path would be writing this column and
--     this file would be destroying real prices.
--
-- Scoped by `projected_points_added_positive IS NULL` rather than by year or by
-- the value 0, so it cannot touch a row that has a points-added value, whatever
-- its price.

SET lock_timeout = '30s';
SET statement_timeout = 0;

UPDATE public.league_format_player_season_projection_values
SET market_salary_positive = NULL,
    market_salary_net = NULL
WHERE projected_points_added_positive IS NULL
  AND projected_points_added_net IS NULL
  AND (market_salary_positive IS NOT NULL OR market_salary_net IS NOT NULL);
