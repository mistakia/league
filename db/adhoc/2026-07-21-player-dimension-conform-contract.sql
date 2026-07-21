-- player person-dimension conform: CONTRACT phase (identity-crosswalk cluster)
--
-- Redesign task: user:task/league/redesign-league-database-schema.md
--
-- Run this ONLY after every consumer of the OLD player column names has been
-- repointed to the new names and the coverage gate confirms zero old-name
-- references remain:
--   node db/adhoc/check-migration-coverage.mjs --check-dangling
--   node db/adhoc/scan-source-leakage.mjs --path <touched files>   # exit 0
--   node db/adhoc/audit-schema-conformance.mjs --table player_dimension  # exit 0
--
-- Retires the compat view and restores `player` as the base table name. After
-- this, `player` is the clean single table with new column names and no shim.
-- The base table's grant (SELECT to league_reader) moves back with the rename;
-- the view's grant retires with the view.

DROP VIEW public.player;
ALTER TABLE public.player_dimension RENAME TO player;
