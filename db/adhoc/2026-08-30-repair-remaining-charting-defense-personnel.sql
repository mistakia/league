-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Finish the defense_personnel repair: 202 rows the companion file missed.
--
-- 2026-08-30-repair-charting-contaminated-play-columns.sql scoped
-- defense_personnel to IN ('Other','Base','Nickel','Dime'), on a measurement
-- that reported 0-3DB and 7+DB as having zero rows. They have 201 and 1, both
-- in 2025, and both still carry a derived defense_personnel_defensive_back_count
-- (3 and 7) from the same contamination.
--
-- The reason the earlier measurement read zero is worth stating, because it is
-- the shape that will fool the next sweep too: the natural "anything that is not
-- long-form" filter is `defense_personnel !~ 'DL|LB|DB'`, and 0-3DB CONTAINS the
-- literal DB. The unanchored alternation matches inside the vendor's own token,
-- so the two values hide from precisely the query written to find them. The
-- anchored form `!~ '[0-9]+ +(DL|LB|DB)'` -- a count, whitespace, then the
-- position -- separates them, and finds exactly these two values and nothing
-- else.
--
-- The same defect ran one layer deeper in libs-server/parse-personnel.mjs, where
-- DEF_LONG_RE matched the trailing `3DB` of `0-3DB` and produced { db: 3 }
-- WITHOUT the package softmap being involved at all. Deleting the softmap would
-- have left that path intact. Fixed in the same change as this file by anchoring
-- the pattern against a preceding digit, hyphen or plus.
--
-- Sweeps run against the repaired table before writing this: offense_formation
-- now holds only the NFL feed's seven values, offense_personnel only long-form
-- strings, and nfl_plays_current_week zero rows of any of it. defense_personnel
-- is the last column with anything left.

SET lock_timeout = '30s';
SET statement_timeout = 0;

DO $$
DECLARE
  leftover int;
BEGIN
  SELECT count(*) INTO leftover
    FROM public.nfl_plays
   WHERE defense_personnel IN ('0-3DB','7+DB');

  IF leftover <> 202 THEN
    RAISE EXCEPTION 'expected 202 remaining rows, found %', leftover;
  END IF;
END $$;

UPDATE public.nfl_plays
   SET defense_personnel = NULL,
       defense_personnel_defensive_back_count = NULL
 WHERE defense_personnel IN ('0-3DB','7+DB');

-- Post-condition: no value in either personnel column fails the anchored
-- long-form test, and the empty-string population is still exactly where the
-- companion file left it.
DO $$
DECLARE
  odd_def int; odd_off int; empty_dp int; orphan_def int;
BEGIN
  SELECT
    count(*) FILTER (WHERE defense_personnel IS NOT NULL AND defense_personnel <> '' AND defense_personnel !~ '[0-9]+ +(DL|LB|DB)'),
    count(*) FILTER (WHERE offense_personnel IS NOT NULL AND offense_personnel <> '' AND offense_personnel !~ '[0-9]+ +(QB|RB|TE|WR|OL)'),
    count(*) FILTER (WHERE defense_personnel = ''),
    count(*) FILTER (WHERE defense_personnel IS NULL AND (
      defense_personnel_defensive_line_count IS NOT NULL OR
      defense_personnel_linebacker_count IS NOT NULL OR
      defense_personnel_defensive_back_count IS NOT NULL))
  INTO odd_def, odd_off, empty_dp, orphan_def
  FROM public.nfl_plays;

  IF odd_def <> 0 OR odd_off <> 0 THEN
    RAISE EXCEPTION 'non-long-form personnel survives: defense %, offense %', odd_def, odd_off;
  END IF;

  IF empty_dp <> 1638 THEN
    RAISE EXCEPTION 'over-reach: empty-string defense_personnel moved to % from 1638', empty_dp;
  END IF;

  IF orphan_def <> 0 THEN
    RAISE EXCEPTION 'orphaned derived defensive counts: %', orphan_def;
  END IF;
END $$;
