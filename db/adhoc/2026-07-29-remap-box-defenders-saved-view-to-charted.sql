-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Remap one saved view's box_defenders filter param to box_defenders_charted.
--
-- WHY THIS CANNOT BE A READ-TIME MIGRATION RULE. Commit 8a4b6e4a (2025-07-24,
-- "standardize variable naming") RECYCLED a param name in a single commit:
--
--     box_ngs        -> box_defenders          (NGS tracking source)
--     box_defenders  -> box_defenders_charted  (the pre-existing charted source)
--
-- So the string `box_defenders` meant CHARTED before that commit and means NGS
-- after it. A view saved either side of 2025-07-24 needs the opposite treatment,
-- and libs-shared/data-views-saved-view-migration.mjs runs on table_state alone
-- with no access to the row's updated_at -- so it cannot decide. That is why the
-- key is deliberately absent from PLAY_FILTER_PARAM_RENAMES there and handled
-- here instead, once, against a named view_id.
--
-- This is also invisible to db/adhoc/check-saved-view-param-coverage.mjs: that
-- oracle finds keys NOTHING reads, and `box_defenders` is a perfectly valid
-- current key. It reads the WRONG THING rather than nothing. Both params are
-- RANGE 0-11 with identical preset values, so the persisted value gives no clue
-- either, and the view returns entirely plausible numbers today.
--
-- THE VIEW. c2e89abe-a2a3-4f42-b4de-ed736118aff9, "Box Defender Rush Attempts".
-- created_at = updated_at = 2025-01-15, six months BEFORE the rename and never
-- re-saved since, so its `box_defenders` could only have meant charted: on that
-- date the NGS param was still called box_ngs. Ten team_rush_attempts_from_plays
-- columns, each pinned to an exact box count 2..11 -- a distribution breakdown of
-- rush attempts by defenders in the box.
--
-- WHY THE REMAP IS SAFE HERE AND WOULD NOT HAVE BEEN ELSEWHERE. Charted coverage
-- in nfl_plays exists only for 2023 and 2024 (2022 and 2025 are entirely NULL,
-- while NGS box_defenders is populated across all four). This view scopes to
-- 2024 REG, so restoring the author's intent returns data. Had it scoped to 2022
-- or 2025 the honest call would have been to leave it alone -- an empty view is
-- worse than plausible-but-wrong numbers.
--
-- Scoped to the single view_id rather than to a text pattern: any view saved
-- AFTER 2025-07-24 carrying `box_defenders` means NGS and must not be touched.
--
-- Idempotent: re-running finds no `"box_defenders":` key to replace (the
-- replacement string does not contain the old key as a substring), so the
-- WHERE clause matches nothing on a second pass.
--
-- Rollback: db/adhoc/2026-07-29-remap-box-defenders-saved-view-to-charted-rollback.sql
--
-- yarn db:exec db/adhoc/2026-07-29-remap-box-defenders-saved-view-to-charted.sql

BEGIN;

UPDATE public.user_data_views
SET table_state = replace(
      table_state::text,
      '"box_defenders":',
      '"box_defenders_charted":'
    )::json
WHERE view_id = 'c2e89abe-a2a3-4f42-b4de-ed736118aff9'
  AND table_state::text LIKE '%"box_defenders":%';

-- Assert the remap landed and left no old key behind.
DO $$
DECLARE
  remaining int;
  migrated int;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.user_data_views
  WHERE view_id = 'c2e89abe-a2a3-4f42-b4de-ed736118aff9'
    AND table_state::text LIKE '%"box_defenders":%';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'box_defenders key still present after remap';
  END IF;

  SELECT count(*) INTO migrated
  FROM public.user_data_views
  WHERE view_id = 'c2e89abe-a2a3-4f42-b4de-ed736118aff9'
    AND table_state::text LIKE '%"box_defenders_charted":%';
  IF migrated <> 1 THEN
    RAISE EXCEPTION 'expected the view to carry box_defenders_charted after remap';
  END IF;
END $$;

COMMIT;
