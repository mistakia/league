-- STATUS: APPLIED 2026-08-15 against league_production
--
-- Drop the 19 promoted scalar columns from pff_player_facet_gamelogs.
--
-- Why. All 19 are 100% NULL across the 654,696 rows: the facet-gamelog importer
-- writes identity columns + facet_payload only, and no code reads the scalars.
-- They are dead scaffolding from the original archive-ingest plan, superseded by
-- the typed merged table pff_player_gamelogs (one row per (pid, esbid), 177
-- namespaced measurement columns).
--
-- Decided per what exists upstream at game grain: twelve are season-grain-only
-- (the OL/pass-block/signature/pressure family, already populated in
-- pff_player_facet_seasonlogs); five exist at game grain but are already typed
-- in pff_player_gamelogs (targets, receptions, facet_yards, facet_touchdowns,
-- routes); snap_count and pff_grade exist at game grain only as per-facet
-- fields a generic scalar cannot hold; targets_per_route has no source anywhere.
--
-- The table survives as the raw per-facet landing zone (facet_payload +
-- identity columns), carrying jersey_number and status the typed table does
-- not, and feeding the shared-field-agreement oracle and
-- generate-pff-seasonlog-season-type-rows. See
-- user:task/league/repoint-analytics-at-pff-facet-tables.md.

SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.pff_player_facet_gamelogs
  DROP COLUMN snap_count,
  DROP COLUMN pff_grade,
  DROP COLUMN pressures_allowed,
  DROP COLUMN hurries_allowed,
  DROP COLUMN hits_allowed,
  DROP COLUMN sacks_allowed,
  DROP COLUMN pass_blocking_efficiency,
  DROP COLUMN pass_block_percent,
  DROP COLUMN true_pass_set_snaps,
  DROP COLUMN true_pass_set_grade,
  DROP COLUMN true_pass_set_pressures_allowed,
  DROP COLUMN pressure_percentage,
  DROP COLUMN time_in_pocket,
  DROP COLUMN targets,
  DROP COLUMN receptions,
  DROP COLUMN facet_yards,
  DROP COLUMN facet_touchdowns,
  DROP COLUMN routes,
  DROP COLUMN targets_per_route;
