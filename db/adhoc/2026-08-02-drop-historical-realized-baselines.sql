-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Drop the stored per-position replacement levels. The board is its own
-- baseline now.
--
-- DO NOT APPLY BEFORE THE CODE DEPLOY. This file is ordered second on purpose.
-- The deployed calculate-values.mjs prefers these columns and only falls
-- through to the correct baselines[pos].starter branch when they are absent --
-- so dropping them makes the corrected baseline reachable IMMEDIATELY, under
-- whatever code the hosts are running. Doing that while the hosts still run the
-- old calculate-prices.mjs gives the corrected baseline WITHOUT the fitted price
-- scale, which shrinks total positive pts_added from 5,257 to 2,422, doubles the
-- $/point rate, and moves the top RB from $59 to $100 against a league whose
-- actual ceiling is $60. That is precisely the failure that broke the previous
-- attempt at this fix.
--
-- Correct order: apply the additive file, fit and populate the calibration,
-- deploy the code, THEN apply this.
--
--
-- What these columns were. scripts/calculate-baseline-historical-realized.mjs
-- ran calculateBaselines over REALIZED scoring_format_player_seasonlogs totals
-- for the last two completed seasons and wrote the worst starter's per-game
-- figure to both pts_base_week_* and pts_base_season_*. The measurement was
-- correct; the use was not. A realized 10th-best season is a selection maximum
-- over a noisy distribution, while a projection is regressed toward the mean, so
-- subtracting the first from the second biased every projected pts_added
-- downward at every position -- far enough at DST that all 32 defenses carried
-- negative pts_added and priced at $0.00.
--
-- It also mis-split the starter count: against the 2026 board these baselines
-- were cleared by 29 QB, 31 RB, 24 WR, 8 TE and 0 DST -- 92 players for 90
-- starting slots, so the total was about right while the split transferred cap
-- from TE and DST to QB and RB. Deriving the baseline from the projected board
-- instead lands it exactly: 20 / 27 / 23 / 10 / 10.
--
-- The column comments were also wrong: both the week and the season column held
-- a PER-GAME figure, and calculate-values.mjs multiplied the season one back up
-- by nflFinalWeek - 1.
--
-- Not in league_formats_config_unique, so no format is re-keyed.
--
-- scripts/calculate-baseline-historical-realized.mjs is deleted in the same
-- commit; nothing else reads or writes these columns.

BEGIN;

ALTER TABLE public.league_formats
    DROP COLUMN pts_base_week_qb,
    DROP COLUMN pts_base_week_rb,
    DROP COLUMN pts_base_week_wr,
    DROP COLUMN pts_base_week_te,
    DROP COLUMN pts_base_week_k,
    DROP COLUMN pts_base_week_dst,
    DROP COLUMN pts_base_season_qb,
    DROP COLUMN pts_base_season_rb,
    DROP COLUMN pts_base_season_wr,
    DROP COLUMN pts_base_season_te,
    DROP COLUMN pts_base_season_k,
    DROP COLUMN pts_base_season_dst;

COMMIT;
