-- player college logs conform (user:task/league/redesign-league-database-schema.md,
-- college-logs cluster). Writer-only tables: sole consumer is
-- private/libs-server/sis.mjs (no data-view / app / api reader), so a direct
-- metadata-only rename with no compat view is safe. `int` (reserved word) is the
-- passing-interceptions count (sits in the passing group completions/comp_pct/adot)
-- -> interceptions, matching the unqualified sibling style (completions, receptions,
-- targets). year -> season_year (redesign standard) on the seasonlog table
-- (careerlogs has no year column). The SIS run-direction metrics
-- bounce_pct_when_run_at / pos_pct_when_run_at are NOT timestamps -- they are kept
-- and ratified in audit-schema-conformance.mjs (accepted_non_timestamp_columns).
-- The sole writer is repointed in the same coordinated cutover (separate commit).

SET LOCAL statement_timeout = 0;

-- int -> interceptions (both college log tables)
ALTER TABLE public.player_college_careerlogs RENAME COLUMN "int" TO interceptions;
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN "int" TO interceptions;

-- year -> season_year on the seasonlog table; cascade to the unique constraint and
-- season index, renaming both to match the new column name.
ALTER TABLE public.player_college_seasonlogs RENAME COLUMN year TO season_year;
ALTER TABLE public.player_college_seasonlogs RENAME CONSTRAINT player_college_seasonlogs_pid_season_unique TO player_college_seasonlogs_pid_season_year_unique;
ALTER INDEX public.idx_player_college_seasonlogs_season RENAME TO idx_player_college_seasonlogs_season_year;
