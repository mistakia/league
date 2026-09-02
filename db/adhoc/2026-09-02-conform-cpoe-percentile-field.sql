-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Conform the last stranded percentiles.field value: cpoe ->
-- completion_percentage_over_expected.
--
-- WHY THIS FILE IS SEPARATE FROM THE 2026-08-19 CONFORM. That file rewrote 53
-- stranded spellings and deliberately EXCLUDED this one, for a reason it states
-- in its own banner: cpoe's consumer, app/core/player-fields.js, pins the
-- literal 'cpoe' as its `percentile_field` while reading the renamed column
-- `completion_percentage_over_expected` for the value, behind a comment
-- documenting the divergence. So that file was data-only and appliable on its
-- own, while this one is data PLUS code -- migrating these rows without the
-- repoint BREAKS a read that works today, turning a populated opponent-CPOE
-- cell blank. The rows, the repoint and the frontend deploy are ONE unit and
-- hold the serialized production-DDL apply slot through deploy, per the
-- 2026-08-18 operator ruling.
--
-- Retiring that comment is the point of the unit rather than a side effect:
-- league CLAUDE.md cites it as the live precedent for the whole gate-invisible
-- class, where a varchar column holds a physical column name as DATA, no ALTER
-- reaches it, no schema diff shows it, and the consumer read that misses it
-- renders a BLANK CELL rather than raising.
--
-- WHY RENAME AND NOT DELETE. This is the opposite call from
-- db/adhoc/2026-09-02-delete-orphan-snp-percentile-rows.sql, and the two
-- criteria that separated them were re-measured against league_production on
-- 2026-09-02:
--   1. The target name is LIVE. `completion_percentage_over_expected` is a real
--      column on nfl_team_seasonlogs and player_passing_gamelogs (plus the
--      nfl_plays family), so the renamed value resolves. `snp` had no target
--      anywhere in db/adhoc, which is why deleting it was right.
--   2. The rows hold REAL measurements. All 20 are non-zero, spanning
--      minimum_value -1.27 to maximum_value 1.28. Every one of the 126 snp rows
--      was identically zero in all nine percentile columns and both bounds, so
--      there was no value there to preserve under any name.
-- The rename that moved the column moved a NAME and never a NUMBER, so these
-- nine percentile columns are still the correct values for the metric under its
-- new spelling. This is a value rewrite, not a recompute.
--
-- SCOPE. Exactly 20 rows, all under QB_* percentile keys -- twelve QB_AGAINST_*
-- (the namespace `opponent_field` reads via `${pos}_AGAINST_ADJ${suffix}`) and
-- eight plain QB_*. Measured 2026-09-02: 20 rows under 'cpoe', ZERO under
-- 'completion_percentage_over_expected'.
--
-- COLLISION. The primary key is (percentile_key, field). A rename onto a name
-- that already carried a row for the same key would violate it. Measured: zero
-- such pairs, which follows from there being no rows under the target name at
-- all. Asserted below anyway rather than trusted, so a row appearing between
-- authoring and apply aborts the file instead of raising a bare PK violation.

SET search_path = public;
SET lock_timeout = '30s';

-- PRE-CONDITION 1. The target name must be a live column somewhere in the
-- public schema. This is the half of the percentile-field-resolution oracle
-- that makes the rename legitimate -- renaming onto a name nothing resolves
-- would move the row from one unresolvable spelling to another and leave the
-- check red while looking like a repair.
DO $$
DECLARE target_columns int;
BEGIN
  SELECT count(*) INTO target_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'completion_percentage_over_expected';

  IF target_columns = 0 THEN
    RAISE EXCEPTION
      'completion_percentage_over_expected is not a live column in the public schema; the rename target does not resolve';
  END IF;
END $$;

-- PRE-CONDITION 2. No collision on the primary key.
DO $$
DECLARE colliding int;
BEGIN
  SELECT count(*) INTO colliding
  FROM public.percentiles p
  WHERE p.field = 'cpoe'
    AND EXISTS (
      SELECT 1 FROM public.percentiles q
      WHERE q.percentile_key = p.percentile_key
        AND q.field = 'completion_percentage_over_expected'
    );

  IF colliding > 0 THEN
    RAISE EXCEPTION
      '% cpoe row(s) collide with an existing completion_percentage_over_expected row on (percentile_key, field); resolve which write wins before rerunning',
      colliding;
  END IF;
END $$;

-- PRE-CONDITION 3. Refuse if any cpoe row is empty of measurement. All 20 were
-- non-zero when this file was authored. An all-zero row appearing since would
-- mean the rows are residue rather than stranded values, which makes DELETE the
-- right repair and this file the wrong one.
DO $$
DECLARE empty_rows int;
BEGIN
  SELECT count(*) INTO empty_rows
  FROM public.percentiles
  WHERE field = 'cpoe'
    AND percentile_25 = 0 AND percentile_50 = 0 AND percentile_75 = 0
    AND percentile_90 = 0 AND percentile_95 = 0 AND percentile_98 = 0
    AND percentile_99 = 0 AND minimum_value = 0 AND maximum_value = 0;

  IF empty_rows > 0 THEN
    RAISE EXCEPTION
      '% cpoe row(s) carry no measurement; these are residue and the repair is a delete, not a rename',
      empty_rows;
  END IF;
END $$;

-- The rewrite. Expected: 20 rows.
UPDATE public.percentiles
SET field = 'completion_percentage_over_expected'
WHERE field = 'cpoe';

-- POST-CONDITIONS.

-- 1. Exactly 20 rows under the new name and none under the old. Asserted as a
--    pair, because either half alone is satisfiable by a wrong outcome: a count
--    of 20 says nothing if the old rows were copied rather than moved, and a
--    zero residual says nothing if the rows were deleted.
DO $$
DECLARE new_rows int; old_rows int;
BEGIN
  SELECT count(*) INTO new_rows
  FROM public.percentiles WHERE field = 'completion_percentage_over_expected';
  SELECT count(*) INTO old_rows
  FROM public.percentiles WHERE field = 'cpoe';

  IF new_rows <> 20 OR old_rows <> 0 THEN
    RAISE EXCEPTION
      'expected 20 rows under completion_percentage_over_expected and 0 under cpoe, got % and %',
      new_rows, old_rows;
  END IF;
END $$;

-- 2. The values survived the move intact. The bounds are the cheapest property
--    that distinguishes a rewrite from a truncate-and-reinsert, and they are
--    the ones measured before the apply.
DO $$
DECLARE min_v numeric; max_v numeric;
BEGIN
  SELECT min(minimum_value), max(maximum_value) INTO min_v, max_v
  FROM public.percentiles WHERE field = 'completion_percentage_over_expected';

  IF round(min_v::numeric, 2) <> -1.27 OR round(max_v::numeric, 2) <> 1.28 THEN
    RAISE EXCEPTION
      'value bounds moved during the rename: expected [-1.27, 1.28], got [%, %]',
      round(min_v::numeric, 2), round(max_v::numeric, 2);
  END IF;
END $$;
