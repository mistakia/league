-- STATUS: PENDING
--
-- Rollback for 2026-08-08-conform-gsis-it-id-to-gsis-it-player-id.sql.
--
-- Five renames, reversed in the opposite order. Catalog-only and fully lossless:
-- no data moves, and Postgres rewrites the four primary keys and the partitioned
-- unique index back with them. nfl_snaps cascades to all 28 partition children.

ALTER TABLE public.nfl_snaps RENAME COLUMN gsis_it_player_id TO gsis_it_id;
ALTER TABLE public.nfl_plays_rusher RENAME COLUMN gsis_it_player_id TO gsis_it_id;
ALTER TABLE public.nfl_plays_receiver RENAME COLUMN gsis_it_player_id TO gsis_it_id;
ALTER TABLE public.nfl_plays_player RENAME COLUMN gsis_it_player_id TO gsis_it_id;
ALTER TABLE public.nfl_plays_passer RENAME COLUMN gsis_it_player_id TO gsis_it_id;
