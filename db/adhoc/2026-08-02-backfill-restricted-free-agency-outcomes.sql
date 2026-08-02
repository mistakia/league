-- STATUS: APPLIED 2026-08-02 against league_production
--
-- Assign an `outcome` code to every settled restricted free agency bid from
-- 2021 through 2025, so all six seasons read through the vocabulary in
-- `libs-shared/constants/restricted-free-agency-constants.mjs` rather than
-- through the free text the processing script used to write.
--
-- Best effort, and the limit is worth stating: 262 of the 280 losing bids carry
-- the blanket sentence `player no longer a restricted free agent`, which records
-- nothing about WHY that particular bid lost. The classification below recovers
-- it from the auction's resolved state -- who won, for how much, and whether the
-- winner held the player's rights -- which is the same derivation the live path
-- now performs in `libs-server/classify-restricted-free-agency-bid-outcome.mjs`.
-- The CASE arms are ordered to mirror that function so the two cannot drift.
--
-- What is NOT recoverable: the waiver order in force at processing time.
-- `teams.waiver_order` is a mutable current-season column, so a historical
-- `lost_tiebreak` can be identified but the ordering behind it cannot be shown.
-- The history view states the classification and does not invent the margin.
--
-- The four legacy strings are mapped ahead of the derivation because they record
-- a bid that failed on its OWN terms while it was the winning candidate, not one
-- that lost the auction. `player has tied winning bids` is the clearest case: its
-- two rows (CHRI-GODW-016044, 2022) are both bids of 5 that both failed, leaving
-- that auction with no winner at all, so deriving from the winning bid would
-- have degraded them to `player_ineligible` and lost the fact that they tied.

WITH auction AS (
  SELECT
    nominations.nomination_id,
    nominations.original_team_id,
    winning_bid.uid AS winning_bid_id,
    winning_bid.tid AS winning_team_id,
    winning_bid.bid AS winning_amount
  FROM public.restricted_free_agency_nominations AS nominations
  LEFT JOIN public.restricted_free_agency_bids AS winning_bid
    ON winning_bid.uid = nominations.winning_bid_id
)
UPDATE public.restricted_free_agency_bids AS bids
SET outcome = CASE
  WHEN bids.succ IS TRUE THEN 'won'
  WHEN bids.reason = 'exceeds roster limits' THEN 'roster_limit_violation'
  WHEN bids.reason = 'player no longer on original team roster'
    THEN 'player_ineligible'
  WHEN bids.reason = 'player has tied winning bids' THEN 'lost_tiebreak'
  WHEN auction.winning_bid_id IS NULL THEN 'player_ineligible'
  WHEN auction.winning_team_id = auction.original_team_id THEN 'matched'
  WHEN COALESCE(bids.bid, 0) < COALESCE(auction.winning_amount, 0)
    THEN 'outbid'
  WHEN COALESCE(bids.bid, 0) = COALESCE(auction.winning_amount, 0)
    THEN 'lost_tiebreak'
  ELSE 'player_ineligible'
END
FROM auction
WHERE auction.nomination_id = bids.nomination_id
  AND bids.processed IS NOT NULL
  AND bids.cancelled IS NULL;

-- Cancelled and still-live bids keep a null outcome: a withdrawn bid never
-- settled and has no outcome to report, and the history view excludes both.
