-- STATUS: APPLIED 2026-09-01 against league_production
--
-- Auction pacing configuration on `seasons`, replacing a single boolean.
--
-- The old model was one flag, is_free_agency_auction_slow_mode, which is dropped
-- in a separate dated file once the code that reads it is gone. These columns
-- are added first and alone so that this file is purely additive: it can run
-- against production well ahead of the deploy without changing any behavior,
-- because nothing reads them yet.
--
-- `seasons` constrains in the database even though restricted_free_agency_bids
-- does not -- it already carries seven CHECK constraints -- so each configuration
-- column gets a range check in the style of rfa_processing_precedes_announcement.
--
-- Two columns that deliberately DO NOT appear here:
--
-- - auction_block_granularity_minutes. Fifteen minutes is stated once as
--   AUCTION_BLOCK_GRANULARITY_MINUTES in libs-shared/constants/auction-constants.mjs.
--   A configuration column nothing varies is dead config.
-- - An election-window minimum. Same reason; it is
--   AUCTION_MINIMUM_ELECTION_WINDOW_HOURS in the same file.

ALTER TABLE public.seasons
    ADD COLUMN is_auction_election_mode_enabled boolean DEFAULT false NOT NULL;

-- One hour. Opting into a block is agreeing to ATTEND, not producing work
-- against a deadline, so the restricted-free-agency derivation that produced a
-- half-day figure measured the wrong thing -- that median is a deadline
-- response. One hour makes blocks lightweight enough to convene
-- opportunistically, which is the entire point of the opt-in mechanism.
ALTER TABLE public.seasons
    ADD COLUMN auction_block_notice_minutes smallint DEFAULT 60 NOT NULL;

-- Two minutes per unfilled roster spot. In-block pace across all five prior
-- auctions is 1.17 to 1.89 minutes per player, so two gives headroom over the
-- worst observed year without inflating the final block's reservation.
ALTER TABLE public.seasons
    ADD COLUMN auction_final_block_pace_minutes smallint DEFAULT 2 NOT NULL;

ALTER TABLE public.seasons
    ADD COLUMN auction_final_block_buffer_hours smallint DEFAULT 12 NOT NULL;

-- Ranges rather than exact values: these are tunable, and the checks exist to
-- stop a configuration that would make the final block -- the design's only
-- termination guarantee -- compute into the past or arrive with no warning.
ALTER TABLE public.seasons
    ADD CONSTRAINT auction_block_notice_within_a_day
    CHECK ((auction_block_notice_minutes > 0) AND (auction_block_notice_minutes <= 1440));

ALTER TABLE public.seasons
    ADD CONSTRAINT auction_final_block_pace_positive
    CHECK ((auction_final_block_pace_minutes > 0) AND (auction_final_block_pace_minutes <= 60));

ALTER TABLE public.seasons
    ADD CONSTRAINT auction_final_block_buffer_positive
    CHECK ((auction_final_block_buffer_hours > 0) AND (auction_final_block_buffer_hours <= 72));
