-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Recover the last 10,057 projection-history rows that
-- `2026-07-29-backfill-projections-history.sql` dropped, by hand-resolving six
-- legacy pids its uniqueness-constrained tiers could not.
--
-- The original load resolved 99.48% of 1,543 distinct legacy ids and dropped
-- 10,916 rows across 8 unresolved ids. This file closes six of those eight. It
-- is a SEPARATE file, and the mapping below is an explicit literal table rather
-- than a widened matching tier, so that hand judgement stays auditable and
-- cleanly separable from automated inference. Nothing here changes how the
-- original tiers behave.
--
-- WHY EACH MAPPING IS SAFE
--
-- The legacy id is content-derived (`FNAM-LNAM-<draft_year>-<dob>`), so it
-- cannot be reproduced once a player's recorded attributes change. Every case
-- below is that: attribute drift, not ambiguity. Each target was confirmed to
-- be the ONLY player matching on the surviving attributes, and each was
-- separately confirmed to hold 2024+ rows in `projections_history` (so the pid
-- is live and correct) while holding ZERO 2020-2023 rows (so these rows really
-- are the missing ones and this is not a double-load).
--
--   ISIA-PACH-2022-2000-03-02 -> ISIA-PACH-015734  (5,102 dated rows)
--     Isiah Pacheco. Sole name match. Draft year 2022 matches exactly; recorded
--     dob is 1999-03-02 against the archive's 2000-03-02 -- same month and day,
--     year off by one.
--   JOHN-ROSS-2017-1995-11-27 -> JOHN-ROSS-015260  (3,237 dated rows)
--     John Ross. Sole name match. Draft year 2017 matches exactly; dob
--     1994-11-27 against 1995-11-27 -- same month and day, year off by one.
--   CHRI-HOGA-2011-1987-10-24 -> CHRI-HOGA-026182  (1,540 dated rows)
--     Chris Hogan. Sole name match. Draft year 2011 matches exactly; dob
--     1988-10-24 against 1987-10-24 -- same month and day, year off by one.
--   JOHN-JOHN-2022-1999-05-14 -> JOHN-JOHN-015261  (174 dated rows)
--     Johnny Johnson III. The name key JOHN-JOHN matches 11 current players, but
--     exactly ONE has draft year 2022. Recorded dob 1999-05-04 against the
--     archive's 1999-05-14 -- day transposed, which is why tier 4 (name + exact
--     dob) missed it and tier 3 did not apply (tier 3 requires a zero dob).
--   CHRI-BLAI-2021-0000-00-00 -> CHRI-BLAI-001248  (3 dated rows)
--     Chris Blair. Sole CHRI-BLAI in `player` at all. The archive recorded no
--     dob and a draft year of 2021 against the recorded 2020, so tier 3
--     (name + draft year) missed it.
--   LAR -> LA  (1 dated row)
--     Rams DST. `LA` is the Los Angeles Rams DST row in `player`; `LAR` has
--     never existed there. A team-abbreviation change, not a player.
--
-- DELIBERATELY NOT RESOLVED
--
--   SPEN-BROW-2021-0000-00-00  (677 dated rows) -- EXCLUDED, and it should stay
--     excluded. It is genuinely ambiguous between SPEN-BROW-001150 and
--     SPEN-BROW-009083: two real players sharing both name and draft year,
--     separable ONLY by the birthdate the archive recorded as zeros. There is no
--     evidence in the archive that distinguishes them, and a wrong pick would
--     silently attribute one player's projection history to the other -- a
--     corruption no later check would catch. 677 rows is not worth that.
--
--   NW-0115  (18 rows) -- MOOT, not pending. This id predates the
--     content-derived scheme entirely, but resolving it would recover NOTHING:
--     all 18 of its rows are `sourceid = 18` (AVERAGE) and zero-dated, and
--     undated rows are excluded by the same rule the original load applied. The
--     ruling in `2026-07-29-drop-average-source-projection-history.sql` makes
--     that permanent -- the AVERAGE consensus is current-state only and is
--     recomputed from dated per-source rows rather than stored. So NW-0115 needs
--     no resolution at any point in the future.
--
-- That is why this file recovers 10,057 rows from six ids rather than the 10,189
-- from seven that were originally scoped: NW-0115's 18 rows were never
-- recoverable, and the seventh id is a mirage.
--
-- Staging is TEMP, not permanent. A permanent staging table in `public` owned by
-- a role the export role cannot lock makes `yarn export:schema` fail for EVERY
-- session, not just this one, because pg_dump takes ACCESS SHARE on every table
-- it can see in a single LOCK TABLE. TEMP tables live in a session-local schema
-- pg_dump never visits, which removes that hazard by construction instead of
-- relying on remembering to drop them.
--
-- The insert is ON CONFLICT DO NOTHING against the natural key, so this file is
-- idempotent and safe to re-run.

