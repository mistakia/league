-- 2026-06-29: Purge the undrafted ADP sentinel (adp >= 999) from the ADP tables.
--
-- Sleeper's projection feed reports adp=999 for every player off the board, and
-- the importer stored it verbatim into player_adp_index (upsert) and
-- player_adp_history (append-only, every run). It accumulated to ~89% of index
-- rows and ~90% of the 14M history rows -- pure noise that polluted ascending
-- sorts and the AVG range-offset aggregate in ADP data views.
--
-- The sentinel is now blocked at both ends:
--   * scripts/import-sleeper-adp-and-projections.mjs filters adp < 999 before
--     insert, so it stops re-accumulating.
--   * libs-server/data-views-column-definitions/player-adp-column-definitions.mjs
--     filters adp < 999 in the player_adp CTE, so consumers never see it.
--
-- This statement purges the historical backlog. No legitimate ADP from any
-- source approaches 999 (observed max ~240), so adp >= 999 is exactly the
-- sentinel set. Expected deletes (as of authoring): ~313,476 from
-- player_adp_index and ~12,697,880 from player_adp_history.

DELETE FROM public.player_adp_history WHERE adp >= 999;
DELETE FROM public.player_adp_index WHERE adp >= 999;
