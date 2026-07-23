-- Drop two dead tables (operator BATCH-APPROVED 2026-07-22, schema-redesign task).
--
--  * worker_heartbeat: superseded by the runs primitive; the import-live-{odds,plays}
--    workers no longer write it (staleness detection moved to the runs stale-sweep).
--    Supersedes the never-applied db/adhoc/2026-06-08-drop-worker-heartbeat.sql.
--  * personnel_count_discrepancies: zero writers/readers; only residual references were
--    the schema dump and the migration-inventory generator (not a consumer).
--
-- Both are standalone (pkey + a league_reader SELECT grant only) — no FK/view dependents.
--
-- yarn db:exec db/adhoc/2026-07-23-drop-dead-tables.sql
-- yarn export:schema

DROP TABLE IF EXISTS public.worker_heartbeat;
DROP TABLE IF EXISTS public.personnel_count_discrepancies;
