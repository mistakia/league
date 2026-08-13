-- STATUS: APPLIED 2026-08-13 against league_production
--
-- Revert stat_deep_route_pct to stat_deep_route_percentage.
--
-- `2026-08-13-route-convention-sweep.sql` renamed this column to `_pct` on a
-- schema-wide count: 914 columns end in `_pct` against 30 spelling it
-- `percentage`. That count was real and the conclusion drawn from it was wrong,
-- because it was a reading of the whole schema applied to a table that had
-- already been deliberately conformed the other way.
--
-- `2026-07-22-player-prospect-profile-sis-conform.sql` renamed roughly twenty
-- columns on this table FROM `_pct` TO `_percentage` in one pass -- including
-- this exact column, `stat_deep_route_pct` -> `stat_deep_route_percentage` --
-- applying the guideline's full-word rule, under which `pct` is shorthand for a
-- word the name should spell. 20 of that table's percentage columns still carry
-- the long spelling; the sweep left exactly one carrying the short one.
--
-- So the sweep committed the failure the standards guideline names directly:
-- conforming a member of a family in isolation SPLITS a sibling set into two
-- spellings of one thing. A schema-wide majority does not override a table
-- whose family was conformed on purpose.
--
-- The wider `pct` against `percentage` question is left OPEN rather than
-- settled here. It needs one ruling applied to every table at once, which is a
-- 944-column question and not a route question.

ALTER TABLE public.player_prospect_profile
    RENAME COLUMN stat_deep_route_pct TO stat_deep_route_percentage;
