-- Drop worker_heartbeat (superseded by runs primitive).
-- The import-live-{odds,plays} workers no longer write to this table; staleness
-- detection moves to the runs oracle's stale-runs sweep for source
-- service:league-import-live-odds-worker / service:league-import-live-plays-worker.
-- See user:task/base/sweep-league-to-runs-primitive.md.
--
-- yarn db:exec db/adhoc/2026-06-08-drop-worker-heartbeat.sql
-- yarn export:schema

DROP TABLE IF EXISTS worker_heartbeat;
