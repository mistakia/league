-- STATUS: PENDING
--
-- Rollback for 2026-08-08-retype-lifecycle-stamps-to-timestamptz.sql.
--
-- Reverses each retype back to integer epoch seconds. Lossless in the direction
-- that matters here: every value in these columns originated as an integer epoch
-- second, so the timestamptz round trip carries no sub-second component to lose.
-- Verify that before running this rather than trusting it -- the check is
--
--   SELECT count(*) FROM trades WHERE accepted <> date_trunc('second', accepted);
--
-- repeated per column, and it must be zero. A rollback run after any code has
-- written a sub-second instant WILL truncate.

ALTER TABLE public.rosters ALTER COLUMN last_updated TYPE integer USING extract(epoch FROM last_updated)::integer;

ALTER TABLE public.poaches ALTER COLUMN processed TYPE integer USING extract(epoch FROM processed)::integer;
ALTER TABLE public.poaches ALTER COLUMN submitted TYPE integer USING extract(epoch FROM submitted)::integer;

ALTER TABLE public.restricted_free_agency_bids ALTER COLUMN cancelled TYPE integer USING extract(epoch FROM cancelled)::integer;
ALTER TABLE public.restricted_free_agency_bids ALTER COLUMN processed TYPE integer USING extract(epoch FROM processed)::integer;
ALTER TABLE public.restricted_free_agency_bids ALTER COLUMN submitted TYPE integer USING extract(epoch FROM submitted)::integer;

ALTER TABLE public.waivers ALTER COLUMN cancelled TYPE integer USING extract(epoch FROM cancelled)::integer;
ALTER TABLE public.waivers ALTER COLUMN processed TYPE integer USING extract(epoch FROM processed)::integer;
ALTER TABLE public.waivers ALTER COLUMN submitted TYPE integer USING extract(epoch FROM submitted)::integer;

ALTER TABLE public.trades ALTER COLUMN rejected TYPE integer USING extract(epoch FROM rejected)::integer;
ALTER TABLE public.trades ALTER COLUMN cancelled TYPE integer USING extract(epoch FROM cancelled)::integer;
ALTER TABLE public.trades ALTER COLUMN accepted TYPE integer USING extract(epoch FROM accepted)::integer;
ALTER TABLE public.trades ALTER COLUMN offered TYPE integer USING extract(epoch FROM offered)::integer;
