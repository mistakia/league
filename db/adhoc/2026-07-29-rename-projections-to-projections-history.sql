-- Rename `projections` -> `projections_history` for consistency with
-- `projections_index`.
--
-- The pair is a current-state / history split: `projections_index` holds the
--   current value per (sourceid, pid, userid, week, season_year, season_type),
--   while the other table carries `generated_at` INSIDE its unique key and so
--   appends a dated observation per import. The old name said the opposite of
--   what the table does -- the bare noun read as the primary table and the
--   `_index` suffix read as its index, when in fact `_index` is the live one and
--   the bare noun is the archive of observations. This aligns the raw grain with
--   the derived grain, where the same split is already named
--   `league_format_player_projection_values` / `..._values_history`.
--
-- Indexes are renamed alongside the table. Postgres does not rename them
--   automatically, so leaving them would strand `idx_projections_*` names on a
--   table no longer called that. `idx_24926_projection` is a leftover
--   auto-generated name from the MySQL -> Postgres migration and is given a
--   meaningful one here rather than carried forward.
--
-- SEQUENCING -- this file is NOT safe to apply on its own. Every writer names
--   the table literally (14 call sites across scripts/ and private/scripts/), so
--   production breaks the moment the rename lands while the old code is still
--   deployed. Apply this ONLY as part of: deploy the consumer sweep and apply
--   this DDL together, in a window clear of the importers (crontab-main
--   league-imports runs 00:00-02:45 UTC) and of process-projections (hourly at
--   :30). The compatibility-view alternative was rejected as transitional cruft.
--
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- STATUS: PENDING

ALTER TABLE public.projections RENAME TO projections_history;

ALTER INDEX public.idx_24926_projection RENAME TO idx_projections_history_natural_key;
ALTER INDEX public.idx_projections_pid RENAME TO idx_projections_history_pid;
ALTER INDEX public.idx_projections_nfl_week_id RENAME TO idx_projections_history_nfl_week_id;
