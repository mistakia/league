-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Finalized live auction blocks.
--
-- WHY THIS IS STORED RATHER THAN DERIVED, which is the whole reason the table
-- exists. A block finalizes on UNANIMOUS opt-in among the teams that hold an
-- open active roster spot, and the design freezes that denominator at
-- finalization: a block finalized under a then-eligible set stays finalized even
-- when a trade later makes an eleventh team eligible. Today's rosters cannot
-- answer what the eligible set WAS -- roster rows carry no as-of timestamp and
-- the auction fills spots throughout the period -- so re-deriving finalization
-- from the opt-in rows would silently un-finalize a block the league has already
-- been told is happening. Finalization is a decision made at an instant, and
-- this records it.
--
-- CANDIDACY IS STILL NOT STORED. Every 15-minute boundary in the free agency
-- period is a candidate and the opt-ins carry that; only the handful of blocks
-- that actually convene land here.
--
-- THE FINAL BLOCK IS NOT IN THIS TABLE. It is computed on demand from
-- `period_end - spots_remaining * pace - buffer` and has no opt-in and no
-- unanimity, so a row for it would be a second source of truth that can
-- disagree with the board. See libs-server/auction-final-block.mjs.

CREATE TABLE public.auction_blocks (
    block_id integer NOT NULL,
    lid integer NOT NULL,
    season_year smallint NOT NULL,
    -- The session's first 15-minute boundary, and the first instant after it.
    -- CONSECUTIVE UNANIMOUS BLOCKS RUN AS ONE SESSION, so `ends_at` extends as
    -- adjacent slots finalize rather than a second row appearing: block duration
    -- is whatever the league opted into, not a configured value, and mode
    -- resolution asks one containment question per session.
    block_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    finalized_at timestamp with time zone NOT NULL,
    -- The frozen denominator: how many teams held an open active roster spot at
    -- the moment unanimity was reached. Forensic rather than load-bearing --
    -- recording the finalization is what freezes it -- but it is the evidence
    -- that this block convened legitimately, and the opt-in rows (which keep
    -- their withdrawn ones) name who those teams were.
    unanimity_denominator smallint NOT NULL
);

CREATE SEQUENCE public.auction_blocks_block_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.auction_blocks_block_id_seq OWNED BY public.auction_blocks.block_id;

ALTER TABLE ONLY public.auction_blocks
    ALTER COLUMN block_id SET DEFAULT nextval('public.auction_blocks_block_id_seq'::regclass);

ALTER TABLE ONLY public.auction_blocks
    ADD CONSTRAINT auction_blocks_pkey PRIMARY KEY (block_id);

-- Finalization is idempotent: the opt-in write path and every read of the
-- schedule both evaluate it, so two concurrent evaluations must collide here
-- rather than convene the same block twice.
ALTER TABLE ONLY public.auction_blocks
    ADD CONSTRAINT auction_blocks_one_per_slot UNIQUE (lid, season_year, block_at);

ALTER TABLE ONLY public.auction_blocks
    ADD CONSTRAINT auction_blocks_ends_after_start CHECK (ends_at > block_at);

CREATE INDEX auction_blocks_league_season_window
    ON public.auction_blocks USING btree (lid, season_year, block_at, ends_at);

GRANT SELECT ON TABLE public.auction_blocks TO league_reader;
GRANT SELECT ON TABLE public.auction_blocks TO league_data_view_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auction_blocks TO league_writer;
GRANT USAGE, SELECT ON SEQUENCE public.auction_blocks_block_id_seq TO league_writer;
