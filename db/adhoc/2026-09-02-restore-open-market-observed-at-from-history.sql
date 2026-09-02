-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Restore prop_markets_index OPEN rows to their true first-observation
-- timestamp, taken from prop_markets_history.
--
-- Owner: user:task/league/resolve-duplicate-book-event-listings.md
--
-- THE CAUSE, AND IT IS FIXED IN CODE FIRST. libs-server/insert-prop-markets.mjs
-- writes the OPEN index row once, when a market is first seen. When an existing
-- market later changes on a field in MARKET_INDEX_UPDATE_FIELDS -- exactly
-- ['esbid', 'season_year'] -- it pushes an OPEN row again, and observed_at used
-- to sit in MARKET_INDEX_MERGE_COLUMNS, which build_market_index_merge() maps
-- to excluded.observed_at. The OPEN row's timestamp therefore meant "when this
-- market last changed esbid or season_year", not "when it opened". A market
-- first inserted with an unresolved esbid gets that stamp filled in on a later
-- observation, so the timestamp moved to whenever the resolver caught up.
--
-- Run this only AFTER the code fix is deployed. Applied before, the importer
-- re-clobbers the repaired rows on the next esbid resolution and the repair is
-- invisible rather than wrong -- the worst of the two failure modes.
--
-- HOW STARK THE ARTIFACT IS. Lead time before kickoff for OPEN game-line rows
-- (GAME_SPREAD, GAME_TOTAL, GAME_MONEYLINE), 2025 REG, measured 2026-09-02:
--
--            read from prop_markets_index    read from prop_markets_history
--   CAESARS  1.29 days AFTER kickoff         5.54 days BEFORE kickoff
--            87.6 percent post-game          0.4 percent post-game
--   PINNACLE 0.65 days before kickoff        4.00 days before kickoff
--            20.4 percent post-game          1.4 percent post-game
--
-- The first column is an artifact. It is alarming enough to send someone
-- chasing a Caesars ingestion defect that does not exist, which is what it did.
--
-- WHY prop_markets_history IS THE ORACLE. A history row is written on the
-- market's first insert and thereafter only when a MARKET_HISTORY_UPDATE_FIELDS
-- field changes. Nothing rewrites an existing history row's observed_at -- the
-- table's conflict target includes observed_at, so a re-observation at a new
-- instant inserts rather than merges. Its minimum per (source_id,
-- source_market_id) is therefore the true first observation.
--
-- THE REPAIR IS MONOTONE AND THAT IS CHECKED, NOT ASSUMED. Measured over all
-- 1,541,421 OPEN rows: every one has history (zero rows with no history), and
-- ZERO rows have a history minimum LATER than the index timestamp. So this only
-- ever moves a timestamp earlier. 499,720 rows move; the rest already agree.
-- Per source, rows moved and the median distance they move:
--
--   DRAFTKINGS 150,225 of 530,512   2.83 days
--   PINNACLE   201,364 of 390,207   1.68 days
--   PRIZEPICKS 102,908 of 188,697   2.67 days
--   FANDUEL     39,660 of 118,911   2.11 days
--   CAESARS      4,615 of 225,837   6.83 days
--   BETMGM         832 of  29,265  19.95 days
--   BETRIVERS      116 of  52,002  85.41 days
--   FANATICS         0 of   5,990        --
--
-- CLOSE ROWS ARE DELIBERATELY UNTOUCHED. observed_at means opposite things on
-- the two rows. The CLOSE row tracks the market's latest state and last-write-
-- wins is correct for it; only OPEN promises a first observation. A repair that
-- swept both would stall the CLOSE row at the market's opening and break the
-- one column that is supposed to move.

begin;

create temporary table open_market_true_open on commit drop as
select
  h.source_id,
  h.source_market_id,
  min(h.observed_at) as true_open
from prop_markets_history h
group by 1, 2;

create unique index on open_market_true_open (source_id, source_market_id);

analyze open_market_true_open;

-- The strict inequality is the whole safety argument: a row whose history
-- minimum is not earlier than what it already carries is left alone, so the
-- statement cannot move a timestamp forward even if the measurement above
-- stops holding between now and the apply.
update prop_markets_index m
set observed_at = t.true_open
from open_market_true_open t
where m.time_type = 'OPEN'
  and m.source_id = t.source_id
  and m.source_market_id = t.source_market_id
  and t.true_open < m.observed_at;

commit;
