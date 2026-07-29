-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Result: 4,816,674 rows loaded across 2020-2023. Of 4,876,313 source rows,
-- 48,723 were dropped as undated (see note 5) and 10,916 because their legacy
-- pid could not be resolved unambiguously (8 pids, listed below). pid
-- resolution reached 99.48% of 1,543 distinct legacy ids: 1,433 by derivation,
-- 11 by the crosswalk, 88 by name+draft-year, 3 by name+date-of-birth.
--
-- Unresolved and therefore absent: ISIA-PACH-2022-2000-03-02 (5,138 rows),
-- JOHN-ROSS-2017-1995-11-27 (3,273), CHRI-HOGA-2011-1987-10-24 (1,558),
-- SPEN-BROW-2021-0000-00-00 (727, ambiguous between SPEN-BROW-001150 and
-- SPEN-BROW-009083 -- deliberately NOT guessed), JOHN-JOHN-2022-1999-05-14
-- (192), NW-0115 (18, predates the content-derived scheme),
-- CHRI-BLAI-2021-0000-00-00 (9), LAR (1, a DST abbreviation change).
--
-- Backfill 2020-2023 projection history into `projections_history`.
--
-- NOT a schema change and NOT runnable via `yarn db:exec` -- this uses psql's
-- client-side `\copy` and must be run by psql ON the database host, with the
-- two CSVs already present:
--
--   sudo -u postgres psql -d league_production -v ON_ERROR_STOP=1 \
--     -f 2026-07-29-backfill-projections-history.sql
--
-- Inputs (both produced by the companion converter / the pid-crosswalk export):
--   /tmp/projection-backfill/projections-backfill.csv  -- 4,876,313 rows
--   /tmp/projection-backfill/legacy-pid-to-pid.csv     -- 28,074 rows
--
-- Provenance: the `2023-11-29_04-00-full` dump, the only surviving artifact
-- carrying 2020-2023 projection history. The MySQL->Postgres migration carried
-- neither `projections_archive`'s 2020-2022 nor `projections`' 2023, so live
-- history restarts at 2024-07-16.
--
-- FOUR SEMANTICS THAT ARE NOT REVERSIBLE ONCE LOADED
--
-- 1. season_type is always REG. MySQL-era `projections` had no season-type
--    column at all (unique key: sourceid, pid, userid, timestamp, week, year).
--    Postseason projections are NOT separable from regular-season ones. A 2023
--    POST week-1 projection is indistinguishable from REG week-1 here and is
--    attributed to REG.
--
-- 2. generated_at is America/New_York wall clock, not UTC. MySQL `datetime`
--    carries no zone. Two independent lines of evidence fix the zone: the dump
--    is named `04-00` and its tar member is stamped 09:08 UTC (a 5h offset,
--    i.e. 04:00 EST), and the recovered hour-of-day histogram peaks at 00/02
--    local, which maps onto the live post-migration UTC peak of 04-07 exactly
--    under America/New_York and not at all under UTC. `AT TIME ZONE` resolves
--    EST/EDT per row, so this is DST-correct.
--
-- 3. `snp` is discarded (dropped from Postgres in 2026-05, no target column).
--
-- 4. 2023 is capped at 2023-11-29, the dump's date. The window 2023-11-29 to
--    2024-07-16 is permanently unrecoverable and is NOT filled by this script.
--
-- pid resolution is derivation UNION crosswalk, because neither is sufficient
-- alone and they fail on disjoint sets (98.70% / 93.39% alone, 99.29%
-- together). Any legacy pid resolving to more than one current pid is EXCLUDED
-- rather than guessed -- a wrong pick silently attributes one player's history
-- to another. See user:data/league/pid-crosswalk/README.md.

\set ON_ERROR_STOP on
\timing on

-- The 4.7M-row INSERT exceeds the role's default statement_timeout and is
-- cancelled mid-flight without this, rolling the whole transaction back.
SET statement_timeout = 0;

