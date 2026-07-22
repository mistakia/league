-- nfl_team_gamelogs conform (user:task/league/redesign-league-database-schema.md,
-- nfl-team-logs cluster). Writer-only table: sole consumer is
-- private/scripts/import-gamelogs-ngs.mjs (no data-view / app / api reader), so a
-- direct metadata-only ALTER RENAME COLUMN with no compat view is safe. Fixes the
-- misspelled column, brings `year` to the redesign `season_year` standard, and
-- unifies the within-table shorthand inconsistency (yds/atts/tds spelled out to
-- match the yards/attempts/touchdowns columns already present on this same table).
-- The writer's insert-object keys are repointed in the same coordinated cutover
-- (separate code commit); no reverse map. Runs single-txn via yarn db:exec.

SET LOCAL statement_timeout = 0;

-- misspelling fix (counterpart def_yards_after_catch_over_expected is already correct)
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_yarsd_after_catch_over_expected TO off_yards_after_catch_over_expected;

-- year -> season_year (redesign standard)
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN year TO season_year;

-- yds -> yards
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_yds TO off_pass_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_yds_per_play TO off_pass_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_sack_yds TO off_sack_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_yds TO off_rush_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_yds TO def_pass_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_yds_per_play TO def_pass_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_sack_yds TO def_sack_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yds TO def_rush_yards;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yds_per_play TO def_rush_yards_per_play;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_yds_10_plus TO def_rush_yards_10_plus;

-- atts -> attempts
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_atts TO off_pass_attempts;

-- tds -> touchdowns
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_pass_tds TO off_pass_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN off_rush_tds TO off_rush_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_pass_tds TO def_pass_touchdowns;
ALTER TABLE public.nfl_team_gamelogs RENAME COLUMN def_rush_tds TO def_rush_touchdowns;

-- rename the unique constraint to match (old name misnamed the nfl_team column `pid`)
ALTER TABLE public.nfl_team_gamelogs RENAME CONSTRAINT nfl_team_gamelogs_esbid_pid_year_unique TO nfl_team_gamelogs_esbid_nfl_team_season_year_unique;
