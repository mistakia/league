-- STATUS: APPLIED 2026-07-30 against league_production
--
-- player: add fantasypoints_player_id
--
-- Task: user:task/league/add-fantasypoints-player-ids.md
--
-- FantasyPoints publishes no crosswalk to any other identifier system, so every
-- join from its charting surface to internal `pid` currently goes through name
-- matching at query time. Persisting the id once converts those into indexed
-- equalities.
--
-- varchar(12): the id is a 12-character uppercase hex string. 3,804 of 3,804
-- ids sampled across 2021-2025 match `^[0-9A-F]{12}$`, and the same id resolves
-- to the same player in every season it appears in.
--
-- The index is plain, not partial. Postgres treats NULLs as distinct, so the
-- 24k+ unpopulated rows do not collide, and a predicate would buy nothing.
-- Naming follows the modern sibling convention, which drops the `_player`
-- infix (`player_underdog_id_unique`, `player_cbs_id_unique`); the `idx_24798_*`
-- names elsewhere on this table are legacy artifacts of the MySQL conversion.

ALTER TABLE public.player
  ADD COLUMN IF NOT EXISTS fantasypoints_player_id character varying(12);

CREATE UNIQUE INDEX IF NOT EXISTS player_fantasypoints_id_unique
  ON public.player USING btree (fantasypoints_player_id);
