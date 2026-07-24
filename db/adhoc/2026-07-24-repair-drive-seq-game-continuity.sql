-- Repair drive_seq game-continuity for the 48 half-restart games
--
-- ============================================================================
-- THIS SCRIPT HAS NOT BEEN EXECUTED. Executing it is an operator decision.
-- ============================================================================
--
-- Every other file in db/adhoc/ is an append-only record of SQL that has
-- already run, dated by its run date. This one breaks that convention
-- deliberately, on operator instruction, so the repair can be reviewed before
-- it is run. ON EXECUTION, RENAME THIS FILE TO THE ACTUAL RUN DATE
-- (db/adhoc/YYYY-MM-DD-repair-drive-seq-game-continuity.sql) so the directory's
-- semantics are restored rather than silently broken.
--
-- PRECONDITION -- DO NOT RUN BEFORE THIS HOLDS:
--   The nfl_plays/nfl_snaps rename DDL must be applied. This script names the
--   POST-rename column season_year. Production was still pre-rename (`year`) as
--   of 2026-07-24, so running it before the rename window closes fails with
--   Postgres 42703 on the first statement. Every other column it touches
--   (esbid, qtr, drive_seq, drive_play_count, deleted, play_type,
--   play_type_nfl, pass, rush) is untouched by that rename.
--
-- NOT a precondition: the td_tm/ret_tm backfill. This repair renumbers existing
-- drive_seq values with DENSE_RANK and takes td_tm as no input, so drive
-- boundaries are neither read nor recomputed here. Confirmed with the session
-- owning that backfill. A recompute-based repair WOULD have to wait for it.
--
-- WHAT IS BROKEN
--   libs-server/play-enrichment/fixed-drive-enrichment.mjs numbered drives
--   per-half starting at 1, while nflfastR, NFL's driveSequenceNumber,
--   Sportradar and every consumer in this system are game-continuous. In 48
--   games (2025: 32 PRE, 13 POST, 3 REG) the second half restarts at 1, so
--   every second-half drive_seq collides with a first-half one. The
--   ${esbid}_${drive_seq} drive key in drive-play-count-enrichment.mjs and the
--   COUNT(DISTINCT CONCAT(esbid, drive_seq)) denominators in the data-views
--   rate types then address two drives at once: across 2025 PRE, 782 true
--   drives are counted as 443 distinct values; across POST, 334 as 190.
--
-- WHY A RENUMBER IS SUFFICIENT
--   Only the numbering restarted. Drive boundaries within each half are
--   correct, and the counter increments correctly inside a half, so ordering by
--   (half, existing drive_seq) and dense-ranking recovers the game-continuous
--   sequence exactly. No boundary is recomputed.
--
-- OUT OF SCOPE -- THE SECOND CORRUPTION CLASS
--   A distinct set of 22 games (14 in 2025 REG, 1 in 2025 PRE, 7 scattered
--   2001-2023) also carries drive_seq values spanning both halves, but by a
--   different mechanism: a mixed-authority splice, where enrichment-written
--   values are interleaved among source-numbered plays. In 2026010401 the
--   quarter ranges overlap INSIDE a single half (Q1 spans 1-6, Q2 spans 5-10),
--   which no half-restart can produce. Renumbering those games would preserve
--   the splice in place rather than fix it, so the target predicate below
--   excludes them by construction: it requires a half-2 sequence starting at 1
--   under a half-1 maximum above 1. They have their own task.
--
-- EXPECTED EFFECT (measured read-only against league_production, 2026-07-24)
--   48 games targeted, 9,144 rows carrying drive_seq, 9,119 renumbered.
--   1,174 true drives recovered, 19 to 39 per game, contiguous 1..N in all 48.
--   25 rows are deliberately left alone: deleted, malformed rows carrying
--   qtr = 1 with a play_id well inside a later quarter, play_type NULL and
--   play_type_nfl = 'UNSPECIFIED'. Their (half, drive_seq) pair exists on no
--   live play, so they describe no drive and must not be allowed to define one
--   -- letting them into the map would invent 19 phantom first-half drives and
--   shift every subsequent number. They stay deleted and uncounted.
--
-- The target set is re-derived at run time rather than hardcoded, because
-- corruption keeps accruing under the currently-deployed pre-fix code until the
-- deploy hold lifts. 48 is a floor, not a fixed list.
--
-- yarn db:exec wraps this whole file in a single transaction.
-- Run with: yarn db:exec db/adhoc/<run-date>-repair-drive-seq-game-continuity.sql

