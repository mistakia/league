-- STATUS: APPLIED 2026-08-30 against league_production
--
-- Repair the three nfl_plays columns the charting importer contaminated.
--
-- scripts/import-plays-charting.mjs called update_play with no protected_fields,
-- and update_play is fill-only, so the vendor filled wherever the NFL feed left
-- NULL. Three columns ended up holding a second, incompatible vocabulary. The
-- mapping was deleted in 224a915e3, so nothing is still writing these values --
-- but update_play's fill-only gate is also why a corrective RE-IMPORT cannot
-- clean them. Only an explicit UPDATE can.
--
-- Measured against league_production 2026-08-30:
--
--   offense_formation   462 rows of directional NxN receiver splits
--   offense_personnel   3,507 rows of two-digit codes (11, 01*)
--   defense_personnel   2,004 rows of package names (Other 1,544, Base 388,
--                       Nickel 62, Dime 10)
--
-- All 6,000-odd rows are in season 2025 and nowhere else.
--
-- Four things this file gets right that a shorter version would not:
--
-- 1. It matches on the VALUE, never on epa_charting. 24 of the 462 NxN rows
--    carry no charting marker at all, 13 of them in five 2025 week-1 games the
--    vendor never charted, so a charting-marker filter would silently leave
--    them behind.
--
-- 2. The formation values MOVE rather than being destroyed.
--    receiver_alignment_charting was created minutes ago and is NULL on every
--    row, so there is nothing to collide with. The 24 rows in never-charted
--    games are the reason this matters: no future re-import will recover them.
--
-- 3. It nulls the DERIVED count columns in the same statement.
--    libs-server/parse-personnel.mjs parses both vendor vocabularies, so all
--    3,507 short-code rows carry offense_personnel_*_count values derived from
--    the contamination, as do the 460 softmap-able defense rows. Control: zero
--    rows anywhere in nfl_plays have a personnel count without a personnel
--    string, and every writer of those counts goes through
--    add_personnel_counts_to_play_data -- so the counts on these rows have no
--    other possible origin and nothing recoverable is lost.
--
-- 4. Scope is nfl_plays only. nfl_plays_current_week holds zero rows matching
--    any of the three predicates.
--
-- The 1,638 empty-string defense_personnel rows are a separate, pre-existing
-- issue, 1,628 of them before 2025. No predicate here touches them, and the
-- post-conditions below assert that.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- Pre-condition: the measured populations are still what this file was written
-- against. A drift here means the scope was re-measured stale and the repair
-- should be re-derived rather than run.
DO $$
DECLARE
  fmt int; off_pers int; def_pers int; empty_dp int;
BEGIN
  SELECT
    count(*) FILTER (WHERE offense_formation ~ '^(MISC|[0-9]\+?)x(MISC|[0-9]\+?)$'),
    count(*) FILTER (WHERE offense_personnel ~ '^[0-9]{2}\*?$'),
    count(*) FILTER (WHERE defense_personnel IN ('Other','Base','Nickel','Dime')),
    count(*) FILTER (WHERE defense_personnel = '')
  INTO fmt, off_pers, def_pers, empty_dp
  FROM public.nfl_plays;

  IF fmt <> 462 OR off_pers <> 3507 OR def_pers <> 2004 OR empty_dp <> 1638 THEN
    RAISE EXCEPTION
      'population drift: formation %, offense_personnel %, defense_personnel %, empty defense_personnel % (expected 462 / 3507 / 2004 / 1638)',
      fmt, off_pers, def_pers, empty_dp;
  END IF;
END $$;

-- 1. Move the vendor's receiver splits to their own column.
UPDATE public.nfl_plays
   SET receiver_alignment_charting = offense_formation,
       offense_formation = NULL
 WHERE offense_formation ~ '^(MISC|[0-9]\+?)x(MISC|[0-9]\+?)$';

-- 2. Drop the vendor's two-digit offensive personnel codes and the counts
--    derived from them. The codes have no destination column -- the NFL feed's
--    long-form string is the fact we keep.
UPDATE public.nfl_plays
   SET offense_personnel = NULL,
       offense_personnel_quarterback_count = NULL,
       offense_personnel_running_back_count = NULL,
       offense_personnel_tight_end_count = NULL,
       offense_personnel_wide_receiver_count = NULL,
       offense_personnel_offensive_line_count = NULL
 WHERE offense_personnel ~ '^[0-9]{2}\*?$';

-- 3. Drop the vendor's defensive package names. Only Base / Nickel / Dime are
--    in the parser's softmap, so only those 460 rows carry a derived back
--    count; the 1,544 Other rows carry none. Nulling the count is scoped to the
--    three rather than blanketed, so the statement says what it knows.
UPDATE public.nfl_plays
   SET defense_personnel = NULL,
       defense_personnel_defensive_back_count = NULL
 WHERE defense_personnel IN ('Base','Nickel','Dime');

UPDATE public.nfl_plays
   SET defense_personnel = NULL
 WHERE defense_personnel = 'Other';

-- Post-conditions. Assert the PROPERTY, not the row identities: every predicate
-- is empty, the moved values all arrived, and the empty-string population that
-- proves the predicates did not over-reach is untouched.
DO $$
DECLARE
  fmt int; off_pers int; def_pers int; moved int; empty_dp int; orphan_off int; orphan_def int;
BEGIN
  SELECT
    count(*) FILTER (WHERE offense_formation ~ '^(MISC|[0-9]\+?)x(MISC|[0-9]\+?)$'),
    count(*) FILTER (WHERE offense_personnel ~ '^[0-9]{2}\*?$'),
    count(*) FILTER (WHERE defense_personnel IN ('Other','Base','Nickel','Dime')),
    count(*) FILTER (WHERE receiver_alignment_charting IS NOT NULL),
    count(*) FILTER (WHERE defense_personnel = ''),
    count(*) FILTER (WHERE offense_personnel IS NULL AND (
      offense_personnel_quarterback_count IS NOT NULL OR
      offense_personnel_running_back_count IS NOT NULL OR
      offense_personnel_tight_end_count IS NOT NULL OR
      offense_personnel_wide_receiver_count IS NOT NULL OR
      offense_personnel_offensive_line_count IS NOT NULL)),
    count(*) FILTER (WHERE defense_personnel IS NULL AND (
      defense_personnel_defensive_line_count IS NOT NULL OR
      defense_personnel_linebacker_count IS NOT NULL OR
      defense_personnel_defensive_back_count IS NOT NULL))
  INTO fmt, off_pers, def_pers, moved, empty_dp, orphan_off, orphan_def
  FROM public.nfl_plays;

  IF fmt <> 0 OR off_pers <> 0 OR def_pers <> 0 THEN
    RAISE EXCEPTION 'contamination survives: formation %, offense_personnel %, defense_personnel %', fmt, off_pers, def_pers;
  END IF;

  IF moved <> 462 THEN
    RAISE EXCEPTION 'receiver_alignment_charting holds % rows, expected 462', moved;
  END IF;

  IF empty_dp <> 1638 THEN
    RAISE EXCEPTION 'over-reach: empty-string defense_personnel moved to % from 1638', empty_dp;
  END IF;

  IF orphan_off <> 0 OR orphan_def <> 0 THEN
    RAISE EXCEPTION 'orphaned derived counts: offense %, defense %', orphan_off, orphan_def;
  END IF;
END $$;
