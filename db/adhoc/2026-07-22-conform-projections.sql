-- Conform the projections cluster to the full-word vocabulary end state.
-- Tables: projections, projections_index (+8 partitions _default/_y2020.._y2026),
--   projections_archive, ros_projections. Fantasy-stat vocab already landed
--   (2026-07-22-fantasy-stat-vocabulary-rename.sql); this covers the remainder:
--   year -> season_year; seas_type -> season_type (+ its backing enum + function);
--   epoch-bigint "timestamp" -> generated_at timestamptz.
-- No BEGIN/COMMIT: yarn db:exec already wraps the file in one transaction.
-- projections is 4.6M rows / 2.4GB -> the "timestamp" retype is a full rewrite
--   (ACCESS EXCLUSIVE); year/seas_type renames are metadata-only.
SET LOCAL statement_timeout = '60min';

-- Section 1: seas_type enum + its one consumer function (scoped entirely to this
-- cluster; the enum types exactly 10 relations, all in this family; every other
-- seas_type-named column in the schema is plain varchar and is unaffected).
-- The nfl_week_id generated columns and DEFAULT 'REG' defaults auto-propagate
-- (parsed node trees keyed by OID, not text) -- no manual expression rewrite.
ALTER TYPE public.seas_type RENAME TO season_type;
ALTER FUNCTION public.seas_type_to_text(public.season_type) RENAME TO season_type_to_text;

-- Section 2: year -> season_year, seas_type -> season_type. RENAME COLUMN on the
-- projections_index parent cascades to all 8 partition children and updates the
-- PARTITION BY RANGE key display automatically.
ALTER TABLE public.projections RENAME COLUMN year TO season_year;
ALTER TABLE public.projections RENAME COLUMN seas_type TO season_type;

ALTER TABLE public.projections_index RENAME COLUMN year TO season_year;
ALTER TABLE public.projections_index RENAME COLUMN seas_type TO season_type;

ALTER TABLE public.projections_archive RENAME COLUMN year TO season_year;

ALTER TABLE public.ros_projections RENAME COLUMN year TO season_year;

-- Section 3: "timestamp" -> generated_at. projections/ros_projections are bigint
-- epoch seconds -> timestamptz (full rewrite). projections_archive is already
-- timestamptz -> rename only (keeps the two mirror tables' names in lockstep).
ALTER TABLE public.projections
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.projections RENAME COLUMN "timestamp" TO generated_at;

ALTER TABLE public.ros_projections
  ALTER COLUMN "timestamp" TYPE timestamptz USING to_timestamp("timestamp");
ALTER TABLE public.ros_projections RENAME COLUMN "timestamp" TO generated_at;

ALTER TABLE public.projections_archive RENAME COLUMN "timestamp" TO generated_at;

-- Section 4: index names that literally embed year/seas_type. The projections_index
-- natural-key index (parent + 8 children) is the only such family; renamed to a
-- short natural_key name that also escapes the 63-byte truncation the old names hit.
-- (onConflict matches by column list, not name, so this is name-conformance only.)
ALTER INDEX public.idx_projections_index_sourceid_pid_userid_week_year_seas_type
  RENAME TO idx_projections_index_natural_key;
ALTER INDEX public.projections_index_default_sourceid_pid_userid_week_year_seas_ty
  RENAME TO projections_index_default_natural_key_idx;
ALTER INDEX public.projections_index_y2020_sourceid_pid_userid_week_year_seas_type
  RENAME TO projections_index_y2020_natural_key_idx;
ALTER INDEX public.projections_index_y2021_sourceid_pid_userid_week_year_seas_type
  RENAME TO projections_index_y2021_natural_key_idx;
ALTER INDEX public.projections_index_y2022_sourceid_pid_userid_week_year_seas_type
  RENAME TO projections_index_y2022_natural_key_idx;
ALTER INDEX public.projections_index_y2023_sourceid_pid_userid_week_year_seas_type
  RENAME TO projections_index_y2023_natural_key_idx;
ALTER INDEX public.projections_index_y2024_sourceid_pid_userid_week_year_seas_type
  RENAME TO projections_index_y2024_natural_key_idx;
ALTER INDEX public.projections_index_y2025_sourceid_pid_userid_week_year_seas__idx
  RENAME TO projections_index_y2025_natural_key_idx;
ALTER INDEX public.projections_index_y2026_sourceid_pid_userid_week_year_seas__idx
  RENAME TO projections_index_y2026_natural_key_idx;