-- ---------------------------------------------------------------------------
-- Step 1: the games to repair
--
-- Half is `qtr <= 2`, matching get_half() in fixed-drive-enrichment.mjs.
-- `deleted is not true` rather than `deleted = false`: the column is nullable
-- and NULL means not-deleted, which is how the JS predicate reads it. Using
-- `= false` here would drop those rows and undercount the target set.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE repair_target_games ON COMMIT DROP AS
WITH drive_halves AS (
  SELECT
    esbid,
    season_year,
    CASE WHEN qtr <= 2 THEN 1 ELSE 2 END AS half,
    drive_seq
  FROM nfl_plays
  WHERE drive_seq IS NOT NULL
    AND qtr IS NOT NULL
    AND deleted IS NOT TRUE
),
per_game AS (
  SELECT
    esbid,
    MIN(season_year) AS season_year,
    COUNT(DISTINCT drive_seq) AS distinct_drive_seqs,
    COUNT(DISTINCT (half, drive_seq)) AS distinct_half_drive_seqs,
    MAX(drive_seq) FILTER (WHERE half = 1) AS first_half_max,
    MIN(drive_seq) FILTER (WHERE half = 2) AS second_half_min
  FROM drive_halves
  GROUP BY esbid
)
SELECT esbid, season_year, first_half_max, second_half_min
FROM per_game
WHERE distinct_drive_seqs <> distinct_half_drive_seqs  -- a value spans both halves
  AND first_half_max > 1                               -- half 1 got past its first drive
  AND second_half_min = 1;                             -- and half 2 started over

-- ---------------------------------------------------------------------------
-- Step 2: the renumbering map
--
-- Built from live plays only. A deleted play must not be able to define a drive
-- (see the 25 malformed rows described in the header); deleted plays are still
-- renumbered below wherever their (half, drive_seq) pair is one a live play
-- also carries.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE repair_drive_map ON COMMIT DROP AS
WITH live_pairs AS (
  SELECT DISTINCT
    p.esbid,
    CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END AS half,
    p.drive_seq
  FROM nfl_plays p
  JOIN repair_target_games t USING (esbid)
  WHERE p.drive_seq IS NOT NULL
    AND p.qtr IS NOT NULL
    AND p.deleted IS NOT TRUE
)
SELECT
  esbid,
  half,
  drive_seq AS old_drive_seq,
  DENSE_RANK() OVER (PARTITION BY esbid ORDER BY half, drive_seq) AS new_drive_seq
FROM live_pairs;

-- Guard: the map must be contiguous 1..N per game, or the renumber is not the
-- bijection this repair assumes and nothing below should run.
DO $$
DECLARE
  bad_games integer;
BEGIN
  SELECT COUNT(*) INTO bad_games
  FROM (
    SELECT esbid
    FROM repair_drive_map
    GROUP BY esbid
    HAVING MAX(new_drive_seq) <> COUNT(DISTINCT new_drive_seq)
        OR MAX(new_drive_seq) <> COUNT(*)
  ) t;

  IF bad_games > 0 THEN
    RAISE EXCEPTION 'renumber map is not contiguous for % games; aborting', bad_games;
  END IF;
END $$;

-- Guard: no game may enter the target set that is not a half-restart. The
-- second corruption class must not be renumbered.
DO $$
DECLARE
  bad_games integer;
BEGIN
  SELECT COUNT(*) INTO bad_games
  FROM repair_target_games
  WHERE NOT (first_half_max > 1 AND second_half_min = 1);

  IF bad_games > 0 THEN
    RAISE EXCEPTION 'target set contains % non-restart games; aborting', bad_games;
  END IF;
END $$;

-- Capture the rows the map does not cover BEFORE renumbering. After the UPDATE
-- their drive_seq no longer matches old_drive_seq, so this cannot be derived
-- afterwards -- an earlier draft reported it post-update and listed every
-- successfully renumbered row instead.
CREATE TEMP TABLE repair_unmapped_rows ON COMMIT DROP AS
SELECT p.esbid, p.play_id, p.qtr, p.drive_seq, p.play_type_nfl, p.deleted
FROM nfl_plays p
JOIN repair_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
LEFT JOIN repair_drive_map m
  ON m.esbid = p.esbid
  AND m.half = CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END
  AND m.old_drive_seq = p.drive_seq
WHERE p.drive_seq IS NOT NULL
  AND m.new_drive_seq IS NULL;

-- Guard: only deleted rows may go unrenumbered. A live row the map does not
-- cover means the map is not derived from the same population being updated,
-- and the renumber would leave a live play on the old scheme.
DO $$
DECLARE
  live_unmapped integer;
BEGIN
  SELECT COUNT(*) INTO live_unmapped
  FROM repair_unmapped_rows
  WHERE deleted IS NOT TRUE;

  IF live_unmapped > 0 THEN
    RAISE EXCEPTION '% live rows have no renumbering; aborting', live_unmapped;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 3: renumber drive_seq
--
-- season_year is carried through so the update prunes to the partitions the
-- target games live in rather than scanning every season.
-- ---------------------------------------------------------------------------
UPDATE nfl_plays p
SET drive_seq = m.new_drive_seq
FROM repair_drive_map m, repair_target_games t
WHERE p.esbid = t.esbid
  AND p.season_year = t.season_year
  AND m.esbid = p.esbid
  AND m.old_drive_seq = p.drive_seq
  AND m.half = CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END
  AND p.qtr IS NOT NULL
  AND p.drive_seq IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 4: recompute drive_play_count against the new drive keys
