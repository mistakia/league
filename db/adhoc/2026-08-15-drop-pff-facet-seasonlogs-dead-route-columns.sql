-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Drop the dead routes and targets_per_route promoted scalars from
-- pff_player_facet_seasonlogs.
--
-- Why. They are the only two promoted scalars on the table that are 100% NULL
-- (0 of 111,339 rows): no projection map in
-- import-pff-archive-player-facet-seasonlogs.mjs writes either, and no
-- data-view column or other consumer reads them. `routes` has no source in any
-- of the 15 season detail facets -- the receiving facets carry only split route
-- counts and rates (man_routes, zone_routes, deep_routes, *_route_rate), never
-- an unprefixed total; `targets_per_route` has no source anywhere (the
-- game-grain `yprr` is yards per route run, not targets per route).
--
-- Where the measurements live instead. The season route total is canonical in
-- pff_player_seasonlogs.routes (exposed as player_pff_routes); game-grain
-- routes is canonical in pff_player_gamelogs.routes (receiving/summary and
-- rushing/summary carry it at 100% coverage). Populating either dead column
-- from those would put one fact in two homes. PFF routes is deliberately not
-- reconciled with NGS routes (player_routes). This mirrors the item-1 drop of
-- the 19 dead scalars from pff_player_facet_gamelogs; this table's remaining
-- promoted-scalar surface is all populated. See
-- user:task/league/repoint-analytics-at-pff-facet-tables.md.

SET lock_timeout = '30s';
SET statement_timeout = 0;

ALTER TABLE public.pff_player_facet_seasonlogs
  DROP COLUMN routes,
  DROP COLUMN targets_per_route;
