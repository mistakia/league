-- STATUS: PENDING
--
-- Rollback for 2026-08-08-conform-venue-ids-and-drop-sportradar-event-id.sql.
--
-- The FK, the two renames and the dimension table reverse exactly; the dimension
-- is derived wholly from nfl_games and holds nothing nfl_games does not, so
-- dropping it loses no data.
--
-- The DROP does NOT reverse with its data: re-adding sportradar_event_id
-- restores the schema shape only. That is lossless here solely because the column
-- was verified 100% NULL across all 27 nfl_plays partitions before the drop.
-- Re-added at its original type (character varying, nullable, no default) on the
-- partitioned parent so it cascades to every child.

ALTER TABLE public.nfl_plays ADD COLUMN sportradar_event_id character varying;

ALTER TABLE public.nfl_games DROP CONSTRAINT nfl_games_nfl_stadium_id_fkey;

ALTER TABLE public.nfl_games RENAME COLUMN ngs_stadium_id TO ngs_site_id;
ALTER TABLE public.nfl_games RENAME COLUMN nfl_stadium_id TO stad_nfl_id;

DROP TABLE public.nfl_stadium;
