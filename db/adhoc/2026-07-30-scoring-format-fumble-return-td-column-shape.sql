-- STATUS: APPLIED 2026-07-30 against league_production
--
-- league_scoring_formats: conform fumble_return_touchdowns to its sibling columns
--
-- Task: user:task/league/add-fumble-return-td-fantasy-scoring.md
--
-- The column is declared `numeric DEFAULT 0 NOT NULL`. Its two siblings are
-- `punt_return_touchdowns smallint NOT NULL` and
-- `kickoff_return_touchdowns smallint NOT NULL` -- no default at all -- as is
-- `fumbles_lost`. Both differences are artifacts of how this column was bolted
-- on, and both point the wrong way:
--
--   * DEFAULT 0 means an INSERT that omits the column silently lands on 0,
--     the opposite of the ruling that fumble return TDs are worth 6 points
--     everywhere. Its siblings have no default, so an omission fails loudly.
--     No application insert omits the column today (`SCORING_COLUMNS` in
--     libs-server/find-or-create-format.mjs always names it, and
--     db/fixtures/scoring-formats.mjs sets it explicitly), so this is a trap
--     for hand-written SQL rather than a live defect -- but removing the
--     default is what makes an omission an error instead of a wrong value.
--
--   * `numeric` is unbounded and is the only such column in this table. It also
--     comes back from node-pg as a STRING, where smallint comes back as a
--     number. calculate-points.mjs multiplies the value (`factor * statValue`),
--     which coerces, so nothing is broken today -- but the siblings do not
--     carry that hazard and neither should this column.
--
-- Values are unaffected: all 65 rows carry 6, so the cast is exact and the
-- league_scoring_formats_config_unique tuple across all 23 config columns
-- cannot collapse two previously-distinct formats onto the same key. Postgres
-- rebuilds that index as part of the type change.

\set ON_ERROR_STOP on

BEGIN;

-- Guard: refuse to run if any value would not survive the cast to smallint
-- exactly. This is what makes the retype provably lossless rather than
-- lossless-by-assumption.
DO $$
DECLARE
  offending integer;
BEGIN
  SELECT count(*) INTO offending
  FROM league_scoring_formats
  WHERE fumble_return_touchdowns <> trunc(fumble_return_touchdowns)
     OR fumble_return_touchdowns < -32768
     OR fumble_return_touchdowns > 32767;

  IF offending > 0 THEN
    RAISE EXCEPTION
      'fumble_return_touchdowns: % row(s) would not cast to smallint exactly', offending;
  END IF;
END $$;

ALTER TABLE league_scoring_formats
  ALTER COLUMN fumble_return_touchdowns DROP DEFAULT,
  ALTER COLUMN fumble_return_touchdowns TYPE smallint
    USING fumble_return_touchdowns::smallint;

-- Verify the end state matches the siblings exactly: smallint, NOT NULL, no
-- default.
DO $$
DECLARE
  col record;
BEGIN
  SELECT data_type, column_default, is_nullable INTO col
  FROM information_schema.columns
  WHERE table_name = 'league_scoring_formats'
    AND column_name = 'fumble_return_touchdowns';

  IF col.data_type <> 'smallint'
     OR col.column_default IS NOT NULL
     OR col.is_nullable <> 'NO' THEN
    RAISE EXCEPTION
      'unexpected end state: type=% default=% nullable=%',
      col.data_type, col.column_default, col.is_nullable;
  END IF;
END $$;

COMMIT;
