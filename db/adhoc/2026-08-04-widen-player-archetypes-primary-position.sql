-- Widen player_archetypes.primary_position to hold EDGE
-- STATUS: APPLIED 2026-08-04 against league_production
--
-- The column is varchar(3), which cannot store the four-character canonical
-- value EDGE. calculate-player-archetypes writes player.primary_position
-- straight through, so the first archetype run after the position backfill
-- would fail on any EDGE player.
--
-- Additive widening only -- no data is rewritten and no existing value is
-- invalidated, so this is safe to apply ahead of the backfill. It is kept in
-- its own file and its own export:schema commit so it stays out of the
-- backfill's apply-to-commit window.

ALTER TABLE public.player_archetypes
  ALTER COLUMN primary_position TYPE character varying(4);
