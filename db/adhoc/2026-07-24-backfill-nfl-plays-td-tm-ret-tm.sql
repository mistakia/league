-- Backfill nfl_plays.td_tm (scoring team) and nfl_plays.ret_tm (return team) from
-- the retained nfl_play_stats source rows.
--
-- !! EXECUTED 2026-07-24. Operator decision granted; the "Gating" section below
-- !! is retained as the historical rationale, not an open question. The run
-- !! touched 50,723 plays across all 26 seasons, leaving td_tm populated on
-- !! 37,706 plays and ret_tm on 14,512. Memorialized in ABOUT.md (413294af).
--
-- Why both columns are empty
-- --------------------------
-- libs-shared/get-play-from-play-stats.mjs is the only writer of these two columns.
-- From its introduction in f4cc6295 (2021-10-26) it assigned `playStat.teamAbbr` — a
-- raw NFL feed key that has never matched a column on the play-stats table (the column
-- was `clubCode` then, `nfl_team` after the plays/snaps rename). The function's only
-- callers pass DB rows from get_play_stats(), so both writes evaluated to `undefined`
-- and silently dropped. 8a1aa708 repointed them to `playStat.nfl_team`, which fixes new
-- imports but leaves all history empty. No other writer has ever existed: the MySQL-era
-- DDL (5b38a12c) declared the columns but nothing populated them, the pre-2021 importers
-- had no equivalent, scripts/import-charted-plays-from-csv.mjs does not touch them, and
-- scripts/export-data-nfl-plays.mjs / libs-server/play-enrichment/yardage-stat-enrichment.mjs
-- only read or forward them.
--
-- Verified against production 2026-07-24: 0 populated rows out of 1,483,695 plays across
-- all 26 seasons (2000-2025), and 0 of 5,969 rows in nfl_plays_current_week.
--
-- Stat-id mapping (mirrors get-play-from-play-stats.mjs exactly)
-- -------------------------------------------------------------
--   td_tm  <- stat ids 11, 13, 22, 24, 26, 28
--             (rush TD, lateral rush TD, receiving TD, lateral receiving TD,
--              INT return TD, lateral INT return TD)
--   ret_tm <- stat ids 25, 26, 27, 28
--             (INT return, INT return TD, lateral INT return, lateral INT return TD)
--
-- The JS applies last-write-wins across a play's stat rows. Verified that this is
-- unambiguous: across all history, every play has exactly ONE distinct team among its
-- td_tm-contributing stats (0 conflicts / 37,706 plays) and among its ret_tm-contributing
-- stats (0 conflicts / 14,512 plays). So max() reproduces the JS result deterministically.
--
-- Team abbreviation normalization (REQUIRED — not cosmetic)
-- --------------------------------------------------------
-- nfl_plays.offense_nfl_team / defense_nfl_team are normalized through
-- libs-shared/fix-team.mjs; nfl_play_stats.nfl_team retains the RAW feed value. Exactly
-- one pair drifts: the San Diego Chargers are 'SD' in play stats and 'LAC' in plays
-- (19,960 offensive stat rows, seasons 2002-2015). Verified this is the ONLY drifted
-- pair — every other raw nfl_team value agrees with the normalized plays value.
--
-- Copying nfl_team through unnormalized would write td_tm='SD' onto 723 ORDINARY
-- OFFENSIVE touchdowns whose offense_nfl_team is 'LAC'. is_defensive_td() in
-- libs-server/play-enrichment/fixed-drive-enrichment.mjs is
--   td AND td_tm AND offense_nfl_team <> td_tm
-- so all 723 would be misread as defensive touchdowns and would suppress a legitimate
-- drive boundary on the following play. The SD -> LAC fold below prevents that.
--
-- Expected effect
-- ---------------
--   td_tm  populated on 37,706 plays  (35,417 offensive TDs where td_tm = offense,
--                                      1,596 interception-return TDs where td_tm = defense,
--                                      27 rows whose play.td flag is false — see below)
--   ret_tm populated on 14,512 plays
-- Post-normalization, the only plays where td_tm <> offense_nfl_team are genuine
-- interception-return touchdowns.
--
-- Known residues (deliberately NOT addressed here — flagged for the operator)
-- --------------------------------------------------------------------------
-- 1. 27 plays receive a td_tm while nfl_plays.td is false. Harmless to consumers
--    (is_defensive_td requires play.td) but indicates a td-flag inconsistency worth a
--    separate look.
-- 2. 241 of 14,583 interception-return stat rows carry a team matching the play's
--    OFFENSE rather than its defense. Those plays get a semantically odd ret_tm.
--    ret_tm has no computational consumer today, so this does not affect drive logic.
-- 3. This mapping covers offensive TDs and interception-return TDs ONLY. Other genuine
--    non-offensive touchdowns are absent from the stat-id list and keep a NULL td_tm:
--    opponent fumble-recovery TDs (stat 60/62, 755 plays), punt-return TDs (34/36, 404),
--    kickoff-return TDs (46/48, 328). Extending td_tm to those would further improve
--    fixed-drive accuracy but is a mapping change to get-play-from-play-stats.mjs, not a
--    backfill, and must be decided separately.
--
-- Gating
-- ------
-- * Column names below are POST-cutover (nfl_team, stat_id, play_id, season_year). The
--   nfl-plays-snaps rename landed on production 2026-07-24 19:24:31-19:24:40, so these
--   names are live and this file runs as written. td_tm / ret_tm were never part of the
--   rename cluster (absent from PLAYS_COLUMN_RENAMES in
--   db/adhoc/check-plays-column-repoint.mjs) — their names are identical on both sides.
-- * Run BEFORE any drive_seq RECOMPUTE. enrich_fixed_drives() only assigns drive_seq
--   where it is currently NULL, so populating td_tm changes no existing value on its own;
--   but a recompute run BEFORE this backfill would bake in the unattributed-TD fallback.
--   Note this does NOT constrain a pure renumber-style repair (e.g. DENSE_RANK over
--   existing drive_seq values), which takes td_tm as no input.
--
-- Idempotent: only writes where the target column IS NULL, so a partial run resumes safely.
--
-- Timeout: production statement_timeout is 30s. The per-season loop below does NOT reset
-- that clock — statement_timeout applies per TOP-LEVEL statement and the whole DO block is
-- one such statement — so the transaction raises it explicitly. The loop's real benefit is
-- partition pruning: nfl_plays is RANGE partitioned on season_year and
-- idx_nfl_plays_season_year_esbid_play_id is UNIQUE on (season_year, esbid, play_id), so
-- each iteration index-scans a single partition instead of seq-scanning the parent.

