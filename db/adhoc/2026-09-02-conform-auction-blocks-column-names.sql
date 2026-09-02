-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Conform two auction_blocks column names to the schema token vocabulary.
--
-- The schema conformance ratchet flagged both as shorthand, and in both cases
-- the right answer is a better NAME rather than a wider vocabulary -- the
-- vocabulary is a positive list, and a plural near-duplicate of a word already
-- in it is exactly the entry that makes such a list decay.
--
--   ends_at               -> end_at
--     `end` is already the vocabulary's word and is what every other window
--     boundary on this schema uses (free_agency_period_end, week_end). `ends`
--     was a plural of it and nothing more.
--
--   unanimity_denominator -> eligible_team_count
--     Says what the column HOLDS rather than the role it plays in an argument.
--     It is the number of teams that held an open active roster spot when the
--     block finalized, which is the fact a later reader wants; "denominator" is
--     jargon for why that number mattered, and the table comment carries that.
--
-- The table was created the same day and holds no rows outside a test database,
-- so this is a rename rather than a migration.

ALTER TABLE public.auction_blocks RENAME COLUMN ends_at TO end_at;

ALTER TABLE public.auction_blocks
    RENAME COLUMN unanimity_denominator TO eligible_team_count;

ALTER TABLE public.auction_blocks
    RENAME CONSTRAINT auction_blocks_ends_after_start TO auction_blocks_end_after_start;

DROP INDEX IF EXISTS public.auction_blocks_league_season_window;

CREATE INDEX auction_blocks_league_season_window
    ON public.auction_blocks USING btree (lid, season_year, block_at, end_at);
