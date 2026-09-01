-- STATUS: APPLIED 2026-09-01 against league_production
--
-- Opt-ins for live auction blocks.
--
-- Every 15-minute block in the free agency period is a candidate; a block
-- convenes on unanimous opt-in among the teams that still have an open active
-- roster spot. There is no published slate, so CANDIDACY IS NOT STORED -- only
-- the opt-ins are.
--
-- `withdrawn_at` rather than a hard delete because the unanimity denominator
-- FREEZES at finalization: a block finalized on unanimity among the then-eligible
-- teams stays finalized even if a team withdraws afterward, and answering "who
-- was in when this finalized" needs the withdrawn rows.

CREATE TABLE public.auction_block_opt_ins (
    opt_in_id integer NOT NULL,
    lid integer NOT NULL,
    season_year smallint NOT NULL,
    block_at timestamp with time zone NOT NULL,
    tid integer NOT NULL,
    user_id integer NOT NULL,
    opted_in_at timestamp with time zone NOT NULL,
    withdrawn_at timestamp with time zone
);

CREATE SEQUENCE public.auction_block_opt_ins_opt_in_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.auction_block_opt_ins_opt_in_id_seq OWNED BY public.auction_block_opt_ins.opt_in_id;

ALTER TABLE ONLY public.auction_block_opt_ins
    ALTER COLUMN opt_in_id SET DEFAULT nextval('public.auction_block_opt_ins_opt_in_id_seq'::regclass);

ALTER TABLE ONLY public.auction_block_opt_ins
    ADD CONSTRAINT auction_block_opt_ins_pkey PRIMARY KEY (opt_in_id);

-- One row per team per block, live or withdrawn: a team that withdraws and opts
-- back into the SAME block updates its row rather than accumulating history,
-- which is the difference from auction_elections, where a withdrawn maximum and
-- a later one are genuinely different instructions.
ALTER TABLE ONLY public.auction_block_opt_ins
    ADD CONSTRAINT auction_block_opt_ins_one_per_team_block UNIQUE (lid, season_year, block_at, tid);

CREATE INDEX auction_block_opt_ins_league_season_block
    ON public.auction_block_opt_ins USING btree (lid, season_year, block_at);

GRANT SELECT ON TABLE public.auction_block_opt_ins TO league_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auction_block_opt_ins TO league_writer;
GRANT USAGE, SELECT ON SEQUENCE public.auction_block_opt_ins_opt_in_id_seq TO league_writer;
