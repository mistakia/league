-- STATUS: PENDING
--
-- Rollback for 2026-08-08-retype-play-row-mtimes-to-timestamptz.sql.
--
-- Reverses both retypes to integer epoch seconds. Every value originated as an
-- integer epoch second, so the round trip loses nothing -- but confirm that
-- before running rather than trusting it:
--
--   SELECT count(*) FROM nfl_plays WHERE updated <> date_trunc('second', updated);
--
-- must be zero. Note this is a second full 8,489 MB rewrite of nfl_plays under
-- ACCESS EXCLUSIVE, so it is not a cheap undo.

ALTER TABLE public.nfl_plays_current_week ALTER COLUMN updated TYPE integer USING extract(epoch FROM updated)::integer;
ALTER TABLE public.nfl_plays ALTER COLUMN updated TYPE integer USING extract(epoch FROM updated)::integer;
