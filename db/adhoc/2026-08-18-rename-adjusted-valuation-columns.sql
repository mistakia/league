-- Retire the `adj` token from the valuation columns and drop three columns
-- whose names or contents do not survive review.
--
-- Task: user:task/league/rename-adjusted-valuation-columns.md
-- Standard: user:guideline/nfl/league/points-added-valuation.md
--   § "An adjusted quantity names the pool it prices against"
--
-- `adj` spelled two different concepts, and neither name said what the number
-- was adjusted AGAINST. The approved principle is to name the POOL each number
-- prices against, not the mechanism:
--
--   market_salary_adj prices against money teams can STILL BID -- each team's
--   availableCap - min_bid * availableSpace, positive teams only, spread over
--   the points added of unrostered players. A live free-agent clearing price.
--   It becomes projected_positive_salary_at_available_cap, a minimal pair with
--   market_salary -> projected_positive_salary_at_full_cap, which is owned by
--   conform-points-added-vocabulary.
--
--   salary_adj_pts_added is a player's points PLUS the points his cap savings
--   could buy elsewhere -- a roster-spot quantity, not a player quantity. It
--   becomes projected_points_added_positive_including_cap_savings. `positive`
--   is not decoration: calculate-prices.mjs:131 floors the value at zero for
--   every aggregate key, net included.
--
-- These three columns carry BOTH the adj and the pts token. The 2026-08-18
-- pts conform held them out deliberately so they take one hop to their final
-- spelling rather than two, which also keeps an intermediate spelling off the
-- wire.
--
-- SEQUENCING. This is a serialized WIDE window of its own. The plan originally
-- had these renames riding the projection-rest-of-season-redesign cutover,
-- which owns DDL on these same tables. That cutover is dormant -- no live
-- thread, no DDL landed -- so there was no window to ride, and waiting on it
-- is what a second window would have been avoiding.
--
-- THE DROPS, each verified against production rather than assumed:
--
--   league_player_projection_values.market_salary_adj is DDL-present, never
--   written and never read: 33102 rows, 0 non-null. Its removal was already a
--   structural prerequisite of the dormant cutover's Step 2, which needs
--   `week` to narrow to smallint. Dropped here instead, so Step 2 must not
--   drop it twice.
--
--   salary_adj_points_added_net on both period tables asserts the NET variant
--   while carrying a value floored at zero by calculate-prices.mjs:131 -- the
--   name is false about its own contents, so it is dropped rather than
--   conformed. Written by process-projections.mjs, read by nothing.
--
--   Narrowing the season/rest-of-season row guards onto the surviving column
--   drops any row that had a net value but no positive one. That shape does
--   not occur: 1135 rows on each table, 0 with net non-null and positive null.
--
-- pg_proc, pg_views and pg_indexes were all checked against production for
-- these three tokens and are clean -- no function body, view definition,
-- index, trigger or generated column references them.
--
-- db-exec.sh supplies the transaction. No BEGIN/COMMIT here.
--
-- STATUS: APPLIED 2026-08-18 against league_production

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- league_player_projection_values (1 rename, 1 drop)
ALTER TABLE league_player_projection_values RENAME COLUMN salary_adj_pts_added TO projected_points_added_positive_including_cap_savings;
ALTER TABLE league_player_projection_values DROP COLUMN market_salary_adj;

-- league_player_rest_of_season_projection_values (1 rename, 1 drop)
ALTER TABLE league_player_rest_of_season_projection_values RENAME COLUMN salary_adj_pts_added TO projected_points_added_positive_including_cap_savings;
ALTER TABLE league_player_rest_of_season_projection_values DROP COLUMN salary_adj_points_added_net;

-- league_player_season_projection_values (2 renames, 1 drop)
ALTER TABLE league_player_season_projection_values RENAME COLUMN salary_adj_pts_added TO projected_points_added_positive_including_cap_savings;
ALTER TABLE league_player_season_projection_values RENAME COLUMN market_salary_adj TO projected_positive_salary_at_available_cap;
ALTER TABLE league_player_season_projection_values DROP COLUMN salary_adj_points_added_net;
