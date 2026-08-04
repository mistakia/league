-- Companion audit table for the position vocabulary backfills
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- The backfills are plain UPDATEs. League's whole-database backup runs Tuesday
-- and Friday only, so restoring from backup to undo one would discard up to
-- four days of unrelated production writes. This table is the rollback: every
-- backfill UPDATE records the prior value here before overwriting, so any
-- single column can be reversed with a join back onto its own audit rows.
--
-- row_key is jsonb because the in-scope tables have different primary keys --
-- player is keyed on pid, player_gamelogs on (esbid, pid, season_year),
-- pff_player_seasonlogs on (pid, season_year). One shape holds all of them.

CREATE TABLE public.position_vocabulary_backfill_audit (
  audit_id bigserial PRIMARY KEY,
  table_name character varying(64) NOT NULL,
  column_name character varying(32) NOT NULL,
  row_key jsonb NOT NULL,
  old_value character varying(16),
  new_value character varying(16),
  applied_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_position_vocabulary_backfill_audit_table_column
  ON public.position_vocabulary_backfill_audit (table_name, column_name);