BEGIN;

-- ---------------------------------------------------------------- staging

DROP TABLE IF EXISTS projection_backfill_staging;
CREATE TABLE projection_backfill_staging (
  legacy_pid text,
  sourceid integer,
  userid integer,
  passing_attempts numeric,
  passing_completions numeric,
  passing_yards numeric,
  passing_interceptions numeric,
  passing_touchdowns numeric,
  rushing_attempts numeric,
  rushing_yards numeric,
  rushing_touchdowns numeric,
  targets numeric,
  receptions numeric,
  receiving_yards numeric,
  receiving_touchdowns numeric,
  fumbles_lost numeric,
  two_point_conversions numeric,
  week smallint,
  season_year smallint,
  -- TEXT on purpose, for two reasons: MySQL permits the zero date
  -- '0000-00-00 00:00:00' in a NOT NULL datetime and Postgres rejects it
  -- outright (COPY aborts), and the zone is applied at insert time rather than
  -- at parse time. Zero dates are filtered below.
  generated_at text,
  field_goals_made numeric,
  field_goal_yards integer,
  field_goals_made_0_19_yards numeric,
  field_goals_made_20_29_yards numeric,
  field_goals_made_30_39_yards numeric,
  field_goals_made_40_49_yards numeric,
  field_goals_made_50_plus_yards numeric,
  extra_points_made numeric,
  defensive_sacks numeric,
  defensive_interceptions numeric,
  defensive_forced_fumbles numeric,
  defensive_recovered_fumbles numeric,
  defensive_three_and_outs numeric,
  defensive_fourth_down_stops numeric,
  defensive_points_against numeric,
  defensive_yards_against numeric,
  defensive_blocked_kicks numeric,
  defensive_safeties numeric,
  defensive_two_point_returns numeric,
  defensive_touchdowns numeric,
  kickoff_return_touchdowns numeric,
  punt_return_touchdowns numeric
);

\copy projection_backfill_staging FROM '/tmp/projection-backfill/projections-backfill.csv' WITH (FORMAT csv, HEADER true)

DROP TABLE IF EXISTS projection_backfill_crosswalk;
CREATE TABLE projection_backfill_crosswalk (legacy_pid text, pid text);

\copy projection_backfill_crosswalk FROM '/tmp/projection-backfill/legacy-pid-to-pid.csv' WITH (FORMAT csv, HEADER true)

CREATE INDEX ON projection_backfill_staging (legacy_pid);
CREATE INDEX ON projection_backfill_crosswalk (legacy_pid);
ANALYZE projection_backfill_staging;
ANALYZE projection_backfill_crosswalk;

-- ------------------------------------------------------------- resolution

-- The legacy id is content-derived: FNAM-LNAM-<draft_year>-<dob>, where the
-- name parts are the first four letters right-padded with 'X' and punctuation
-- stripped. Decompose the ids we actually need so the fallback tiers can match
-- on components rather than on the whole string.
DROP TABLE IF EXISTS projection_backfill_needed;
CREATE TABLE projection_backfill_needed AS
SELECT DISTINCT
  legacy_pid,
  split_part(legacy_pid, '-', 1) AS name_first,
  split_part(legacy_pid, '-', 2) AS name_last,
  NULLIF(split_part(legacy_pid, '-', 3), '')::integer AS nfl_draft_year,
  substring(legacy_pid from '\d{4}-\d{2}-\d{2}$') AS date_of_birth
FROM projection_backfill_staging;

CREATE INDEX ON projection_backfill_needed (legacy_pid);
ANALYZE projection_backfill_needed;

-- The same decomposition over current players.
DROP TABLE IF EXISTS projection_backfill_player_key;
CREATE TABLE projection_backfill_player_key AS
SELECT
  pid,
  rpad(upper(regexp_replace(first_name, '[^A-Za-z]', '', 'g')), 4, 'X')
    AS name_first,
  rpad(upper(regexp_replace(last_name, '[^A-Za-z]', '', 'g')), 4, 'X')
    AS name_last,
  nfl_draft_year,
  date_of_birth
