-- STATUS: APPLIED 2026-08-25 against league_production
--
-- Add the two first-down-excluding-touchdown primitives to player_seasonlogs,
-- which has been missing them since they were introduced.
--
-- 4e14bc44d ("Add Scott Fish Bowl 2026 scoring and its three primitives")
-- added rushing_first_downs_excluding_touchdowns and
-- receiving_first_downs_excluding_touchdowns to the fantasy-stat vocabulary in
-- libs-shared/calculate-stats-from-play-stats.mjs and to player_gamelogs, and
-- libs-shared/calculate-points.mjs scores off them. player_seasonlogs never
-- got them, even though the plain rushing_first_downs / receiving_first_downs
-- pair is already there.
--
-- scripts/process-player-seasonlogs.mjs aggregates EVERY key of
-- create_empty_fantasy_stats() into this table, so those two keys are a second
-- 42703 sitting behind the `pos` one repaired in
-- 2026-08-24-drop-player-seasonlogs-player-position.sql. Fixing only the first
-- would have left the writer just as dead, and just as silent -- the suite
-- cannot see either, because test/global.mjs loads the same schema file the
-- writer is measured against.
--
-- Found by resolving the writer's insert payload keys against
-- information_schema rather than by reading the source, which is the check
-- docs/guides/schema.md prescribes for exactly this class.
--
-- Type and default mirror the pair already present.

ALTER TABLE public.player_seasonlogs
  ADD COLUMN rushing_first_downs_excluding_touchdowns smallint DEFAULT 0 NOT NULL,
  ADD COLUMN receiving_first_downs_excluding_touchdowns smallint DEFAULT 0 NOT NULL;