-- `yarn db:exec` already wraps this file in a single transaction with
-- ON_ERROR_STOP=1, so no explicit BEGIN/COMMIT here.

SET LOCAL statement_timeout = 0;

CREATE TEMP TABLE hand_resolved_staging (
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
  -- TEXT on purpose: MySQL permits '0000-00-00 00:00:00' in a NOT NULL datetime
  -- and Postgres rejects it outright, so COPY would abort. Zero dates are
  -- filtered at insert time, and the zone is applied there too.
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

\copy hand_resolved_staging FROM '/tmp/projection-backfill/hand-resolved-pids.csv' WITH (FORMAT csv, HEADER true)

-- The hand resolution itself. Priority 0 by construction: this is human
-- judgement, recorded literally, and it is the only mapping consulted here.
CREATE TEMP TABLE hand_resolved_pid_map (legacy_pid text PRIMARY KEY, pid text);
INSERT INTO hand_resolved_pid_map (legacy_pid, pid) VALUES
  ('ISIA-PACH-2022-2000-03-02', 'ISIA-PACH-015734'),
  ('JOHN-ROSS-2017-1995-11-27', 'JOHN-ROSS-015260'),
  ('CHRI-HOGA-2011-1987-10-24', 'CHRI-HOGA-026182'),
  ('JOHN-JOHN-2022-1999-05-14', 'JOHN-JOHN-015261'),
  ('CHRI-BLAI-2021-0000-00-00', 'CHRI-BLAI-001248'),
  ('LAR',                       'LA');

-- Guard: every target pid must exist in `player`. `projections_history` has no
-- FK, so a typo here would land orphaned history that nothing would flag.
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(m.pid, ', ') INTO missing
  FROM hand_resolved_pid_map m
  LEFT JOIN player p ON p.pid = m.pid
  WHERE p.pid IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'hand-resolved map targets pids absent from player: %', missing;
  END IF;
END $$;

-- Guard: refuse to load a legacy id this file does not have a mapping for, and
-- refuse a mapping whose legacy id is absent from the extract. Either means the
-- CSV and the map have drifted apart.
DO $$
DECLARE unmapped text; unused text;
BEGIN
  SELECT string_agg(DISTINCT s.legacy_pid, ', ') INTO unmapped
  FROM hand_resolved_staging s
  LEFT JOIN hand_resolved_pid_map m USING (legacy_pid)
  WHERE m.legacy_pid IS NULL;

  IF unmapped IS NOT NULL THEN
    RAISE EXCEPTION 'extract holds unmapped legacy pids: %', unmapped;
  END IF;

  SELECT string_agg(m.legacy_pid, ', ') INTO unused
  FROM hand_resolved_pid_map m
  LEFT JOIN hand_resolved_staging s ON s.legacy_pid = m.legacy_pid
  WHERE s.legacy_pid IS NULL;

  IF unused IS NOT NULL THEN
    RAISE EXCEPTION 'mapped legacy pids absent from extract: %', unused;
  END IF;
END $$;

\echo '--- rows to load, by legacy pid (dated only) ---'
SELECT s.legacy_pid, m.pid AS resolved_pid, count(*) AS dated_rows,
       min(s.season_year) AS first_season, max(s.season_year) AS last_season
FROM hand_resolved_staging s
JOIN hand_resolved_pid_map m USING (legacy_pid)
WHERE s.generated_at NOT LIKE '0000-00-00%'
GROUP BY s.legacy_pid, m.pid
ORDER BY dated_rows DESC;

INSERT INTO projections_history (
  pid, sourceid, userid,
  passing_attempts, passing_completions, passing_yards, passing_interceptions,
  passing_touchdowns, rushing_attempts, rushing_yards, rushing_touchdowns,
  targets, receptions, receiving_yards, receiving_touchdowns, fumbles_lost,
  -- nfl_week_id is GENERATED and must be omitted.
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
  -- America/New_York wall clock, NOT UTC -- matching the original load. The
  -- MySQL server stored local time.
  s.generated_at::timestamp AT TIME ZONE 'America/New_York',
  -- No seas_type existed in the MySQL era, so postseason cannot be
  -- distinguished and everything loads as REG, as in the original.
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
FROM hand_resolved_staging s
JOIN hand_resolved_pid_map m USING (legacy_pid)
WHERE s.generated_at NOT LIKE '0000-00-00%'
ON CONFLICT (sourceid, pid, userid, generated_at, week, season_year, season_type)
DO NOTHING;

\echo '--- recovered rows now present, by pid and season ---'
SELECT pid, season_year, count(*) AS rows
FROM projections_history
WHERE pid IN (
  SELECT pid FROM hand_resolved_pid_map
) AND season_year BETWEEN 2020 AND 2023
GROUP BY pid, season_year
ORDER BY pid, season_year;