FROM player;

CREATE INDEX ON projection_backfill_player_key (name_first, name_last);
ANALYZE projection_backfill_player_key;

-- Candidate mappings, in descending order of confidence. A lower priority
-- number wins outright; a tier is only consulted when every tier above it
-- produced nothing for that legacy id.
--
--   1  exact derivation, plus DST ids (bare team abbreviations, self-mapping)
--   2  the frozen crosswalk, which catches players whose attributes were
--      corrected after the re-key
--   3  name + draft year, ignoring date of birth. This is what recovers the
--      large 2023-rookie cohort: their birthdate was unknown when the archive
--      was written ('0000-00-00') and was filled in later, so neither
--      derivation nor the crosswalk can reproduce the archived id.
--   4  name + date of birth, ignoring draft year, for draft-year corrections.
--
-- Tiers 3 and 4 are NOT guesses: a match is only accepted when it is unique
-- (enforced below). Where a tier yields more than one current player the
-- legacy id is dropped rather than resolved arbitrarily -- this is exactly
-- what protects `SPEN-BROW-2021-0000-00-00`, which is two different players
-- sharing a name and draft year and separable only by the birthdate the
-- archive recorded as zeros.
DROP TABLE IF EXISTS projection_backfill_candidate;
CREATE TABLE projection_backfill_candidate AS
  SELECT
    rpad(upper(regexp_replace(first_name, '[^A-Za-z]', '', 'g')), 4, 'X')
      || '-' ||
    rpad(upper(regexp_replace(last_name, '[^A-Za-z]', '', 'g')), 4, 'X')
      || '-' || nfl_draft_year || '-' || date_of_birth AS legacy_pid,
    pid,
    1 AS priority
  FROM player
  WHERE nfl_draft_year IS NOT NULL AND date_of_birth IS NOT NULL
UNION ALL
  SELECT pid AS legacy_pid, pid, 1 AS priority
  FROM player
  WHERE length(pid) <= 3
UNION ALL
  SELECT legacy_pid, pid, 2 AS priority
  FROM projection_backfill_crosswalk
UNION ALL
  SELECT n.legacy_pid, p.pid, 3 AS priority
  FROM projection_backfill_needed n
  JOIN projection_backfill_player_key p
    ON p.name_first = n.name_first
   AND p.name_last = n.name_last
   AND p.nfl_draft_year = n.nfl_draft_year
  WHERE n.date_of_birth = '0000-00-00'
UNION ALL
  SELECT n.legacy_pid, p.pid, 4 AS priority
  FROM projection_backfill_needed n
  JOIN projection_backfill_player_key p
    ON p.name_first = n.name_first
   AND p.name_last = n.name_last
   AND p.date_of_birth = n.date_of_birth
  WHERE n.date_of_birth <> '0000-00-00';

CREATE INDEX ON projection_backfill_candidate (legacy_pid);
ANALYZE projection_backfill_candidate;

-- Resolve at the best available priority, then keep only legacy ids that map
-- to exactly ONE current pid at that priority. Anything ambiguous is dropped.
DROP TABLE IF EXISTS projection_backfill_pid_map;
CREATE TABLE projection_backfill_pid_map AS
WITH needed AS (
  SELECT legacy_pid FROM projection_backfill_needed
),
best AS (
  SELECT n.legacy_pid, min(c.priority) AS priority
  FROM needed n
  JOIN projection_backfill_candidate c USING (legacy_pid)
  GROUP BY n.legacy_pid
),
matched AS (
  SELECT DISTINCT b.legacy_pid, b.priority, c.pid
  FROM best b
  JOIN projection_backfill_candidate c
    ON c.legacy_pid = b.legacy_pid AND c.priority = b.priority
)
SELECT legacy_pid, min(pid) AS pid, min(priority) AS priority
FROM matched
GROUP BY legacy_pid
HAVING count(DISTINCT pid) = 1;

