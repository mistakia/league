-- Backfill nfl_plays.td (and, for the interception-return subset, ret_td) on
-- the 127 plays flagged as "Residue 1" of the 2026-07-24 td_tm/ret_tm backfill
-- (db/adhoc/2026-07-24-backfill-nfl-plays-td-tm-ret-tm.sql, see its header
-- item 1 and league ABOUT.md [data-gap] observation dated 2026-07-24).
--
-- APPLIED 2026-07-28 against league_production under direct operator
-- authorization: UPDATE 127 (td) and UPDATE 5 (ret_td), both verification
-- queries below now return 0. Before-state was captured to a scratch table for
-- the duration of the apply window and dropped once verified; this file did
-- not ship a rollback of its own.
--
-- What Residue 1 actually is
-- --------------------------
-- 127 plays carry a td_tm (populated by yesterday's backfill from
-- nfl_play_stats stat ids 11/13/22/24/26/28) while nfl_plays.td is NOT true.
-- Two sub-populations, both traced to a definitive root cause below:
--
--   a) 100 plays (2024, esbid 2024082251.. etc: PRE week 3 = 75 rows, POST
--      weeks 3-4 = 25 rows) have td IS NULL. The 75 PRE-week-3 rows also have
--      play_type IS NULL — a wider partial import for that batch of
--      preseason games, of which td is only one symptom. The 25 POST rows are
--      otherwise complete (play_type, offense team, etc. all populated) with
--      only td missing.
--   b) 27 plays (2025 season, in progress) have td = false while ret_td is
--      already true. play_changelog shows a batch of 32 "td: true -> false"
--      writes on 2026-05-24 18:03:33 - 18:20:18 (source recorded as the
--      changelog-unification sentinel 'historical_backfill', which is NOT a
--      real source label -- see db/adhoc/2026-07-22-changelog-unify-small.sql;
--      it means the true origin predates the source column and cannot be
--      recovered). 5 of those 32 also had companion corrections that day
--      (reassigned trg_pid/trg_gsis, drive_seq, catchable_ball) and are
--      legitimately not touchdowns; those 5 are NOT part of this file's
--      target set (their td_tm/ret_tm are correctly NULL already). The other
--      27 got ONLY their td flag flipped, nothing else, and are this file's
--      subset (b).
--
-- Why td=true is the correct restored value, not td_tm/ret_tm being wrong
-- ------------------------------------------------------------------------
-- All 127 plays' play_description (the verbatim NFL play-by-play text, an
-- independent source from both nfl_plays.td and nfl_play_stats) contains the
-- literal word "TOUCHDOWN" -- verified for all 127, zero exceptions. Sample
-- checks against the underlying nfl_play_stats rows for the interception
-- subset confirm valid=true, correctly-teamed, correctly-yarded stat rows
-- (e.g. esbid 2025090800 play_id 2188: stat_id 26, team CHI, 74 yards,
-- valid=true, matching "N.Wright for 74 yards, TOUCHDOWN" verbatim). There is
-- no evidence of a reversed ruling or stale stat row for any of these 127;
-- td (or, for the 2024 PRE/POST subset, td having never been set at all) is
-- the field that is wrong or missing, not td_tm/ret_tm.
--
-- Scope and what this file deliberately does NOT touch
-- ------------------------------------------------------
-- * Does not touch play_type, or any other field, for the 75 PRE-week-3 2024
--   rows with play_type IS NULL. That is a wider partial-import gap requiring
--   a proper reimport of those specific games (scripts/process-plays.mjs /
--   scripts/import-plays-nfl-v1.mjs against those esbids), not a SQL patch --
--   flagged separately, not fixed here.
-- * Does not touch pass_td / rush_td / first_down for any row. Reconstructing
--   those accurately requires re-deriving from the SPECIFIC stat_id that
--   contributed td_tm per play (11/13 -> rush_td, 22/24 -> pass_td), which is
--   a different, unverified derivation from what this file's evidence
--   (play_description text) directly supports. Out of scope here.
-- * Does not touch ret_td except for the 5 rows within this file's own 127-row
--   target set that have ret_tm populated (an interception-return TD) but
--   ret_td still NULL (part of the 2024 PRE/POST partial-import rows). It does
--   NOT touch the other ~13,000 plays league-wide with ret_tm set and ret_td
--   NULL -- those are ordinary non-touchdown interception returns (stat_id
--   25/27 only) where a NULL ret_td is correct, not a residue.
--
-- Idempotent: only writes where the target column does not already hold the
-- new value, so a partial or re-run is safe.

BEGIN;

SET LOCAL statement_timeout = '60s';

UPDATE nfl_plays
SET td = true
WHERE td_tm IS NOT NULL
  AND (td IS NULL OR td = false);

UPDATE nfl_plays
SET ret_td = true
WHERE td_tm IS NOT NULL
  AND ret_tm IS NOT NULL
  AND ret_td IS NULL;

COMMIT;

-- Verification (run separately after commit; expect 0 rows from the first
-- query and the second query's count to match the 127 cited above):
--
-- SELECT count(*) FROM nfl_plays
-- WHERE td_tm IS NOT NULL AND (td IS NULL OR td = false);
--
-- SELECT count(*) FROM nfl_plays
-- WHERE td_tm IS NOT NULL AND ret_tm IS NOT NULL AND ret_td IS NULL;
