-- player_gamelogs conform (user:task/league/redesign-league-database-schema.md,
-- player_gamelogs cluster). Ratified renames: opp -> opponent_nfl_team,
-- tm -> nfl_team, year -> season_year.
--
-- Partitioned family: parent + player_gamelogs_default + 27 yearly children
-- (player_gamelogs_year_2000..2026). ALTER TABLE ... RENAME COLUMN on the PARENT
-- cascades to every partition automatically (partition children inherit column
-- identity from the parent; a partition cannot have a differently-named column).
-- Metadata-only, no data movement, no build+swap needed (same-type rename).
--
-- player_gamelogs_active_snapshot_2026_05_23 is a STANDALONE table (not ATTACHed
-- as a partition) and is a frozen one-off snapshot; left untouched here.
--
-- No FUNCTION/VIEW/MATERIALIZED VIEW body references player_gamelogs.opp/tm/year
-- (verified against db/schema.postgres.sql) -- no function-body rewrite needed.
-- No user_data_views field-id embeds these column names -- no table_state REPLACE.

SET LOCAL statement_timeout = 0;

-- Column renames (cascade to player_gamelogs_default + all 27 yearly children)
ALTER TABLE public.player_gamelogs RENAME COLUMN opp TO opponent_nfl_team;
ALTER TABLE public.player_gamelogs RENAME COLUMN tm TO nfl_team;
ALTER TABLE public.player_gamelogs RENAME COLUMN year TO season_year;

-- Parent-level index renames (only the 4 whose names embed tm/year as a token).
-- The partitioned PK (PRIMARY KEY (esbid, pid, year)) embeds no column name in
-- its identifier, so no constraint rename is needed. The ~112 per-partition child
-- index names retain their tm/year tokens (Postgres does not auto-cascade child
-- index names); they are internal and unreferenced -- deliberately not renamed.
ALTER INDEX public.idx_player_gamelogs_esbid_tm RENAME TO idx_player_gamelogs_esbid_nfl_team;
ALTER INDEX public.idx_player_gamelogs_esbid_tm_pid RENAME TO idx_player_gamelogs_esbid_nfl_team_pid;
ALTER INDEX public.idx_player_gamelogs_year_esbid_pid RENAME TO idx_player_gamelogs_season_year_esbid_pid;
ALTER INDEX public.idx_player_gamelogs_active_pid_year RENAME TO idx_player_gamelogs_active_pid_season_year;