CREATE UNIQUE INDEX ON projection_backfill_pid_map (legacy_pid);
ANALYZE projection_backfill_pid_map;

-- Guard: every resolved pid must actually exist in `player`, or the FK-free
-- insert would land orphaned history.
DO $$
DECLARE orphans bigint;
BEGIN
  SELECT count(*) INTO orphans
  FROM projection_backfill_pid_map m
  LEFT JOIN player p ON p.pid = m.pid
  WHERE p.pid IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'pid map contains % pids absent from player', orphans;
  END IF;
END $$;

-- ------------------------------------------------------------------ report

\echo '--- resolution coverage by tier (distinct legacy pids) ---'
SELECT
  (SELECT count(*) FROM projection_backfill_needed) AS total,
  (SELECT count(*) FROM projection_backfill_pid_map) AS resolved,
  (SELECT count(*) FROM projection_backfill_pid_map WHERE priority = 1) AS t1_derivation,
  (SELECT count(*) FROM projection_backfill_pid_map WHERE priority = 2) AS t2_crosswalk,
  (SELECT count(*) FROM projection_backfill_pid_map WHERE priority = 3) AS t3_name_draft_year,
  (SELECT count(*) FROM projection_backfill_pid_map WHERE priority = 4) AS t4_name_dob,
  round(100.0 * (SELECT count(*) FROM projection_backfill_pid_map)
        / (SELECT count(*) FROM projection_backfill_needed), 2) AS pct;

-- Legacy ids that matched candidates but were REJECTED as ambiguous, i.e. the
-- best available tier pointed at more than one current player. These are the
-- cases where guessing would silently attribute one player's history to
-- another, so they are dropped on purpose.
\echo '--- rejected as ambiguous (dropped, not guessed) ---'
SELECT c.legacy_pid, min(c.priority) AS best_priority,
       count(DISTINCT c.pid) AS distinct_candidate_pids,
       string_agg(DISTINCT c.pid, ', ') AS candidates
FROM projection_backfill_candidate c
JOIN projection_backfill_needed n USING (legacy_pid)
LEFT JOIN projection_backfill_pid_map m USING (legacy_pid)
WHERE m.legacy_pid IS NULL
GROUP BY c.legacy_pid
ORDER BY c.legacy_pid;

\echo '--- unresolved legacy pids, with the row volume each one costs ---'
SELECT s.legacy_pid, count(*) AS rows,
       min(s.season_year) AS first_season, max(s.season_year) AS last_season
FROM projection_backfill_staging s
LEFT JOIN projection_backfill_pid_map m USING (legacy_pid)
WHERE m.legacy_pid IS NULL
GROUP BY s.legacy_pid ORDER BY rows DESC;

\echo '--- rows resolvable vs dropped ---'
SELECT
  count(*) AS source_rows,
  count(m.pid) AS resolvable_rows,
  count(*) - count(m.pid) AS dropped_unresolved_pid
FROM projection_backfill_staging s
LEFT JOIN projection_backfill_pid_map m USING (legacy_pid);

