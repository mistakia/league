-- Add the underdog_id external id to player (non-destructive).
--
-- Matches the varchar(36) UUID shape of Underdog player ids (same width as
-- sportradar_id / sumer_id). The unique index permits many NULLs (default
-- nulls-distinct), so only populated ids must be unique.
--
-- See user:task/league/redesign-adp-schema-and-import-underdog-bestball.md
--
-- yarn db:exec db/adhoc/2026-06-10-player-underdog-id.sql
-- yarn export:schema

ALTER TABLE public.player
    ADD COLUMN IF NOT EXISTS underdog_id character varying(36);

CREATE UNIQUE INDEX IF NOT EXISTS player_underdog_id_unique
    ON public.player USING btree (underdog_id);
