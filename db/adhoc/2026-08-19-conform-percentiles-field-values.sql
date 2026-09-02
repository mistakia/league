-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Conform percentiles.field VALUES to the column and stat-key names the
-- current writer emits.
--
-- WHY THIS FILE EXISTS. percentiles.field is a varchar that stores a physical
-- column name / stat key as DATA, so no ALTER TABLE reaches it, no schema diff
-- shows it, and every consumer gate resolves names rather than values. league
-- CLAUDE.md records the class and names this column as the known instance:
-- "On any rename, grep the schema for a text/varchar column whose VALUES are
-- column names -- percentiles.field is the known one -- and migrate it beside
-- the ALTER." The 2026-08-15 pct conform did exactly that for its own 725
-- rows (db/adhoc/2026-08-15-conform-pct-to-percentage.sql, final statement).
-- Several LATER clusters did not, and this file is the arrears.
--
-- MEASURED STATE, 2026-08-19 against league_production. Of the 84 distinct
-- percentile_field values app/core/player-fields.js requests, 63 resolve to
-- ZERO rows. 53 of those 63 are stranded by a rename: the rows exist, under the
-- pre-conform spelling, holding correct values. The remaining ~10 (sk, sky,
-- mbt, drops, pdot, qb_hit_pct, rfd, ...) have never been populated by any
-- writer and are a separate, pre-existing gap -- NOT a rename victim, and
-- deliberately untouched here.
--
-- WHY A VALUE REWRITE IS CORRECT AND NOT A RECOMPUTE. The renames moved names,
-- never numbers, so every stranded row's nine percentile columns are still the
-- right values for the metric under its new name. scripts/generate-nfl-team-
-- seasonlogs.mjs is the SOLE writer (verified: no other file in scripts/ or
-- libs-server/ names the table) and derives `field` from its stat-key objects,
-- whose vocabulary is now fully conformed -- so the next run of that script
-- writes the NEW spellings and strands these rows permanently. It is in no
-- crontab, which is why the divergence has been able to sit.
--
-- THE RENAME MAP IS DERIVED, NOT GUESSED. Each pair below was resolved by
-- grepping db/adhoc/*.sql for `RENAME COLUMN <old> TO ...`. Three old names had
-- more than one candidate target and are disambiguated by the writer's own live
-- key set (libs-shared/constants/stats-constants.mjs, 42 keys):
--   pa   -> passing_attempts        (not points_against; dpa carries that)
--   pc   -> passing_completions     (not primary_color, not a stat key)
--   ints -> passing_interceptions   (not defensive_interceptions; dint carries that)
--
-- TWO OLD NAMES ARE ALSO REQUESTED BY A CONSUMER, and both were checked before
-- being included:
--   pts -> points. player-fields.js requests BOTH. All 72 `pts` rows sit under
--     *_AGAINST_* percentile keys, which is exactly the namespace the `points`
--     entries read (lines 107, 143); the `pts` entry (line 494) reads
--     PLAYER_PLAY_BY_PLAY_STATS, which holds zero `pts` rows and is unserved
--     either way. So the rename strictly gains reads and loses none.
--   cpoe -> completion_percentage_over_expected is DELIBERATELY NOT IN THIS
--     FILE. Its consumer (player-fields.js:1066) still pins the literal 'cpoe'
--     behind a comment documenting the divergence, so renaming the data without
--     that edit BREAKS a read that works today. It is data+code coupled and
--     needs a frontend deploy in the same unit; this file is data-only and
--     appliable on its own. Tracked as follow-on.
--
-- `snp` (126 rows) is stranded with NO rename anywhere in db/adhoc and is not
-- in the writer's current key set. Left alone rather than guessed at.
--
-- COLLISION. The primary key is (percentile_key, field), so a rename onto a
-- name that already has a row for the same key would violate it. Measured
-- across all 53 pairs there is exactly ONE: `pa` -> `passing_attempts`, where 2
-- of the 126 `pa` rows share a percentile_key with an existing
-- `passing_attempts` row. Those 2 `passing_attempts` rows were written by a
-- partial run of the already-conformed writer, so they are the NEWER and
-- authoritative values -- the old `pa` row loses. The DELETE below is written
-- generically over the whole map rather than special-casing `pa`, so a
-- collision that appears between authoring and apply is resolved the same way
-- instead of aborting the file.

SET lock_timeout = '30s';
SET statement_timeout = 0;

CREATE TEMP TABLE percentiles_field_rename_map (
  old_field varchar NOT NULL PRIMARY KEY,
  new_field varchar NOT NULL
) ON COMMIT DROP;

INSERT INTO percentiles_field_rename_map (old_field, new_field) VALUES
  -- team / passing-context columns (nfl_team_seasonlogs, player_passing_gamelogs)
  ('air_yards_per_pass_att',             'air_yards_per_pass_attempt'),
  ('avg_target_separation',              'average_target_separation'),
  ('avg_time_to_pressure',               'average_time_to_pressure'),
  ('avg_time_to_sack',                   'average_time_to_sack'),
  ('avg_time_to_throw',                  'average_time_to_throw'),
  ('deep_pass_att_percentage',           'deep_pass_attempt_percentage'),
  ('pass_comp_percentage',               'pass_completion_percentage'),
  ('expected_pass_comp',                 'expected_pass_completion'),
  ('pass_epa_per_db',                    'pass_epa_per_dropback'),
  ('sacks',                              'passing_sacks'),
  -- position-split columns
  ('avg_route_depth',                    'average_route_depth'),
  ('rush_avg_time_to_line_of_scrimmage', 'rush_average_time_to_line_of_scrimmage'),
  ('endzone_recs',                       'endzone_receptions'),
  ('rec_first_down',                     'receiving_first_downs'),
  ('rush_first_down',                    'rushing_first_downs'),
  ('ry_excluding_kneels',                'rushing_yards_excluding_kneels'),
  -- fantasy stat keys
  ('pa',                                 'passing_attempts'),
  ('pc',                                 'passing_completions'),
  ('ints',                               'passing_interceptions'),
  ('tdp',                                'passing_touchdowns'),
  ('py',                                 'passing_yards'),
  ('tdrec',                              'receiving_touchdowns'),
  ('recy',                               'receiving_yards'),
  ('rec',                                'receptions'),
  ('ra',                                 'rushing_attempts'),
  ('tdr',                                'rushing_touchdowns'),
  ('ry',                                 'rushing_yards'),
  ('trg',                                'targets'),
  ('pts',                                'points'),
  ('fuml',                               'fumbles_lost'),
  ('krtd',                               'kickoff_return_touchdowns'),
  ('prtd',                               'punt_return_touchdowns'),
  ('twoptc',                             'two_point_conversions'),
  ('xpm',                                'extra_points_made'),
  ('fgm',                                'field_goals_made'),
  ('fgy',                                'field_goal_yards'),
  ('fg19',                               'field_goals_made_0_19_yards'),
  ('fg29',                               'field_goals_made_20_29_yards'),
  ('fg39',                               'field_goals_made_30_39_yards'),
  ('fg49',                               'field_goals_made_40_49_yards'),
  ('fg50',                               'field_goals_made_50_plus_yards'),
  -- defensive stat keys
  ('dblk',                               'defensive_blocked_kicks'),
  ('dfds',                               'defensive_fourth_down_stops'),
  ('dff',                                'defensive_forced_fumbles'),
  ('dint',                               'defensive_interceptions'),
  ('dpa',                                'defensive_points_against'),
  ('drf',                                'defensive_recovered_fumbles'),
  ('dsf',                                'defensive_safeties'),
  ('dsk',                                'defensive_sacks'),
  ('dtd',                                'defensive_touchdowns'),
  ('dtno',                               'defensive_three_and_outs'),
  ('dtpr',                               'defensive_two_point_returns'),
  ('dya',                                'defensive_yards_against');

-- PRE-CONDITION. No target name may already be an old name in this same map --
-- that would make the rewrite order-dependent and could chain two renames onto
-- one value. Cheap to assert, impossible to notice by reading 53 pairs.
DO $$
DECLARE chained int;
BEGIN
  SELECT count(*) INTO chained
  FROM percentiles_field_rename_map a
  JOIN percentiles_field_rename_map b ON b.old_field = a.new_field;

  IF chained > 0 THEN
    RAISE EXCEPTION
      'rename map is chained: % pair(s) target a name that is itself an old name',
      chained;
  END IF;
END $$;

-- Resolve collisions: drop the OLD-named row wherever its percentile_key
-- already carries a row under the new name. The new-named row is the newer
-- write and wins. Expected: 2 rows (pa -> passing_attempts).
DELETE FROM public.percentiles p
USING percentiles_field_rename_map m
WHERE p.field = m.old_field
  AND EXISTS (
    SELECT 1 FROM public.percentiles q
    WHERE q.percentile_key = p.percentile_key
      AND q.field = m.new_field
  );

-- The rewrite. Expected: 5,289 rows (5,291 matched by the map, less the 2
-- deleted above). All 53 pairs match at least one row -- measured, so no pair
-- in the map is dead weight.
UPDATE public.percentiles p
SET field = m.new_field
FROM percentiles_field_rename_map m
WHERE p.field = m.old_field;

-- POST-CONDITIONS.

-- 1. No old spelling survives anywhere in the column.
DO $$
DECLARE residual int;
BEGIN
  SELECT count(*) INTO residual
  FROM public.percentiles p
  JOIN percentiles_field_rename_map m ON m.old_field = p.field;

  IF residual > 0 THEN
    RAISE EXCEPTION 'percentiles.field still holds % row(s) under an old name', residual;
  END IF;
END $$;

-- 2. The two fields this file was opened for are served. Both consumers
--    (app/core/player-fields.js:1129 and :1057) already read the new spelling,
--    so these counts are the fix landing rather than a restatement of the map.
DO $$
DECLARE deep_rows int; comp_rows int;
BEGIN
  SELECT count(*) INTO deep_rows
  FROM public.percentiles WHERE field = 'deep_pass_attempt_percentage';
  SELECT count(*) INTO comp_rows
  FROM public.percentiles WHERE field = 'pass_completion_percentage';

  IF deep_rows <> 20 OR comp_rows <> 20 THEN
    RAISE EXCEPTION
      'expected 20 rows each for deep_pass_attempt_percentage / pass_completion_percentage, got % and %',
      deep_rows, comp_rows;
  END IF;
END $$;

-- 3. Total row count moved by exactly the collision deletions and nothing else.
--    Asserted as a PROPERTY rather than a literal: every remaining duplicate
--    (percentile_key, field) pair would be a defect, and the primary key already
--    forbids one -- so this checks the map did not silently merge two distinct
--    metrics onto one name, which the PK cannot see because it fires per key.
DO $$
DECLARE merged int;
BEGIN
  SELECT count(*) INTO merged
  FROM (
    SELECT m.new_field
    FROM percentiles_field_rename_map m
    GROUP BY m.new_field
    HAVING count(*) > 1
  ) s;

  IF merged > 0 THEN
    RAISE EXCEPTION '% target name(s) are shared by more than one old name', merged;
  END IF;
END $$;
