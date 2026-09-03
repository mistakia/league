-- STATUS: APPLIED 2026-09-03 against league_production
--
-- Raw vendor payload capture for prop market imports, so a FUTURE improvement
-- to normalization can be backfilled onto history without re-fetching from the
-- vendor.
--
-- The need is concrete rather than speculative. BetMGM's fixture matching has
-- now failed twice on payloads nobody kept -- once on an " at " / " @ "
-- separator change, once on a host-timezone week calculation -- and each time
-- the repair could only be verified against whatever dump a session happened to
-- have saved by hand in a gitignored scratch directory. Several books are also
-- geo-gated or browser-gated, so a re-fetch is not merely slow, it is sometimes
-- impossible: the BetMGM leg needs a Maryland residential egress that exists in
-- exactly one place on this fleet.
--
-- TWO GRAINS, TWO TABLES. The market body carries the market-level fields the
-- derivation actually reads -- BetMGM's DecimalHandicap and attr among them --
-- which a per-selection capture would lose. The event envelope carries the
-- fixture name and start time that fixture matching reads, which do not appear
-- on a market body at all. Neither substitutes for the other and they are keyed
-- differently, so folding them into one table would mean a nullable key column
-- and an event envelope duplicated once per market -- for BetMGM roughly 37
-- times over, at 847 markets across 23 fixtures.
--
-- KEYED TO MATCH prop_markets_history EXACTLY. (source_id, source_market_id,
-- observed_at) is that table's existing unique index, so a raw body joins to
-- the history row it explains with no new identity concept, and the writer can
-- reuse the change detection it already runs -- a raw row is written only when
-- the market changed, not on every poll.
--
-- WHY PER-ROW RATHER THAN A PER-RUN COMPRESSED BLOB. Measured 2026-09-03
-- against a 724-market BetMGM dump: 88% of per-market bodies are under 2 KB,
-- which is below the TOAST threshold, so those rows store uncompressed whatever
-- the column type. Per-row lands near 972 KB where the same markets compressed
-- as a single blob take 98 KB -- roughly 10x. The two designs do not write at
-- the same cadence, though: per-row writes only changed markets while a blob
-- writes everything every run, which puts the break-even near a 10% per-run
-- change rate. Per-row was chosen for the join simplicity and because a backfill
-- against it needs no unpacking step; the storage difference is a few hundred MB
-- a season, which is the cheaper thing to spend.
--
-- jsonb rather than text: key order and insignificant whitespace are not part of
-- the vendor's meaning, and every value the derivation reads is either a string
-- or a number that jsonb preserves exactly -- including the mixed-precision
-- DecimalHandicap strings ("-2.5" and "-2.5000"), which are strings in the
-- payload and so survive verbatim. In exchange the backfill can select rows by
-- payload content instead of parsing every one.
--
-- NOT NULL on raw_payload: a row here exists only to hold a payload, so a null
-- one is a bug rather than a state worth representing.

CREATE TABLE IF NOT EXISTS public.prop_markets_raw_history (
    source_id public.market_source_id NOT NULL,
    source_market_id character varying(255) NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    raw_payload jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prop_markets_raw_history_market
    ON public.prop_markets_raw_history
    USING btree (source_id, source_market_id, observed_at);

COMMENT ON TABLE public.prop_markets_raw_history IS
  'Vendor market body as received, keyed to match prop_markets_history so a raw payload joins to the history row it explains. Written only when the market changed.';

COMMENT ON COLUMN public.prop_markets_raw_history.raw_payload IS
  'The per-market vendor body, unmodified apart from jsonb normalization of key order and whitespace.';

CREATE TABLE IF NOT EXISTS public.prop_market_events_raw_history (
    source_id public.market_source_id NOT NULL,
    source_event_id character varying(255) NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    raw_payload jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prop_market_events_raw_history_event
    ON public.prop_market_events_raw_history
    USING btree (source_id, source_event_id, observed_at);

COMMENT ON TABLE public.prop_market_events_raw_history IS
  'Vendor event envelope as received -- the fixture name and start time that fixture matching reads, which appear on no market body. Keyed to prop_markets_index.source_event_id.';

COMMENT ON COLUMN public.prop_market_events_raw_history.raw_payload IS
  'The per-event vendor body, unmodified apart from jsonb normalization of key order and whitespace.';

GRANT SELECT ON TABLE public.prop_markets_raw_history TO league_reader;
GRANT SELECT ON TABLE public.prop_markets_raw_history TO league_data_view_reader;
GRANT SELECT ON TABLE public.prop_markets_raw_history TO league_contribution_reader;

GRANT SELECT ON TABLE public.prop_market_events_raw_history TO league_reader;
GRANT SELECT ON TABLE public.prop_market_events_raw_history TO league_data_view_reader;
GRANT SELECT ON TABLE public.prop_market_events_raw_history TO league_contribution_reader;
