-- STATUS: APPLIED 2026-08-01 against league_production
-- Restricted free agency: configurable window length and processing lead
--
-- Replaces the two hour-of-day settings (restricted_free_agency_announcement_hour /
-- restricted_free_agency_processing_hour), which could only ever express a
-- once-daily cadence, with an explicit anchor plus a window length and a
-- processing lead:
--
--   restricted_free_agency_first_window_at        timestamp of the FIRST announcement
--   restricted_free_agency_window_hours           announcement cadence
--   restricted_free_agency_processing_lead_hours  how long BEFORE the next
--                                                 announcement bids are processed
--
-- Announcements are at window starts; window N opens at
-- first_window_at + N * window_hours and bids on it are processed
-- processing_lead_hours before window N+1 opens. Defining processing relative to
-- the event it must precede makes "process before the next announcement" a
-- property of the schema rather than a rule the scripts have to enforce.
--
-- restricted_free_agency_period_start keeps its existing meaning — when
-- restricted free agency becomes legal (libs-server/verify-restricted-free-agency.mjs)
-- — and is deliberately NOT the anchor. Teams need time between the period
-- opening and the first announcement in order to nominate at all.

-- Refuse to convert any row whose processing hour does not fall before the next
-- announcement hour. No such row exists today (all 122 are either (23,9) or
-- (21,18)); fail loudly rather than silently coercing a future one.
DO $$
DECLARE
  unconvertible_count integer;
BEGIN
  SELECT count(*) INTO unconvertible_count
    FROM seasons
   WHERE restricted_free_agency_announcement_hour <= restricted_free_agency_processing_hour;

  IF unconvertible_count > 0 THEN
    RAISE EXCEPTION
      'cannot convert % seasons row(s): processing hour is not before the following announcement hour',
      unconvertible_count;
  END IF;
END $$;

ALTER TABLE seasons
  ADD COLUMN restricted_free_agency_first_window_at bigint,
  ADD COLUMN restricted_free_agency_window_hours smallint NOT NULL DEFAULT 24,
  ADD COLUMN restricted_free_agency_processing_lead_hours smallint NOT NULL DEFAULT 3;

-- Anchor: the first announcement_hour boundary at or after the period start, in
-- league-local time. announcement_hour = 24 resolves to midnight of the
-- following day, reproducing the old hour-24 special case.
UPDATE seasons SET
  restricted_free_agency_first_window_at = EXTRACT(EPOCH FROM (
    CASE
      WHEN (
        (to_timestamp(restricted_free_agency_period_start) AT TIME ZONE 'America/New_York')::date
        + make_interval(hours => restricted_free_agency_announcement_hour::int)
      ) >= (to_timestamp(restricted_free_agency_period_start) AT TIME ZONE 'America/New_York')
      THEN (
        (to_timestamp(restricted_free_agency_period_start) AT TIME ZONE 'America/New_York')::date
        + make_interval(hours => restricted_free_agency_announcement_hour::int)
      )
      ELSE (
        (to_timestamp(restricted_free_agency_period_start) AT TIME ZONE 'America/New_York')::date
        + make_interval(days => 1, hours => restricted_free_agency_announcement_hour::int)
      )
    END AT TIME ZONE 'America/New_York'
  ))::bigint
WHERE restricted_free_agency_period_start IS NOT NULL;

-- Lead: the existing gap between processing and the following announcement.
-- (23, 9) -> 14h lead, 10h bid window. (21, 18) -> 3h lead, 21h bid window.
UPDATE seasons SET
  restricted_free_agency_processing_lead_hours =
    restricted_free_agency_announcement_hour - restricted_free_agency_processing_hour;

ALTER TABLE seasons
  ADD CONSTRAINT rfa_window_divides_day
    CHECK (restricted_free_agency_window_hours IN (1, 2, 3, 4, 6, 8, 12, 24)),
  ADD CONSTRAINT rfa_processing_precedes_announcement
    CHECK (
      restricted_free_agency_processing_lead_hours >= 1
      AND restricted_free_agency_processing_lead_hours < restricted_free_agency_window_hours
    );

ALTER TABLE seasons
  DROP COLUMN restricted_free_agency_announcement_hour,
  DROP COLUMN restricted_free_agency_processing_hour;
