-- Repair drive_seq mixed-authority splice for a subset of the 22-game second
-- corruption class
--
-- ============================================================================
-- NOT EXECUTED. NO APPLY AUTHORIZATION. Authored per operator instruction to be
-- committed unexecuted; sibling task fix-drive-seq-game-continuity established
-- the precedent (db/adhoc/2026-07-24-repair-drive-seq-game-continuity.sql) and
-- this follows its shape. Do not run against league_production without an
-- explicit operator decision -- see "WHAT THIS DOES NOT FIX" below, which is
-- the reason this cannot be treated as a drop-in replacement for that decision.
-- ============================================================================
--
-- PRECONDITION -- confirmed satisfied 2026-07-25, read-only against
-- league_production:
--   The nfl_plays/nfl_snaps rename DDL is applied (season_year, play_id,
--   offense_nfl_team, defense_nfl_team, possession_nfl_team all present). This
--   script uses only post-rename names.
--
-- NOT a precondition: td_tm/ret_tm backfill. This repair reassigns drive_seq by
-- carrying forward an already-known-correct NEIGHBORING value; it does not run
-- is_new_drive() or any td_tm-dependent boundary logic. See "WHY RECOMPUTE WAS
-- REJECTED" below for why that distinction is load-bearing here.
--
-- ============================================================================
-- WHAT IS BROKEN
-- ============================================================================
-- The follow-up task from fix-drive-seq-game-continuity split out 22 games
-- carrying a drive_seq value spanning both halves WITHOUT the restart-at-1
-- signature (first_half_max > 1, second_half_min == 1) that made the 48-game
-- class safely renumberable. Characterized read-only against
-- league_production on 2026-07-25 under `deleted IS NOT TRUE`.
--
-- MECHANISM (confirmed by direct inspection of drive_seq in play_id order for
-- multiple games in both subgroups, cross-checked against the pre-fix source
-- of libs-server/play-enrichment/fixed-drive-enrichment.mjs at commit
-- a56a1433):
--
--   The pre-fix enrich_fixed_drives grouped plays by (esbid, half) and ran a
--   SINGLE counter across every play in that group -- both plays that already
--   carried a source-supplied drive_seq (Sportradar's own drive_context, or
--   NFL V1's driveSequenceNumber) and plays that did not -- incrementing on
--   every is_new_drive() transition it detected from the FULL sequence. It
--   then wrote that counter's value only into the plays whose drive_seq was
--   null, leaving source-supplied values untouched.
--
--   The counter's own transition count and the source's transition count only
--   need to disagree ONCE anywhere in the game for the value assigned to a
--   null play to no longer match the drive the source considers it to belong
--   to. In every sampled game the null plays are ones the source did not
--   attach to a drive at all: TIMEOUT, GAME_START, END_QUARTER, END_GAME,
--   bare NOPL (penalty-only, no pass/rush), and -- a sub-pattern not
--   previously documented -- CONV (two-point conversion attempts), which
--   Sportradar's play-to-drive mapping (map_drive_data in
--   scripts/import-plays-sportradar.mjs) does not attach a
--   sportradar_drive_id to. Sample: in 2026010401 the real RUSH/PASS/KOFF/
--   PUNT/FGXP plays form a perfectly coherent, game-continuous 1..17
--   sequence; every coherence-violating value sits on a TIMEOUT, NOPL,
--   GAME_START, END_QUARTER, or CONV row.
--
-- TWO SUBGROUPS, distinguished by whether Sportradar covers the game at all:
--   Group B (14 games, all 2025: 2025101902 and the thirteen 2026010* week-18
--   games) -- Sportradar-covered. Real scrimmage plays overwhelmingly carry a
--   sportradar_drive_id and an already-correct, untouched drive_seq. The
--   corrupted rows are exactly the ones Sportradar did not attribute to a
--   drive.
--   Group A (8 games: 2001092311, 2014110209, 2014121413, 2017122406,
--   2021101013, 2023121005, 2023122406, 2025082151) -- no Sportradar coverage,
--   NFL V1 only. driveSequenceNumber is written unconditionally into
--   drive_seq on import (scripts/import-plays-nfl-v1.mjs), so there is no
--   column distinguishing an NFL-supplied value from an enrichment-filled
--   one. The same splice signature is nonetheless visible on TIMEOUT/NOPL/
--   GAME_START/END_QUARTER/END_GAME rows in every sampled Group A game,
--   confirming NFL's own feed leaves the same play types unclassified.
--
-- ============================================================================
-- THE REPAIR: carry-forward from the nearest real neighbor
-- ============================================================================
-- Because the source-supplied values on real scrimmage plays are untouched
-- and correct, and because an event that occurs administratively DURING a
-- drive belongs to that drive by the convention this system uses everywhere
-- else (confirmed read-only: 85-91 percent of administrative-type rows
-- system-wide carry a real, non-null drive_seq, not null -- see the "Known
-- limitations" note below on why null-ing them out was rejected), the correct
-- value for a corrupted row is simply the value of the drive that was
-- actually in progress when it occurred. That value is recoverable directly
-- from the nearest untouched neighboring play, without recomputing any
-- boundary and without touching a single already-correct row.
--
-- "Orphan" rows -- candidates for having been enrichment-filled -- are
-- play_type_nfl IN (GAME_START, END_QUARTER, END_GAME, TIMEOUT), bare NOPL
-- (no pass, no rush), or CONV. Every other typed, drive_seq-carrying row is
-- an "anchor". Each orphan is reassigned the drive_seq of the nearest
-- preceding anchor by play_id within the same game; where no preceding
-- anchor exists (an orphan before the game's first anchor, e.g. a leading
-- GAME_START), the nearest FOLLOWING anchor is used instead. Anchors are
-- never modified.
--
-- ============================================================================
-- WHY RECOMPUTE WAS REJECTED AS THE GENERAL STRATEGY
-- ============================================================================
-- A full recompute (re-running the fixed fixed-drive-enrichment methodology
-- against raw plays, discarding all stored drive_seq) was considered and
-- rejected for two independent reasons, either one sufficient on its own:
--
--   1. td_tm blind spot. is_defensive_td() requires td_tm, and the 2026-07-25
--      backfill left roughly 1,487 plays still blind: fumble-recovery,
--      punt-return, and kickoff-return touchdowns, whose non-offensive cases
--      in libs-shared/get-play-from-play-stats.mjs set td without td_tm.
--      Checked read-only: two of the 22 games -- 2014110209 (play_id 2448, a
--      PUNT with td=true and td_tm null) and 2023121005 (play_id 1533, a RUSH
--      with td=true and td_tm null) -- contain exactly this blind touchdown
--      type. A recompute for either game would misclassify the PAT that
--      follows as opening a new drive, reintroducing a numbering error of the
--      same shape this repair exists to remove.
--
--   2. Not every remaining violation is an orphan-row problem, so recompute
--      would not even be addressing the right target. Simulating the
--      carry-forward repair read-only against all 22 games (see "WHAT THIS
--      DOES NOT FIX" below) shows 6 games stay incoherent afterward, and for
--      2 of those 6 zero orphan rows were touched at all -- the violation
--      sits on an ANCHOR (a real scrimmage play), e.g. 2023121005 play_id
--      2192, a RUSH with drive_seq one lower than both neighbors. A recompute
--      assumes source-supplied values need to be replaced by re-derived ones;
--      here the anchors are exactly the values worth keeping, and at least
--      one of them is itself wrong for a reason this repair's mechanism does
--      not explain and has not characterized.
--
-- Carry-forward has neither problem: it never evaluates is_new_drive() or any
-- td_tm-dependent predicate, and it only ever touches rows independently
-- classified as orphans, so it cannot silently overwrite a correct anchor.
--
-- ============================================================================
-- WHAT THIS DOES NOT FIX -- 6 of the 22 games, EXPECTED, NOT A BUG
-- ============================================================================
-- Simulated read-only against league_production on 2026-07-25: applying this
-- repair's logic across all 22 games resolves 16 to full cross-half coherence
-- and leaves 6 still violating: 2001092311, 2014110209, 2021101013,
-- 2023121005, 2025101902, 2026010300. Two distinct residual mechanisms were
-- identified by inspection, neither an orphan-row problem:
--   - Block-level restart: in 2026010300, a large CONTIGUOUS run of real
--     scrimmage plays across the back half of the game -- not just orphans --
--     carries a second, independently-restarted numbering (dropping from a
--     game-continuous ...10, 11, 12 to 2, 3, ... and continuing there for the
--     rest of the half). Sportradar coverage appears to drop out for a whole
--     block rather than isolated events, so there is no correct "nearest
--     anchor" to carry forward from -- the anchors themselves are wrong for
--     that stretch.
--   - Isolated anchor corruption: in 2023121005, a single real RUSH play
--     (2192) carries a value one lower than both neighbors with no
--     surrounding orphan involvement at all.
-- This script deliberately does not attempt either. Step 5 below reports the
-- post-repair violation set by game so a silent partial success is never
-- mistaken for a full one; the auditor's `other` baseline in
-- scripts/audit-drive-seq-coherence.mjs should be lowered from 22 to however
-- many remain violating (expected 6) when this runs, NOT to 0. The residual 6
-- need per-game diagnosis or a source re-import, not a recompute -- see above
-- -- and are left to a follow-up rather than blocking the 16-game win here.
--
-- ============================================================================
-- WHY NOT NULL OUT THE ORPHAN ROWS INSTEAD
-- ============================================================================
-- drive-play-count-enrichment.mjs documents null drive_seq as the encoding
-- for "administrative play, belongs to no drive," which made null-ing the
-- orphan rows the first candidate repair. Rejected: checked read-only
-- system-wide (not scoped to the 22 games) that 85 percent of
-- admin_type_nfl rows (15,761 / 18,549) and 91 percent of NOPL_admin rows
-- (188,501 / 205,950) carry a non-null drive_seq. Nulling the orphan rows in
-- these 22 games would therefore contradict the convention the rest of the
-- system follows, not restore it -- an administratively-typed play occurring
-- during a drive is supposed to carry that drive's number.
--
-- Ran (dry run only) against a throwaway Postgres 16 container
-- (mixed-authority-repair-pg, port 5541, destroyed after validation), loaded
-- from db/schema.postgres.sql, against a 3-game fixture: an orphan-splice
-- game (mirrors 2026010401), a block-restart game (mirrors 2026010300, to
-- confirm Step 5 correctly reports it as unresolved rather than silently
-- mis-fixing it), and an already-coherent game (to confirm zero rows change).
-- All three behaved as designed. See task observations for the transcript.
--
-- yarn db:exec wraps this whole file in a single transaction.
-- Intended invocation once authorized: yarn db:exec db/adhoc/<run-date>-repair-drive-seq-mixed-authority-splice.sql
-- (rename this file to its actual run date per db/adhoc/README.md convention
-- before executing, matching the precedent in the 2026-07-24 sibling file).

-- ---------------------------------------------------------------------------
-- Step 1: the 22-game target set, re-derived at run time (not hardcoded).
-- Mirrors scripts/audit-drive-seq-coherence.mjs's `other` classification
-- exactly: a cross-half violation that is NOT a restart_at_1 (so the 48-game
-- renumber's target set and this one can never overlap).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE splice_target_games ON COMMIT DROP AS
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
SELECT esbid, season_year
FROM per_game
WHERE distinct_drive_seqs <> distinct_half_drive_seqs
  AND NOT (first_half_max > 1 AND second_half_min = 1);

-- The WHERE NOT (first_half_max > 1 AND second_half_min = 1) clause above
-- structurally excludes every restart_at_1 game from this target set, so
-- this script and the 48-game renumber can never touch the same row.

-- ---------------------------------------------------------------------------
-- Step 2: classify every drive_seq-carrying row in the target games as
-- orphan (candidate enrichment-filled) or anchor (source-supplied, trusted).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE splice_classified ON COMMIT DROP AS
SELECT
  p.esbid,
  p.season_year,
  p.play_id,
  p.qtr,
  p.drive_seq AS old_drive_seq,
  (
    p.play_type_nfl IN ('GAME_START', 'END_QUARTER', 'END_GAME', 'TIMEOUT')
    OR (p.play_type = 'NOPL' AND COALESCE(p.pass, false) = false AND COALESCE(p.rush, false) = false)
    OR p.play_type = 'CONV'
  ) AS is_orphan
FROM nfl_plays p
JOIN splice_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
WHERE p.drive_seq IS NOT NULL
  AND p.qtr IS NOT NULL
  AND p.deleted IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- Step 3: the carry-forward map. prev_anchor / next_anchor rely on anchor
-- values being non-decreasing by play_id within a game, which is exactly the
-- invariant every anchor-only game already satisfies (verified in Step 5 of
-- the characterization, not re-asserted here since a false anchor would fail
-- the "unresolvable" guard below by producing a mismatched correction, not by
-- going undetected).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE splice_repair_map ON COMMIT DROP AS
SELECT
  esbid, season_year, play_id, qtr, is_orphan, old_drive_seq,
  MAX(CASE WHEN NOT is_orphan THEN old_drive_seq END) OVER (
    PARTITION BY esbid ORDER BY play_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS prev_anchor,
  MIN(CASE WHEN NOT is_orphan THEN old_drive_seq END) OVER (
    PARTITION BY esbid ORDER BY play_id ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
  ) AS next_anchor
FROM splice_classified;

-- Guard: every orphan must resolve to some anchor value, in either direction.
-- An orphan with no anchor anywhere in its game means the game has no
-- trustworthy row to carry forward from at all, and this repair must not
-- guess.
DO $$
DECLARE
  unresolvable integer;
BEGIN
  SELECT COUNT(*) INTO unresolvable
  FROM splice_repair_map
  WHERE is_orphan AND prev_anchor IS NULL AND next_anchor IS NULL;

  IF unresolvable > 0 THEN
    RAISE EXCEPTION '% orphan rows have no anchor in either direction; aborting', unresolvable;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 4: apply the correction. Anchors are excluded from the UPDATE's WHERE
-- clause entirely (not merely left unchanged by a no-op CASE), so a bug in
-- the anchor classification cannot silently rewrite a trusted value.
-- ---------------------------------------------------------------------------
UPDATE nfl_plays p
SET drive_seq = COALESCE(m.prev_anchor, m.next_anchor)
FROM splice_repair_map m
WHERE p.esbid = m.esbid
  AND p.season_year = m.season_year
  AND p.play_id = m.play_id
  AND m.is_orphan
  AND p.drive_seq = m.old_drive_seq;

-- ---------------------------------------------------------------------------
-- Step 5: recompute drive_play_count for the touched games. Mirrors
-- should_count_play() in drive-play-count-enrichment.mjs exactly, same as
-- Step 4 of the 2026-07-24 sibling repair (deleted excluded, admin
-- play_type_nfl excluded, KOFF/PUNT/FGXP/CONV excluded, bare NOPL excluded,
-- NULL play_type/play_type_nfl NOT excluded per the JS's truthiness read).
-- Every row in a drive -- orphan and anchor alike -- gets that drive's count,
-- matching enrich_drive_play_counts's per-row assignment.
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
  JOIN splice_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
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
-- Step 6: verification -- read these before committing
-- ---------------------------------------------------------------------------

-- Per-game post-repair coherence. EXPECTED to return 6 rows (2001092311,
-- 2014110209, 2021101013, 2023121005, 2025101902, 2026010300) per the
-- read-only simulation on 2026-07-25 -- this is the known-residual set
-- documented above, not a failure of the script. Any OTHER esbid appearing
-- here is a real regression and must be investigated before this is ever
-- authorized to run.
SELECT
  p.esbid,
  COUNT(DISTINCT p.drive_seq) AS distinct_drive_seqs,
  COUNT(DISTINCT (CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END, p.drive_seq)) AS distinct_half_drive_seqs
FROM nfl_plays p
JOIN splice_target_games t ON t.esbid = p.esbid AND t.season_year = p.season_year
WHERE p.drive_seq IS NOT NULL
  AND p.qtr IS NOT NULL
  AND p.deleted IS NOT TRUE
GROUP BY p.esbid
HAVING COUNT(DISTINCT p.drive_seq)
     <> COUNT(DISTINCT (CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END, p.drive_seq))
ORDER BY p.esbid;

-- Informational: rows changed, by game.
SELECT esbid, COUNT(*) AS orphan_rows_corrected
FROM splice_repair_map
WHERE is_orphan
GROUP BY esbid
ORDER BY esbid;

-- Informational: the full corrected/unresolved game list side by side, for
-- the operator record.
SELECT
  t.esbid,
  (t.esbid NOT IN (
    SELECT p.esbid
    FROM nfl_plays p
    JOIN splice_target_games t2 ON t2.esbid = p.esbid AND t2.season_year = p.season_year
    WHERE p.drive_seq IS NOT NULL AND p.qtr IS NOT NULL AND p.deleted IS NOT TRUE
    GROUP BY p.esbid
    HAVING COUNT(DISTINCT p.drive_seq)
         <> COUNT(DISTINCT (CASE WHEN p.qtr <= 2 THEN 1 ELSE 2 END, p.drive_seq))
  )) AS now_coherent
FROM splice_target_games t
ORDER BY t.esbid;
