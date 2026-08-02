-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Schema for the distributional rebuild of the points added valuation, plus the
-- drop of the fitted calibration table 6c2c9ab63 orphaned.
--
-- The two ALTERs are ADDITIVE, so the schema stays a superset of what committed
-- code names and nothing breaks between this apply and the consumer sweep. The
-- DROP removes a table no code has referenced since 6c2c9ab63.
--
-- The CONTRACT half -- dropping league_formats.surplus_cap_share -- is
-- deliberately NOT here. Deployed code still reads that column, so it can only
-- be dropped after the sweep that stops reading it has shipped to production.
-- See db/adhoc/2026-08-02-drop-surplus-cap-share.sql.
--
--
-- 1. scoring_format_player_projection_points.points_sd
--
-- The valuation no longer treats a projection as a point estimate. A roster spot
-- pays max(X - baseline, 0), which is convex, so the value of a player is
-- E[max(X - baseline, 0)] and not max(E[X] - baseline, 0); evaluating the second
-- understates every player and understates most where uncertainty is largest.
-- Computing the first needs a dispersion per player, which nothing persisted.
--
-- This column is that dispersion: the ESTIMATED STANDARD DEVIATION OF THE
-- PLAYER'S REALIZED POINTS for the row's (scoring format, year, week). It is
-- derived from the sample standard deviation of the individual sources'
-- projections, scored at this row's scoring format, then rescaled by the
-- measured per-position ratio of realized residual dispersion to cross-vendor
-- dispersion (QB 4.42, RB 4.25, WR 4.41, TE 4.55, DST 4.25) -- sources cluster,
-- so the spread between them is much narrower than the spread between any of
-- them and the season that happens. See
-- libs-shared/calculate-projection-dispersion.mjs for where that ratio was
-- measured and what would falsify it.
--
-- It sits on this table rather than a new one because it has exactly the grain
-- of `total` -- one value per (pid, week, year, scoring format) -- and is derived
-- in the same pass, by the same script, from the same projections_index rows.
--
-- Nullable: a player under two sources at a week has no measurable spread. The
-- consumer substitutes the position median rather than reading a null as
-- certainty, which would make an obscure player a risk-free asset.
--
-- numeric(5,2) matches `total` on the same table, which bounds it: a dispersion
-- cannot exceed the scale of the quantity it disperses.
--
--
-- 2. league_baselines.points
--
-- The replacement level for a position was stored as a `pid` and every consumer
-- resolved it back to a player to read that player's points. That worked while
-- the baseline WAS a player -- the worst starter on the point-estimate board.
--
-- The season baseline is now an expectation over drawn seasons: the average,
-- across draws, of the worst starter's points at the position. No real player
-- holds that number, so there is no pid to store and the resolution step has
-- nothing to resolve. Store the number.
--
-- `pid` stays and is NOT dropped. It remains meaningful for the 'available'
-- baseline, which is still a specific player -- the best free agent -- and is a
-- genuinely different question from replacement level. After this change the
-- two baseline types differ in shape: 'starter' carries points with a null pid,
-- 'available' carries both.
--
-- numeric(6,2) rather than (5,2): the column is an average of season point
-- totals and the extra integer digit is free headroom against a format scoring
-- more aggressively than any in the catalog today.
--
--
-- 3. DROP scoring_format_projection_calibration
--
-- Fitted realized ~ intercept + slope x projected, per scoring format, period
-- and position. Applied to the board before values were computed.
--
-- A six-season backtest showed the calibration made the positional split WORSE
-- rather than better -- it widened every structural gap it was meant to close
-- (QB -8.3 raw to -10.7 calibrated; RB +8.2 to +11.0). The applier, both
-- fitters, the reader and the spec were removed in 6c2c9ab63, which left this
-- table with no reader and no writer.
--
-- This also closes bulletin #114: the table's DDL was applied to production but
-- never reached the committed schema export, so master's schema and production's
-- have disagreed about it since it was created. Dropping it and exporting in one
-- commit reconciles that without a separate repair.

BEGIN;

ALTER TABLE public.scoring_format_player_projection_points
    ADD COLUMN points_sd numeric(5,2);

COMMENT ON COLUMN public.scoring_format_player_projection_points.points_sd IS
    'Estimated standard deviation of the player''s realized points for this scoring format, year and week. Derived from the sample standard deviation of the individual sources'' scored projections, rescaled by the measured per-position ratio of realized residual dispersion to cross-vendor dispersion (~4.2-4.6). Consumed by libs-shared/calculate-distributional-baselines.mjs, which draws seasons from it. Null when the week carried fewer than two sources for the player; the consumer substitutes the position median rather than reading null as certainty.';

ALTER TABLE public.league_baselines
    ADD COLUMN points numeric(6,2);

COMMENT ON COLUMN public.league_baselines.points IS
    'Replacement-level fantasy points for this league, week, position and baseline type. For type=''starter'' this is an expectation over drawn seasons that no real player holds, so pid is null and this column is the only representation. For type=''available'' it is the projected points of the specific best-available player named by pid.';

DROP TABLE public.scoring_format_projection_calibration;

COMMIT;
