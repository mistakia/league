-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Retype draft.expired_at to timestamptz
--
-- Follow-up to db/adhoc/2026-08-05-expire-unused-draft-picks.sql, which added
-- the column as `integer` unix seconds to match `selection_timestamp` beside
-- it. The schema-conformance ratchet correctly flagged that as new debt
-- (`timestamp_type`): the standard is timestamptz, and matching an existing
-- non-conforming neighbour is how that debt spreads rather than how it gets
-- paid down. Retyping now, while the column holds five rows and nothing but
-- this week's code reads it, costs nothing; retyping it later would be a
-- coordinated change across every consumer.
--
-- `selection_timestamp` stays integer for now. It is pre-existing baselined
-- debt with a much wider blast radius (the draft route, the lineage walker,
-- getDraftDates, the notifications job) and is not this change's to retire.
--
-- The CHECK constraint added alongside the column tests only NULL-ness, so it
-- survives the retype untouched.
--
-- Five rows, all in league 1, all previously written as epoch seconds by the
-- backfill in the file above.

ALTER TABLE public.draft
  ALTER COLUMN expired_at TYPE timestamptz
  USING CASE WHEN expired_at IS NULL THEN NULL ELSE to_timestamp(expired_at) END;

COMMENT ON COLUMN public.draft.expired_at IS
  'When this pick''s draft window closed with no selection made. NULL for picks that were used and for picks whose draft is still open. Mutually exclusive with pid.';

DO $$
DECLARE
  expired_count int;
  wrong_type text;
BEGIN
  SELECT data_type INTO wrong_type
  FROM information_schema.columns
  WHERE table_name = 'draft' AND column_name = 'expired_at';
  IF wrong_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION 'draft.expired_at is %, expected timestamp with time zone', wrong_type;
  END IF;

  SELECT count(*) INTO expired_count FROM draft WHERE expired_at IS NOT NULL;
  IF expired_count <> 5 THEN
    RAISE EXCEPTION 'expected 5 expired picks after retype, got %', expired_count;
  END IF;

  -- The retype must have preserved the instants, not zeroed or shifted them.
  -- Every expired pick belongs to a draft that closed years ago.
  SELECT count(*) INTO expired_count
  FROM draft
  WHERE expired_at IS NOT NULL
    AND (expired_at < '2020-01-01'::timestamptz OR expired_at > now());
  IF expired_count <> 0 THEN
    RAISE EXCEPTION '% expired picks carry an implausible timestamp after retype', expired_count;
  END IF;
END $$;
