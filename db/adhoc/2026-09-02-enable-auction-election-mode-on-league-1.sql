-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Turn the 2026 free agency auction on for league 1.
--
-- `is_auction_election_mode_enabled` selects which auction SYSTEM the
-- league-season runs: this design, or the 2021-2025 timer-driven open outcry it
-- rolls back to. FALSE is the designed safe default and it is genuinely inert --
-- the auction starts paused and only election mode clears it, so at period open
-- nothing happens at all. Turning it on is a deliberate second act after the
-- deploy, and this is that act.
--
-- Operator authorized 2026-09-02, with the period opening 2026-09-03T03:59:59Z.
--
-- Verified against production immediately before applying:
--   window        118h available against 38.9h required
--   final block   2026-09-07T12:08:00Z, 832 minutes of live block before the
--                 period end, not held off by notice and not a failed window
--   config        notice 60 min, pace 2 min/spot, buffer 12h
--   board         56 unfilled active spots, 10 block-eligible teams
--
-- It does NOT decide which MODE is in force. `auction-modes.mjs` derives that
-- from the block schedule and the clock, and must never consult this column.

UPDATE seasons
SET is_auction_election_mode_enabled = true
WHERE lid = 1
  AND season_year = 2026;

-- CONTENT ASSERTIONS, not an exit status. Refuse the transaction unless exactly
-- one league-season is enabled and it is the one named above -- a WHERE clause
-- that drifted would otherwise enable the auction on leagues nobody meant to
-- touch, and the update would report success either way.
DO $$
DECLARE
  enabled_count integer;
  target_enabled boolean;
BEGIN
  SELECT count(*) INTO enabled_count
  FROM seasons
  WHERE season_year = 2026 AND is_auction_election_mode_enabled;

  SELECT is_auction_election_mode_enabled INTO target_enabled
  FROM seasons WHERE lid = 1 AND season_year = 2026;

  IF target_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'league 1 2026 was not enabled';
  END IF;

  -- League 1 and the auction mirror 119, and nothing else.
  IF enabled_count <> 2 THEN
    RAISE EXCEPTION
      'expected exactly 2 enabled league-seasons in 2026 (league 1 and mirror 119), found %',
      enabled_count;
  END IF;
END $$;
