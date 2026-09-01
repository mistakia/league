-- STATUS: APPLIED 2026-09-01 against league_production
--
-- Drop the two live-auction instants. The free agency period IS the auction.
--
-- The old design had two events inside the period: the period opening, and a
-- scheduled live auction some days later. The redesign has one. Elections and
-- nominations open when the period opens and the auction runs until it closes,
-- so both columns name events that no longer occur.
--
-- This is a deletion rather than a migration because eight of the ten consumers
-- never read the instant in the first place -- they used
-- free_agency_live_auction_start only as a non-null sentinel meaning "this
-- league has a free agency period configured" and did every real comparison
-- against the period boundaries. Repointing that sentinel at
-- free_agency_period_start is behavior-preserving at all of them.
--
-- The two sites that DID compare against the instant now compare against the
-- period start, which is the one substantive behavior change and the intended
-- one: direct veteran signing is closed for the whole period rather than only
-- until a scheduled auction start, so no manager can sign a player instead of
-- bidding on them.
--
-- free_agency_live_auction_end is additionally a known bad backfill: it reads
-- 2025-09-01T16:29:59Z on all five of the 2021-2025 rows and is correct only
-- for 2025. Dropping it retires the wrong data with the wrong concept.

-- BACKFILL FIRST. Repointing the sentinel is only behavior-preserving where a
-- period start exists, and two rows -- league 1 in 2020 and 2022 -- carry an
-- auction start with no period start. Those rows read "this league has a free
-- agency period" today and would read "it does not" after the drop, which
-- silently blanks the free agency phase in the historical calendar and tag
-- board.
--
-- The value is not invented: get_free_agent_period's own fallback derived the
-- period start as the auction start minus one day, floored to the start of the
-- Eastern day. That fallback becomes unreachable once the column is gone, so
-- this materializes exactly what it used to compute. Confirmed against the live
-- rows before running: 6 rows carry an auction start, 4 already carry a period
-- start, and these are the 2 that do not.
UPDATE public.seasons
SET free_agency_period_start =
      (date_trunc(
        'day',
        (free_agency_live_auction_start AT TIME ZONE 'America/New_York')
          - interval '1 day'
      ) AT TIME ZONE 'America/New_York')
WHERE free_agency_live_auction_start IS NOT NULL
  AND free_agency_period_start IS NULL;

ALTER TABLE public.seasons DROP COLUMN free_agency_live_auction_start;
ALTER TABLE public.seasons DROP COLUMN free_agency_live_auction_end;
