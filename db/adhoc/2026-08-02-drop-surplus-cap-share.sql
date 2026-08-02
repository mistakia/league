-- STATUS: APPLIED 2026-08-02 against league_production
--
-- The contract half of the distributional valuation rebuild: drop the fitted
-- surplus_cap_share, and the week-0 `available` baseline rows the season board
-- no longer produces.
--
-- APPLY THIS AFTER THE DEPLOY, NOT BEFORE. Both statements remove something
-- deployed code still writes or reads, so applying either ahead of the deploy
-- breaks production rather than tidying it. The additive half shipped as
-- db/adhoc/2026-08-02-distributional-valuation-columns.sql, which names this
-- file.
--
--
-- 1. league_formats.surplus_cap_share
--
-- A multiplier on the dollar rate that turns points added into market_salary,
-- fitted by least squares of observed contract value on pts_added and standing
-- at 0.63. It is deleted rather than retuned, for two reasons.
--
-- It was fitted against observed prices, which is the one thing a valuation must
-- never do -- a board that agrees with the market by construction can never tell
-- you the market is wrong. The price sample it was fitted to made that worse:
-- auction leftovers, 44-73 players a year against a 600-player board,
-- systematically the cheap residue after keepers.
--
-- And it was not measuring what it claimed. Measured against realized outcomes,
-- the share of paid salary reaching above-replacement players is 0.961 (range
-- 0.925-0.982 over 2020-2025), not 0.63. The gap was a broken denominator
-- elsewhere: the calibrated board put only ~0.61 of a realized season's total
-- points added on the board, so the $/point rate came out high and a sub-1 share
-- pulled it back down. Drawing the season board from projection dispersion puts
-- the denominator back on a realized season's scale, which is what makes
-- spending the whole discretionary cap the right arithmetic.
--
-- The situational question this column was sometimes read as answering -- what a
-- player will actually cost given what is left in this league right now -- is
-- answered separately and without a fitted parameter by market_salary_adj.
--
-- No committed code has named this column since the rewire; see
-- libs-shared/calculate-prices.mjs.
--
--
-- 2. Week-0 `available` baselines
--
-- `available` is the best player nobody has rostered -- a roster-aware question
-- answered as a by-product of the weekly slot fill. The season board has no such
-- fill: its replacement level is an expectation over drawn seasons of the league
-- in a vacuum. A season `available` therefore required a second, roster-aware
-- pass answering a different question under the same week key, and nothing read
-- the result: every consumer iterates fantasy_weeks, which starts at 1.
--
-- The season pass no longer computes it. league_baselines is upserted and never
-- deleted, so the rows the old pass wrote would otherwise sit there forever,
-- stale from the moment of the deploy. This removes them.
--
--
-- 3. scoring_format_player_projection_points.points_sd
--
-- Added earlier the same day to carry each player's estimated realized
-- dispersion, derived from the spread between the individual projection sources
-- and rescaled by a measured population ratio.
--
-- The column is dropped because the quantity it stored turned out not to be the
-- quantity the model needs. Cross-vendor spread carries almost no
-- cross-sectional signal about how far a season lands from its projection:
-- splitting 2020-2025 by projection level first and then by vendor spread, a
-- 6.8x change in spread moves realized residual dispersion by 1.22x at QB and
-- less everywhere else. Dispersion is now derived from the projection itself,
-- inside libs-shared/calculate-projection-dispersion.mjs.
--
-- It is also the more correct shape. Dispersion is a function of the board, so a
-- board recomputed under different source weights -- which is what the SPA's
-- client-side worker does -- has to carry the dispersion belonging to THAT
-- board, not the one the cron persisted. A stored column cannot do that.
--
-- Nothing ever read it in production: the column was applied on 2026-08-02 and
-- the code that populates it never deployed, so every row is NULL.

ALTER TABLE public.league_formats
  DROP COLUMN surplus_cap_share;

ALTER TABLE public.scoring_format_player_projection_points
  DROP COLUMN points_sd;

-- week is character varying on this table, not an integer.
DELETE FROM public.league_baselines
  WHERE week = '0' AND type = 'available';
