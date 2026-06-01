-- nfl_coaches own-id migration -- post-Phase-2 fix-up.
--
-- Task: user:task/league/migrate-nfl-coaches-to-own-id.md
--
-- The Phase 1 adhoc (2026-05-31-nfl-coaches-own-id-additive.sql) dropped
-- Scott Pioli (PiolSc0) per a mis-categorized null-DOB disposition: the
-- coverage check used `awk -F, '$3==id'` against samhoppen's YCH and
-- returned 0 matches for PiolSc0, leading to the "unreferenced AND not in
-- YCH -> drop" branch. The check missed that samhoppen records executive
-- entries with a leading `/executives/` path component (Pioli is
-- "/executives/PiolSc0" in YCH), and the importer strips that prefix
-- before lookup -- so Pioli IS in YCH and must resolve.
--
-- This adhoc restores Pioli with sentinel DOB (matching the convention
-- for the 5 other null-DOB rows kept in Phase 1) so the importer's strict
-- `missing_pfr_to_coach_id` guard no longer fires.

BEGIN;

INSERT INTO nfl_coaches (pfr_coach_id, full_name, dob, coach_id, updated_at)
VALUES
  ('PiolSc0', 'Scott Pioli', '1900-01-01', 'PIOL-SCOT-0000-00-00', now())
ON CONFLICT (coach_id) DO NOTHING;

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n FROM nfl_coaches WHERE pfr_coach_id = 'PiolSc0';
  IF n <> 1 THEN
    RAISE EXCEPTION 'post-condition FAILED: expected 1 PiolSc0 row, got %', n;
  END IF;
  RAISE NOTICE 'post-condition OK: PiolSc0 restored with sentinel';
END $$;

COMMIT;
