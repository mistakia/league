-- STATUS: APPLIED 2026-09-02 against league_production
-- Retire the -999 sentinel from the two league-format PERIOD tables, and drop
-- the rest-of-season rows that belong to completed seasons.
--
-- NO DDL. Every statement here is DML against nullable columns, so this needs no
-- production-DDL slot and takes no ACCESS EXCLUSIVE lock.
--
-- Operator ruling 2026-09-02: NULL is the storage spelling for "never in the
-- drawn pool" on the season and rest-of-season tables, replacing `-999` on the
-- first and a conflated `0` on the second. The WEEKLY table keeps `-999` -- a
-- per-week points-added is a different quantity, it is the input the period
-- aggregation skips, and it is its own decision. Nothing here touches it.
--
-- EVERY STATEMENT IS IDEMPOTENT, and that is load-bearing rather than incidental.
-- Both updates are predicated on the value they remove and both deletes on a year
-- that no longer gets written, so a second run matches nothing. Re-run with
-- --reapply once the writer deploy has landed.
--
-- The HISTORICAL half needs no deploy: nothing scheduled writes a completed year,
-- so those rows are a closed population. The CURRENT-YEAR half does -- league
-- 4a7db3f6e makes the producers leave the aggregate key absent so the writers
-- store NULL, and until it is on both hosts the hourly cron keeps putting -999
-- back into 2026 within the hour. A 2026 count that comes back nonzero after
-- this file is the deploy not having landed, not this file having failed.
--
-- The conflated `0` on the rest-of-season table is deliberately NOT touched
-- here, and that is not an omission. A 0 there is usually a REAL measurement: a
-- player in the drawn pool all season who never cleared replacement is worth
-- exactly nothing. Measured 2026-09-02, 12,617 of the 15,988 live rows are 0 and
-- only ~1,894 are exclusions, and no predicate available in SQL separates them.
-- The deployed writer distinguishes them at source and the hourly cron rewrites
-- the whole live year, so that table heals itself within an hour of the deploy.
--
-- Off the cron: process-projections runs hourly at :30 and takes about nine
-- minutes. Nothing here locks a table against it, but a run that lands mid-file
-- rewrites the current year underneath statement (1) and makes its row count
-- unreadable.

SET lock_timeout = '30s';
SET statement_timeout = 0;

--
-- (1) The season board. Both variants, all years.
--
-- Counts measured 2026-09-02 before the deploy: 1,894 positive (all 2026) and
-- 2,813 net (359 in 2020, 858 in 2021, 578 in 2022, 358 in 2023, 424 in 2024,
-- 48 in 2025, 188 in 2026). The 2026 half is expected to be gone by the time
-- this runs -- the cron rewrites the live year -- so a smaller number here is
-- the deploy having worked, not a partial apply.
--

UPDATE public.league_format_player_season_projection_values
SET projected_points_added_positive = NULL
WHERE projected_points_added_positive = -999;

UPDATE public.league_format_player_season_projection_values
SET projected_points_added_net = NULL
WHERE projected_points_added_net = -999;

--
-- (2) The rest-of-season board. Expected to match ZERO rows today, and it is
-- here as the invariant rather than as a repair: this table never carried the
-- sentinel, it carried the conflated 0 instead. A nonzero count is a finding.
--

UPDATE public.league_format_player_rest_of_season_projection_values
SET projected_points_added_positive = NULL
WHERE projected_points_added_positive = -999;

UPDATE public.league_format_player_rest_of_season_projection_values
SET projected_points_added_net = NULL
WHERE projected_points_added_net = -999;

--
-- (3) Rest of season is CURRENT-YEAR-ONLY by semantic, and the historical rows
-- are a writer defect rather than data.
--
-- The quantity runs from the live week to the end of the year. The backfill
-- computed it for completed seasons anyway, summing from whatever the live week
-- happened to be against a year that had already ended -- a number with no
-- interpretation. 719 rows for 2023 and 638 for 2025, measured 2026-09-02.
--
-- The writer no longer produces them: build_league_format_period_inserts takes
-- `write_rest_of_season_period` and both callers state it. So this deletes a
-- closed population rather than one that will refill.
--
-- The literal year is deliberate. Deriving "not the current season" inside the
-- file would make a single run's blast radius depend on when it runs, and this
-- file is run once, dated, and reviewed against the counts above.
--

DELETE FROM public.league_format_player_rest_of_season_projection_values
WHERE season_year <> 2026;