-- Undated rows. MySQL-era AVERAGE (sourceid 18) was written with the zero date
-- '0000-00-00 00:00:00' -- EVERY sourceid=18 row in the archive is zero-dated
-- and not one carries a real timestamp. This is the same defect the Postgres
-- era expresses as `generated_at = new Date(0)`: the consensus source is
-- derived and has never been given a real observation instant.
--
-- These rows are EXCLUDED. A row with no observation time cannot answer the
-- only question this table exists to answer ("what did the projection say as
-- of D"), and inventing a timestamp would fabricate history. AVERAGE is
-- recomputable from the per-source rows that ARE dated, which the same load
-- restores.
\echo '--- undated rows excluded (zero date), by sourceid ---'
SELECT sourceid, count(*) AS rows, count(DISTINCT season_year) AS seasons
FROM projection_backfill_staging
WHERE generated_at LIKE '0000-00-00%'
GROUP BY sourceid ORDER BY rows DESC;

-- ------------------------------------------------------------------ insert

INSERT INTO projections_history (
  pid, sourceid, userid,
  passing_attempts, passing_completions, passing_yards, passing_interceptions,
  passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns,
  targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost,
  -- nfl_week_id is a GENERATED column
  -- (season_year || '_' || season_type || '_WEEK_' || week) and must be
  -- omitted; Postgres rejects any explicit value for it.
  two_point_conversions, week, season_year, generated_at, season_type,
  field_goals_made, field_goal_yards, field_goals_made_0_19_yards,
  field_goals_made_20_29_yards, field_goals_made_30_39_yards,
  field_goals_made_40_49_yards, field_goals_made_50_plus_yards,
  extra_points_made, defensive_sacks, defensive_interceptions,
  defensive_forced_fumbles, defensive_recovered_fumbles,
  defensive_three_and_outs, defensive_fourth_down_stops,
  defensive_points_against, defensive_yards_against, defensive_blocked_kicks,
  defensive_safeties, defensive_two_point_returns, defensive_touchdowns,
  kickoff_return_touchdowns, punt_return_touchdowns
)
SELECT
  m.pid, s.sourceid, s.userid,
  s.passing_attempts, s.passing_completions, s.passing_yards,
  s.passing_interceptions, s.passing_touchdowns, s.rushing_attempts,
  s.rushing_yards, s.rushing_touchdowns, s.targets, s.receptions,
  s.receiving_yards, s.receiving_touchdowns, s.fumbles_lost,
  s.two_point_conversions, s.week, s.season_year,
  s.generated_at::timestamp AT TIME ZONE 'America/New_York',
  'REG'::season_type,
  s.field_goals_made, s.field_goal_yards, s.field_goals_made_0_19_yards,
  s.field_goals_made_20_29_yards, s.field_goals_made_30_39_yards,
  s.field_goals_made_40_49_yards, s.field_goals_made_50_plus_yards,
  s.extra_points_made, s.defensive_sacks, s.defensive_interceptions,
  s.defensive_forced_fumbles, s.defensive_recovered_fumbles,
  s.defensive_three_and_outs, s.defensive_fourth_down_stops,
  s.defensive_points_against, s.defensive_yards_against,
  s.defensive_blocked_kicks, s.defensive_safeties,
  s.defensive_two_point_returns, s.defensive_touchdowns,
  s.kickoff_return_touchdowns, s.punt_return_touchdowns
FROM projection_backfill_staging s
JOIN projection_backfill_pid_map m USING (legacy_pid)
WHERE s.generated_at NOT LIKE '0000-00-00%'
ON CONFLICT (sourceid, pid, userid, generated_at, week, season_year, season_type)
DO NOTHING;

\echo '--- projections_history by season after backfill ---'
SELECT season_year, count(*) AS rows,
       count(DISTINCT generated_at) AS distinct_timestamps,
       min(generated_at) AS first, max(generated_at) AS last
FROM projections_history GROUP BY season_year ORDER BY season_year;

COMMIT;

-- Staging is intentionally left in place for post-load verification. Drop with:
--   DROP TABLE projection_backfill_staging, projection_backfill_crosswalk,
--              projection_backfill_candidate, projection_backfill_pid_map,
--              projection_backfill_needed, projection_backfill_player_key;
--
-- The load is re-runnable and reversible. Re-running is safe because the
-- INSERT is ON CONFLICT DO NOTHING against the natural key, so resolving more
-- legacy ids later and re-running adds only the newly resolved rows. To undo
-- it entirely, delete the recovered seasons while sparing the pre-existing
-- epoch-sentinel rows, which are the only 2020-2023 rows that predate it:
--   DELETE FROM projections_history
--    WHERE season_year <= 2023 AND generated_at > '1990-01-01';
