-- STATUS: APPLIED 2026-09-04 against league_production
--
-- Applied by hand rather than through `yarn db:exec`, and it has to be: the
-- wrapper runs --single-transaction, and CREATE INDEX CONCURRENTLY cannot run
-- inside a transaction block. So the banner above was written by hand too,
-- rather than rewritten in place by the script on success. Any future
-- CONCURRENTLY file is in the same position.
--
-- Add market_type to the index every betting-market data-view column joins through.
--
-- `idx_prop_markets_index_esbid_time_type` covers (esbid, time_type) only, so a
-- column asking for one market on one game matched every market on that game and
-- discarded the rest on the heap. Measured on 2024 REG week 18: the two-column
-- predicate matches 18,683 rows where adding market_type gives 387 -- a 48x
-- over-fetch, and each betting-market column in a view pays it independently.
--
-- The 181-column "2024 Weekly Game Props" view (slow_query signature
-- 78cb8914bed0) is 180 such columns, so it paid that over-fetch 180 times:
-- 1,197,670 shared buffer hits, roughly 9.4 GB of buffer traffic, to return 500
-- rows. With market_type in the index the same statement reads 2,089 buffers and
-- execution falls from 1,988ms to 774ms on an idle host. The buffer collapse is
-- the load-bearing half -- it is what keeps the shape off the 5s objective when
-- the host is contended, which is when every one of its signals was emitted.
--
-- CONCURRENTLY because this ran against production with a live auction. It is
-- additive and planner-chosen, so results are unchanged by construction.
--
-- Note `idx_prop_markets_index_esbid_time_type` is now a strict prefix of this
-- index and is therefore redundant. It is deliberately NOT dropped here: the
-- drop needs a brief ACCESS EXCLUSIVE lock and League 1's auction runs until
-- 2026-09-08. Drop it after that window.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prop_markets_index_esbid_time_type_market_type
  ON public.prop_markets_index USING btree (esbid, time_type, market_type)
  WHERE esbid IS NOT NULL;
