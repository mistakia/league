-- STATUS: APPLIED 2026-09-01 against league_production
--
-- The free agency auction's standing-election table.
--
-- An election is a team's instruction on a player for the whole free agency
-- period: a maximum bid, or a decline. It replaces the pass, which lived in
-- Redis, was wiped on every bid, had no un-pass anywhere in the codebase, and
-- was recorded by a non-atomic read-modify-write on a JSON array that could
-- silently drop one of two simultaneous passes.
--
-- Column types follow restricted_free_agency_bids, the nearest neighbour, with
-- the newer `_at` timestamp suffix.
--
-- THERE IS NO `election` COLUMN. A null `maximum_bid` IS the decline. Two
-- columns encoding one fact drift apart, and the null also ranks below every
-- number at settlement -- which reproduces "a maximum at the current price"
-- exactly, without needing a price to exist yet when a manager declines a player
-- days before anyone nominates it.
--
-- `amount_set_at` is distinct from `submitted_at` because the tie rule compares
-- when the WINNING AMOUNT was last set. Without it a manager parks a low maximum
-- on day one, raises it, drops it back, and keeps day-one tiebreak priority.

CREATE TABLE public.auction_elections (
    election_id integer NOT NULL,
    lid integer NOT NULL,
    season_year smallint NOT NULL,
    pid character varying(25) NOT NULL,
    tid integer NOT NULL,
    user_id integer NOT NULL,
    maximum_bid integer,
    submitted_at timestamp with time zone NOT NULL,
    amount_set_at timestamp with time zone NOT NULL,
    withdrawn_at timestamp with time zone,
    settled_at timestamp with time zone,
    outcome character varying(32),
    outcome_detail text
);

CREATE SEQUENCE public.auction_elections_election_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.auction_elections_election_id_seq OWNED BY public.auction_elections.election_id;

ALTER TABLE ONLY public.auction_elections
    ALTER COLUMN election_id SET DEFAULT nextval('public.auction_elections_election_id_seq'::regclass);

ALTER TABLE ONLY public.auction_elections
    ADD CONSTRAINT auction_elections_pkey PRIMARY KEY (election_id);

-- PARTIAL on live rows, mirroring restricted_free_agency_bids_one_live_per_team_player.
-- A full unique constraint would forbid a team from setting a new maximum after
-- withdrawing one, which the revision rules explicitly permit.
CREATE UNIQUE INDEX auction_elections_one_live_per_team_player
    ON public.auction_elections USING btree (lid, season_year, pid, tid)
    WHERE (withdrawn_at IS NULL);

-- Settlement reads every live election on the nominated player; the standing
-- elections view reads every live election a team holds.
CREATE INDEX auction_elections_league_season_player
    ON public.auction_elections USING btree (lid, season_year, pid);

CREATE INDEX auction_elections_league_season_team
    ON public.auction_elections USING btree (lid, season_year, tid);

GRANT SELECT ON TABLE public.auction_elections TO league_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auction_elections TO league_writer;
GRANT USAGE, SELECT ON SEQUENCE public.auction_elections_election_id_seq TO league_writer;
