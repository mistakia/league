-- Give the NET points-added variant a home on the hosted-league period tables
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- `calculatePlayerValuesRestOfSeason` and `calculate-distributional-baselines`
-- both compute a signed NET aggregate beside the positive-only one, and as of
-- dd48ce077 `calculatePrices` prices both -- so `player_row.salary_adj_pts_added`
-- now carries a 'ros_net' and a 'season_net' key alongside 'ros' and '0'.
--
-- Those two keys had nowhere to land. `scripts/process-projections.mjs` routes
-- that map by key: '0' to league_player_season_projection_values, 'ros' to
-- league_player_rest_of_season_projection_values, numeric weeks to
-- league_player_projection_values. The net keys were skipped by a guard, because
-- falling through to the weekly insert would put 'ros_net' into a varchar(3)
-- `week` column -- and that table is written delete-by-lid THEN batch_insert, so
-- the delete commits, the insert throws, and the table is left EMPTY rather than
-- stale, blanking market_salary_adj on league-home, the auction nomination panel
-- and the selected-player panel for a full cron cycle.
--
-- These two columns are that home. The guard is replaced by an explicit route in
-- the same change, so the net keys still never reach the weekly insert -- the
-- protection is structural rather than a skip.
--
-- NAMING. New columns state their variant explicitly, per the 2026-08-04
-- domain rule: a points-added column never implies `positive` by absence, and
-- `earned` is retired as a variant token. The existing `salary_adj_pts_added`
-- violates that rule on both counts -- it implies positive by absence and it
-- spells `pts_added` -- but it is SHIPPED, and its rename to
-- `salary_adj_points_added_positive` rides the cutover owned by
-- user:task/league/projection-rest-of-season-redesign.md, together with the
-- format-side period split and the week narrowing. Until that lands these two
-- tables carry a deliberately mixed vocabulary.

-- numeric(5,2) matches the positive-variant sibling. calculatePrices floors
-- salary_adj_pts_added at zero for EVERY aggregate key, net included, so this
-- column is non-negative despite naming a signed aggregate -- the net variant's
-- signed range survives in pts_added and market_salary, not here.

ALTER TABLE public.league_player_season_projection_values
  ADD COLUMN salary_adj_points_added_net numeric(5,2);

ALTER TABLE public.league_player_rest_of_season_projection_values
  ADD COLUMN salary_adj_points_added_net numeric(5,2);
