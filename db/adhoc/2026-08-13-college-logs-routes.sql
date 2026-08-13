-- STATUS: APPLIED 2026-08-13 against league_production
--
-- Converge the college logs onto the schema-wide `routes` spelling.
--
-- `2026-08-13-pff-seasonlogs-routes.sql` settled the spelling for this concept:
-- the bare `routes`, because four tables already carried it
-- (player_receiving_gamelogs, pff_player_facet_gamelogs,
-- pff_player_facet_seasonlogs, nfl_team_seasonlogs) against two spelling it
-- `routes_run`, and the data-view vocabulary exposes only `player_routes` with
-- no `*_routes_run` field anywhere. That file coined `routes` on its own new
-- column and left the two outliers alone under a surgical-scope rule; this file
-- is the follow-through the operator asked for on the same day.
--
-- `yards_per_route_run` moves with it. It is the same family with the same
-- suffix problem, and the derived metrics already in this area read
-- `targets_per_route`, `recv_yards_per_route` and `avg_route_depth` -- so
-- `yards_per_route` is the spelling the rest of the schema already uses for
-- exactly this ratio.
--
-- Neither column has any data-view exposure -- swept across
-- libs-server/data-views-column-definitions/, which yields no column id, no
-- saved-view state and no golden touching either name. So this is a physical
-- rename plus its single writer: `college_stats` in private/libs-server/sis.mjs
-- maps the SIS vendor keys `routesRun` and `yardsPerRouteRun`, and both tables
-- are written only from there (save_player_college_stats).
--
-- Sizes are trivial -- 402 rows in seasonlogs (112 non-null) and 108 in
-- careerlogs (29 non-null) -- so no statement_timeout override is needed.
--
-- DEFERRED, deliberately out of scope: `nfl_matchup_stats.receiving_routes_run`
-- and `receiving_yards_per_route_run`. The `receiving_` prefix is defensible
-- there because that table holds both the receiving and the coverage side of a
-- matchup, so the answer for those two is dropping only the `_run` suffix and
-- keeping the prefix. They are left for a later file because a session was
-- actively backfilling `nfl_matchup_stats` when this one was written, and
-- renaming a column mid-write is a collision.

ALTER TABLE public.player_college_seasonlogs
    RENAME COLUMN routes_run TO routes;

ALTER TABLE public.player_college_seasonlogs
    RENAME COLUMN yards_per_route_run TO yards_per_route;

ALTER TABLE public.player_college_careerlogs
    RENAME COLUMN routes_run TO routes;

ALTER TABLE public.player_college_careerlogs
    RENAME COLUMN yards_per_route_run TO yards_per_route;