BEGIN;

-- The DO block is a single statement under a 30s server default; 600s is generous headroom
-- for ~37.7k updated rows while still bounding a pathological hang.
SET LOCAL statement_timeout = '600s';

CREATE TEMP TABLE play_scoring_teams ON COMMIT DROP AS
SELECT
  esbid,
  play_id,
  max(CASE WHEN nfl_team = 'SD' THEN 'LAC' ELSE nfl_team END)
    FILTER (WHERE stat_id IN (11, 13, 22, 24, 26, 28)) AS td_tm,
  max(CASE WHEN nfl_team = 'SD' THEN 'LAC' ELSE nfl_team END)
    FILTER (WHERE stat_id IN (25, 26, 27, 28)) AS ret_tm
FROM nfl_play_stats
WHERE valid
  AND nfl_team IS NOT NULL
  AND stat_id IN (11, 13, 22, 24, 25, 26, 27, 28)
GROUP BY esbid, play_id;

CREATE UNIQUE INDEX ON play_scoring_teams (esbid, play_id);
ANALYZE play_scoring_teams;

DO $$
DECLARE
  target_season int;
  affected bigint;
BEGIN
  FOR target_season IN
    SELECT DISTINCT season_year FROM nfl_plays ORDER BY 1
  LOOP
    UPDATE nfl_plays p
    SET td_tm = coalesce(p.td_tm, s.td_tm),
        ret_tm = coalesce(p.ret_tm, s.ret_tm)
    FROM play_scoring_teams s
    WHERE p.season_year = target_season
      AND p.esbid = s.esbid
      AND p.play_id = s.play_id
      AND (
        (p.td_tm IS NULL AND s.td_tm IS NOT NULL)
        OR (p.ret_tm IS NULL AND s.ret_tm IS NOT NULL)
      );

    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE 'season % : % plays updated', target_season, affected;
  END LOOP;
END $$;

COMMIT;

-- Verification (run separately after commit; expect td_tm 37,706 / ret_tm 14,512 and
-- defensive_tds equal to the 1,596 interception-return touchdowns):
--
-- SELECT count(td_tm) AS td_tm_pop,
--        count(ret_tm) AS ret_tm_pop,
--        count(*) FILTER (WHERE td AND td_tm IS NOT NULL
--                           AND td_tm <> offense_nfl_team) AS defensive_tds
-- FROM nfl_plays;
--
-- SELECT season_year, count(td_tm), count(ret_tm)
-- FROM nfl_plays GROUP BY 1 ORDER BY 1;
