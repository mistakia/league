-- STATUS: APPLIED 2026-08-13 against league_production
--
-- Converge the last route columns onto the ruled convention.
--
-- The convention (user:guideline/league/database-schema-standards.md, ruled by
-- the operator 2026-08-13 and validated against the live schema): the count of
-- routes run is `routes`, never `routes_run`, because a route is run by
-- definition and the suffix carries no information; per-route rates are
-- `{measure}_per_route`; route TYPE is `charted_route`; and a side prefix is
-- added only on a table that carries more than one side.
--
-- Three renames and one retype, all with a single writer each.
--
-- 1. `nfl_matchup_stats` keeps its `receiving_` prefix. That table holds both
--    the receiving and the coverage half of a matchup, so the prefix is the
--    side qualifier the convention asks for -- only the `_run` suffix is wrong.
--    Deferred from `2026-08-13-college-logs-routes.sql` because a session was
--    backfilling the table at the time; it is parked now, and bulletin #295
--    announces the rename to it.
--
-- 2. `nfl_plays_receiver.route_run` is not a count and not a boolean: it holds
--    route TYPES (GO, FLAT, HITCH, ...), which is exactly what
--    `nfl_plays.charted_route` holds. Two spellings of one concept, so it takes
--    the established name. It is also `character varying` where the sibling is
--    the `nfl_pass_route` enum, so it is retyped in the same breath -- all 12
--    distinct stored values are enum labels, verified, and the table is 23 MB
--    over 189,180 rows, so no statement_timeout override is needed.
--
-- 3. `player_prospect_profile.stat_deep_route_percentage` takes the `pct`
--    spelling the schema uses 914 times against 30 for `percentage`. The
--    `stat_` prefix is left alone: it namespaces 64 columns on that table and
--    is a separate question from the route family.
--
-- Writers, all updated in the same commit: import-matchup-stats-charting.mjs
-- for (1), nothing at all for (2) -- the column has no live code consumer --
-- and the player-overview map in private/libs-server/sis.mjs for (3).
--
-- Two corrections to an earlier version of this header, both caught in review:
-- `validate-charting-import.mjs` was NOT a writer here and names no route
-- column at any revision, and (3)'s writer is the player-overview map rather
-- than the `college_stats` map, which is a different block of the same file.

ALTER TABLE public.nfl_matchup_stats
    RENAME COLUMN receiving_routes_run TO receiving_routes;

ALTER TABLE public.nfl_matchup_stats
    RENAME COLUMN receiving_yards_per_route_run TO receiving_yards_per_route;

ALTER TABLE public.nfl_plays_receiver
    RENAME COLUMN route_run TO charted_route;

ALTER TABLE public.nfl_plays_receiver
    ALTER COLUMN charted_route TYPE public.nfl_pass_route
    USING charted_route::public.nfl_pass_route;

ALTER TABLE public.player_prospect_profile
    RENAME COLUMN stat_deep_route_percentage TO stat_deep_route_pct;
