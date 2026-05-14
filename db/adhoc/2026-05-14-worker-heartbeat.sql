-- Positive output oracle for PM2 workers (import-live-odds-worker, import-live-plays-worker).
-- Each successful loop iteration upserts its row here; a storage-side scheduled-command
-- alerts when last_iteration_at falls outside the per-status threshold.
-- Applied: 2026-05-14
-- yarn db:exec db/adhoc/2026-05-14-worker-heartbeat.sql
-- yarn export:schema

CREATE TABLE worker_heartbeat (
  worker_name            varchar(64) PRIMARY KEY,
  last_iteration_at      bigint      NOT NULL,
  last_iteration_status  varchar(16) NOT NULL,
  last_iteration_detail  text,
  loop_count             integer     NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- rollback:
-- DROP TABLE worker_heartbeat;
