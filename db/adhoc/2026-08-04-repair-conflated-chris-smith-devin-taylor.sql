-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Repair two conflated player rows — rows that merge two different people who
-- share a name. Each field is individually plausible, so the defect is only
-- visible when independent fields are asked which era the person belongs to.
--
-- The transaction is required here: the gamelog re-point deletes rows before
-- updating others onto the same primary key, so a partial apply would lose data.
-- No non-blocking index build is needed.
--
-- DEVI-TAYL-016049 is natively the 2013 South Carolina Devin Taylor:
--   gsis_player_id 00-0030079 has play stats spanning 2013-2017
--   gsis_it_player_id 40080 has snaps spanning 2016-2017
--   nfl_player_id 2539304 is a 2013-cohort value
--   draft_round 4 / draft_overall_pick 132 is his real draft position
-- Only nfl_draft_year (2022) and college (Bowling Green State) are foreign.
-- Independently confirmed by thread 2500a146 (identifier-hygiene-followup).
--
-- CHRI-SMIT-007265 is natively the 2014 Arkansas Chris Smith:
--   gsis_player_id 00-0031264 has play stats spanning 2014-2021
--   esb_player_id SMI143477 and nfl_player_id 2543692 are 2014-cohort values
--   draft_round 5 / draft_overall_pick 159 is his real draft position
--   player_changelog records sleeper overwriting nfl_draft_year 2014 -> 2023
--     on 2025-09-09T21:40:07Z
-- The 2023 Notre Dame biography is the intruder, and that person ALREADY has
-- their own row (CHRI-SMIT-000226, gsis_player_id 00-0038661, plays 2023-2025).
-- date_of_birth is set to the table's unknown sentinel rather than guessed:
-- 1999-12-15 belongs to the Notre Dame player and there is no source for the
-- Arkansas player's real birth date.

BEGIN;

-- 1. Devin Taylor: restore the biography the overwrite replaced.
UPDATE player
SET nfl_draft_year = 2013,
    college = 'South Carolina'
WHERE pid = 'DEVI-TAYL-016049'
  AND nfl_draft_year = 2022
  AND gsis_player_id = '00-0030079';

-- 2. Chris Smith: restore the 2014 biography and release the intruder's
--    gsis_it_player_id. Nulled before it is claimed below, because the column
--    carries a unique index.
UPDATE player
SET nfl_draft_year = 2014,
    college = 'Arkansas',
    date_of_birth = '0000-00-00',
    gsis_it_player_id = NULL
WHERE pid = 'CHRI-SMIT-007265'
  AND nfl_draft_year = 2023
  AND gsis_player_id = '00-0031264';

-- 3. Give gsis_it_player_id 56351 to the person whose snaps it indexes
--    (2023-2025, matching CHRI-SMIT-000226's own play stats).
UPDATE player
SET gsis_it_player_id = 56351
WHERE pid = 'CHRI-SMIT-000226'
  AND gsis_it_player_id IS NULL;

-- 4. Re-point the gamelogs that followed the stolen gsis_it_player_id.
--    Three games already have a row on the correct pid, but those copies carry
--    no snap counts while the misattributed ones do — so drop the empty copies
--    and move the richer rows rather than the reverse.
DELETE FROM player_gamelogs
WHERE pid = 'CHRI-SMIT-000226'
  AND esbid IN (2024090812, 2024110310, 2025010505);

UPDATE player_gamelogs
SET pid = 'CHRI-SMIT-000226'
WHERE pid = 'CHRI-SMIT-007265'
  AND season_year >= 2024;

-- 5. Drop the seasonlog the misattribution produced. It reads career_year 9,
--    which belongs to the Arkansas player's timeline rather than the Notre Dame
--    player's. Regenerate for CHRI-SMIT-000226 afterwards; seasonlogs are
--    derived from the gamelogs now re-pointed above.
DELETE FROM player_seasonlogs
WHERE pid = 'CHRI-SMIT-007265'
  AND season_year >= 2024;

COMMIT;
