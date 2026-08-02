-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Second half of the contract: drop the four bid columns superseded by
-- `restricted_free_agency_nominations` and by `outcome`.
--
-- `player_tid`, `nominated` and `announced` described the AUCTION, not the bid,
-- and were duplicated onto every bid row. `announced` was populated on exactly
-- one of them, which is how a competing bid's null coerced to epoch 0 and came
-- due the instant it was submitted. `player_tid` had already drifted: two of the
-- 166 historical auctions carried disagreeing values across their own bids.
--
-- `reason` held free text -- two hardcoded sentences plus `error.message` -- so
-- 262 of 280 losing bids read the same line about three different outcomes.
-- `outcome` replaced it with a closed set and the history was reclassified from
-- each auction's resolved state.
--
-- Safe to run only because the consumer sweep is DEPLOYED: both `league` and
-- `digitalocean-0` are at 6c2c9ab63, verified by git rev-parse on each host, and
-- the deployed tree was grepped for every one of these four names. That grep is
-- what caught the last three consumers -- two of them reached `player_tid`
-- through `get_restricted_free_agency_signings`, which selects `*`, so they
-- never named the table and no table-anchored search could reach them.

ALTER TABLE public.restricted_free_agency_bids
  DROP COLUMN player_tid,
  DROP COLUMN nominated,
  DROP COLUMN announced,
  DROP COLUMN reason;
