-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Separate the two questions the value pipeline was answering with one number,
-- and give the projection board a calibration it never had.
--
-- Additive only. Nothing here changes behaviour on its own: the deployed code
-- ignores both objects until the accompanying change ships. The matching
-- CONTRACT half -- dropping league_formats.pts_base_week_* / pts_base_season_*
-- -- is deliberately a SEPARATE file applied AFTER that deploy, because
-- dropping those columns is what makes the corrected baseline reachable, and
-- reaching it without the fitted price scale moves the top RB from $59 to $100
-- against a league whose observed ceiling is $60. That ordering is the whole
-- point; see db/adhoc/2026-08-02-drop-historical-realized-baselines.sql.
--
--
-- 1. scoring_format_projection_calibration
--
-- Projections are regressed toward the mean; the value pipeline consumed them
-- as if they were expectations. Regressing realized outcome on projected value
-- for the same player, 2020-2025, gives slope 0.74 at QB against 0.86-0.87 for
-- RB/WR and 0.31 at DST -- so QB was over-spread and nothing corrected it.
--
-- `r` is stored, not just the coefficients, because it is the trust metric: at
-- DST it is 0.08, which is statistically close to a random ordering and four
-- times LESS informative than simply copying last season's box score (r = 0.30).
-- Below the trust floor the pipeline collapses the position's spread to zero
-- rather than publishing a confident-looking ranking it cannot support.
--
-- Keyed by period because the coefficients are not interchangeable: a season
-- intercept of +44 points applied to a weekly projection is nonsense.
--
--
-- 2. league_formats.surplus_cap_share
--
-- market_salary assumed the cap is exhausted in proportion to surplus
-- (rate = cap / total_pts_added), which makes every baseline improvement break
-- prices: raising the baseline shrinks the denominator and concentrates the
-- same fixed pool onto fewer players. Real auctions do not work that way,
-- because teams must still fill every roster spot -- a large share of the cap
-- goes to players at or below replacement, who have zero surplus by
-- construction.
--
-- 0.630 is FITTED, not tuned: least squares of observed contract value on
-- pts_added across the hosted leagues against the calibrated 2026 board
-- (scripts/fit-surplus-cap-share.mjs). It lands the top of the board at $64 /
-- $61 / $53 / $51 against observed top salaries of $60 / $55 / $55 / $50 / $50.
--
-- This column is safe on league_formats, which the playoff-format work
-- correctly avoided: league_formats_config_unique is
-- (num_teams, sqb..min_bid, scoring_format_id, pricing_model), and this is a
-- DERIVED property of that tuple rather than a new identity axis -- the same
-- shape as the existing format_category column. No format is re-keyed.

BEGIN;

CREATE TABLE public.scoring_format_projection_calibration (
    scoring_format_id text NOT NULL,
    period text NOT NULL,
    "position" text NOT NULL,
    n integer NOT NULL,
    slope numeric(6,4) NOT NULL,
    intercept numeric(8,3) NOT NULL,
    r numeric(5,4) NOT NULL,
    mean_projected numeric(8,3) NOT NULL,
    mean_realized numeric(8,3) NOT NULL,
    fit_years integer NOT NULL,
    fitted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scoring_format_projection_calibration_period_check
        CHECK ((period = ANY (ARRAY['season'::text, 'week'::text])))
);

ALTER TABLE ONLY public.scoring_format_projection_calibration
    ADD CONSTRAINT scoring_format_projection_calibration_pkey
    PRIMARY KEY (scoring_format_id, period, "position");

ALTER TABLE ONLY public.scoring_format_projection_calibration
    ADD CONSTRAINT scoring_format_projection_calibration_scoring_format_id_fkey
    FOREIGN KEY (scoring_format_id)
    REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;

COMMENT ON TABLE public.scoring_format_projection_calibration IS
    'Fitted realized ~ intercept + slope x projected, per scoring format, period and position. r is published as a trust metric: below the floor in libs-shared/calibrate-projected-points.mjs the position produces no spread at all.';

COMMENT ON COLUMN public.scoring_format_projection_calibration.r IS
    'Correlation within the fitted (rosterable-depth) population, so it is range-restricted by construction and lower than a whole-board r. That is the intended reading: it answers whether the projection can order the players anyone would actually roster.';

ALTER TABLE public.league_formats
    ADD COLUMN surplus_cap_share numeric(4,3) DEFAULT 0.630 NOT NULL;

COMMENT ON COLUMN public.league_formats.surplus_cap_share IS
    'Fraction of the league salary cap that reaches above-replacement players, fitted against observed salaries by scripts/fit-surplus-cap-share.mjs. The remainder is what auctions spend filling roster spots at or below replacement. Separates the price scale from the baseline so correcting one cannot break the other.';

COMMIT;
