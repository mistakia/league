-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Conform the calibration table's column names. This turned master RED on the
-- schema conformance ratchet in 685c565c2 -- four violations, all mine, all new
-- debt rather than an audit widening, so the fix is the rename and NOT
-- --rebaseline.
--
--   n        -> sample_size       (bare name of five characters or fewer)
--   r        -> correlation       (same)
--   slope    -> fit_slope         (same; the underscore is what conforms it,
--                                  and it now matches fit_years beside it)
--   position -> fantasy_position  (reserved word)
--
-- Safe to rename in place rather than rebuild: the table was created hours ago
-- by 2026-08-02-projection-calibration-and-surplus-cap-share.sql, nothing reads
-- it except get-projection-calibration.mjs and fit-projection-calibration.mjs,
-- and both move to the new names in the same commit as this apply. The primary
-- key is renamed with the column by Postgres, so no index work is needed.
--
-- The 780 fitted rows are preserved; a rename does not touch data.

BEGIN;

ALTER TABLE public.scoring_format_projection_calibration
    RENAME COLUMN n TO sample_size;

ALTER TABLE public.scoring_format_projection_calibration
    RENAME COLUMN r TO correlation;

ALTER TABLE public.scoring_format_projection_calibration
    RENAME COLUMN slope TO fit_slope;

ALTER TABLE public.scoring_format_projection_calibration
    RENAME COLUMN "position" TO fantasy_position;

COMMENT ON COLUMN public.scoring_format_projection_calibration.correlation IS
    'Correlation within the fitted (rosterable-depth) population, so it is range-restricted by construction and lower than a whole-board figure. That is the intended reading: it answers whether the projection can order the players anyone would actually roster. Below the floor in libs-shared/calibrate-projected-points.mjs the position produces no spread at all.';

COMMIT;