--
-- This mirrors should_count_play() in drive-play-count-enrichment.mjs exactly,
-- including the `deleted` term, which the first draft of this repair missed:
--   - deleted plays are excluded
--   - play_type_nfl in (GAME_START, END_QUARTER, END_GAME, TIMEOUT) excluded
--   - play_type in (KOFF, PUNT, FGXP, CONV) excluded
--   - play_type NOPL excluded unless the play carries a pass or a rush
-- The NULL handling matters: a NULL play_type or play_type_nfl is NOT excluded
-- by the JS, so `NOT IN` (which yields NULL, and therefore excludes) has to be
-- written out with an explicit IS NULL branch. Likewise NULL pass/rush read as
-- false in JS, hence the COALESCE.
--
-- Every play in a drive receives that drive's count, matching the JS, which
-- assigns the count to counting and non-counting plays alike. Plays with a NULL
-- drive_seq keep NULL drive_play_count: that is the encoding for "administrative
-- play, belongs to no drive". (In these 48 games there happen to be none -- all
-- 9,144 rows carry a drive_seq -- but the predicate states the rule anyway.)
-- ---------------------------------------------------------------------------
WITH drive_counts AS (
  SELECT
    p.esbid,
    p.season_year,
    p.drive_seq,
    COUNT(*) FILTER (
      WHERE p.deleted IS NOT TRUE
        AND (
          p.play_type_nfl IS NULL
          OR p.play_type_nfl NOT IN ('GAME_START', 'END_QUARTER', 'END_GAME', 'TIMEOUT')
        )
        AND (
          p.play_type IS NULL
          OR p.play_type NOT IN ('KOFF', 'PUNT', 'FGXP', 'CONV')
        )
        AND NOT (
          p.play_type = 'NOPL'
          AND COALESCE(p.pass, false) = false
          AND COALESCE(p.rush, false) = false
        )
    ) AS drive_play_count
  FROM nfl_plays p
  JOIN repair_target_games t
    ON t.esbid = p.esbid AND t.season_year = p.season_year
  WHERE p.drive_seq IS NOT NULL
  GROUP BY p.esbid, p.season_year, p.drive_seq
)
UPDATE nfl_plays p
SET drive_play_count = c.drive_play_count
FROM drive_counts c
WHERE p.esbid = c.esbid
  AND p.season_year = c.season_year
  AND p.drive_seq = c.drive_seq;

-- ---------------------------------------------------------------------------
-- Step 5: verification -- read these before committing
-- ---------------------------------------------------------------------------

-- Must return zero rows: no repaired game may still carry a drive_seq value
-- that appears in both halves. This is the same predicate
-- scripts/audit-drive-seq-coherence.mjs runs weekly.
SELECT
  p.esbid,
  COUNT(DISTINCT p.drive_seq) AS distinct_drive_seqs,
  COUNT(DISTINCT (CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END, p.drive_seq)) AS distinct_half_drive_seqs
FROM nfl_plays p
JOIN repair_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
WHERE p.drive_seq IS NOT NULL
  AND p.qtr IS NOT NULL
  AND p.deleted IS NOT TRUE
GROUP BY p.esbid
HAVING COUNT(DISTINCT p.drive_seq)
     <> COUNT(DISTINCT (CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END, p.drive_seq));

-- Must return zero rows: every repaired game must be contiguous 1..N.
SELECT p.esbid, MIN(p.drive_seq) AS min_seq, MAX(p.drive_seq) AS max_seq,
       COUNT(DISTINCT p.drive_seq) AS distinct_seqs
FROM nfl_plays p
JOIN repair_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
WHERE p.drive_seq IS NOT NULL
  AND p.qtr IS NOT NULL
  AND p.deleted IS NOT TRUE
GROUP BY p.esbid
HAVING MIN(p.drive_seq) <> 1
    OR MAX(p.drive_seq) <> COUNT(DISTINCT p.drive_seq);

-- Informational: the rows left unrenumbered, expected to be the 25 deleted
-- malformed rows described in the header and nothing else.
SELECT * FROM repair_unmapped_rows ORDER BY esbid, play_id;

-- Informational: drive counts recovered per game.
SELECT
  COUNT(*) AS games_repaired,
  SUM(drives) AS true_drives,
  MIN(drives) AS min_drives_per_game,
  MAX(drives) AS max_drives_per_game
FROM (
  SELECT p.esbid, COUNT(DISTINCT p.drive_seq) AS drives
  FROM nfl_plays p
  JOIN repair_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
  WHERE p.drive_seq IS NOT NULL AND p.deleted IS NOT TRUE
  GROUP BY p.esbid
) g;
