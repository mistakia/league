-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Repair nine conflated player rows — rows that merge two different people who
-- share a name. Each field is individually plausible, so the defect is only
-- visible when independent fields are asked which era the person belongs to.
-- Follows db/adhoc/2026-08-04-repair-conflated-chris-smith-devin-taylor.sql.
--
-- The transaction is required here: the gamelog re-points delete rows before
-- updating others onto the same primary key, so a partial apply would lose data.
-- No non-blocking index build is needed.
--
-- Backup of every row this file touches (11 player, 482 player_gamelogs,
-- 67 player_seasonlogs) is at
-- scratch/repair-conflated-player-identity/2026-08-04-conflation-batch2-backup.json
--
-- Every date_of_birth this file releases is set to the table's unknown sentinel
-- rather than guessed. In each case the value being released is already stored,
-- correctly, on the row of the person it belongs to.
--
-- ===========================================================================
-- SECTION 1 — three rows carrying a second person's CAREER (gamelogs move)
-- ===========================================================================
--
-- MAUR-ALEX-020348 is natively the 2014 Rams safety:
--   gsis_player_id 00-0031393 is a 2014-cohort value
--   date_of_birth 1991-02-16 and nfl_draft_year 2014 agree with it
--   gamelogs 2014-2019 (LA/SEA/BUF) are his career
-- The intruder is the 2022 Detroit receiver, who ALREADY has his own row
-- (MAUR-ALEX-000212, gsis_player_id 00-0037708, date_of_birth 1997-01-10):
--   gsis_it_player_id 54428 indexes snaps spanning 2022-2025 only
--   college 'Florida International' is the receiver's, not the safety's
--   gamelogs 2022-2025 (DET/CHI) are the receiver's career
-- The safety's own college is NOT set here. MAUR-ALEX-008600 carries
-- 'Utah State' against nfl_draft_year 2014, which is corroboration rather than
-- a source, so the column is released to NULL instead of guessed.
--
-- BENN-SAPP-027306 is natively the 2023 Northern Iowa Benny Sapp III:
--   gsis_player_id 00-0038470 and gsis_it_player_id 56225 are 2023-cohort
--   gsis_it_player_id 56225 indexes 131 snaps, all in 2023
--   college 'Northern Iowa' is his
-- The intruder is the 2004 Benny Sapp, who ALREADY has his own row — under a
-- different formatted_name, which is why a same-name sweep does not find him:
--   BENJ-SAPP-001764, formatted_name 'benjamin sapp',
--   gsis_player_id 00-0022352, nfl_draft_year 2004, date_of_birth 1981-01-20
--   gamelogs 2004-2011 (KC/MIN/MIA) are his career
--
-- SEAN-RYAN-027249 is natively the 2023 Rutgers Sean Ryan:
--   gsis_player_id 00-0038455 and gsis_it_player_id 56206 are 2023-cohort
--   gsis_it_player_id 56206 indexes 63 snaps, all in 2023
--   college 'Rutgers' is his
-- The intruder is the 2004 Sean Ryan, who ALREADY has his own row
-- (SEAN-RYAN-001783, gsis_player_id 00-0022817, nfl_draft_year 2004,
-- date_of_birth 1980-03-27); gamelogs 2004-2010 are his career.
--
-- Collision policy on the re-points, measured per row rather than assumed. The
-- comparison counts snaps plus counting stats on both copies:
--   MAUR-ALEX  2 collisions, source richer on both (snaps 8 and 3 against 0)
--              -> drop the empty target copies, move all 18 rows
--   SEAN-RYAN 15 collisions, source richer on 10, tied on 5, target richer on 0
--              -> drop the target copies, move all 39 rows
--   BENN-SAPP 56 collisions, ALL tied on participation, and the target copies
--              carry started=true on 10 where the source carries false
--              -> keep the target copies, drop the 56 source duplicates, and
--                 move only the 67 rows the target does not already have
-- The Sean Ryan drop loses one started=true flag on esbid 2007102108; that copy
-- is otherwise empty while the copy retained carries the game's counting stats.
--
-- ===========================================================================
-- SECTION 2 — six rows carrying a second person's BIOGRAPHY only
-- ===========================================================================
--
-- These rows' identifiers, gamelogs and snaps are internally consistent. A
-- single biography field belongs to a different person and is released. No
-- gamelog moves.
--
--   LEVI-JONE-015466  date_of_birth 1979-08-24 belongs to the 2002 Levi Jones,
--                     stored already on LEVI-JONE-001432. This row's own
--                     identifiers, gamelogs and snaps are all 2022-2025.
--   JEFF-FIEL-021440  nfl_draft_year 1991 belongs to JEFF-FIEL-012681
--                     (date_of_birth 1967-07-03). This row is the 2008 player:
--                     date_of_birth 1985-10-05, gamelogs 2008-2009.
--   JONA-HARR-010436  nfl_draft_year 1997 belongs to JONA-HARR-010584
--                     (date_of_birth 1974-06-09). This row is the 2008/2009
--                     player: date_of_birth 1986-05-06, gamelogs 2009.
--   SHAW-JOHN-013688  nfl_draft_year 2004 belongs to SHAW-JOHN-023779
--                     (date_of_birth 1980-03-24). This row is the 2010 player:
--                     date_of_birth 1988-02-06, gamelogs 2010-2011.
--   SHAN-ANDR-023769  nfl_draft_year 2000 is impossible against date_of_birth
--                     1980-10-02 (age 19) and against gamelogs 2006-2010. No
--                     same-name sibling holds it; it is released, not moved.
-- Each is released to NULL rather than replaced. player_could_have_played reads
-- date_of_birth first and consults nfl_draft_year only in its absence, and all
-- five rows carry a usable date_of_birth, so the falsifier is unaffected.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Maurice Alexander — release the receiver's college and snap identifier.
--    gsis_it_player_id is nulled before it is claimed below, because the
--    column carries a unique index.
-- ---------------------------------------------------------------------------
UPDATE player
SET college = NULL,
    gsis_it_player_id = NULL
WHERE pid = 'MAUR-ALEX-020348'
  AND gsis_player_id = '00-0031393'
  AND gsis_it_player_id = 54428;

UPDATE player
SET college = 'Florida International',
    gsis_it_player_id = 54428
WHERE pid = 'MAUR-ALEX-000212'
  AND gsis_player_id = '00-0037708'
  AND gsis_it_player_id IS NULL;

-- Drop the two empty copies the correct pid already holds, then move all 18.
DELETE FROM player_gamelogs
WHERE pid = 'MAUR-ALEX-000212'
  AND esbid IN (2024112800, 2024120500);

UPDATE player_gamelogs
SET pid = 'MAUR-ALEX-000212'
WHERE pid = 'MAUR-ALEX-020348'
  AND season_year >= 2022;

-- The receiver's seasonlogs read career_year 7-9, which belongs to the safety's
-- timeline. Drop rather than move; seasonlogs are derived from the gamelogs.
DELETE FROM player_seasonlogs
WHERE pid = 'MAUR-ALEX-020348'
  AND season_year >= 2022;

-- ---------------------------------------------------------------------------
-- 2. Benny Sapp — release the elder's date_of_birth, drop the 56 duplicate
--    gamelogs, and move the 67 the elder's row does not already hold.
-- ---------------------------------------------------------------------------
UPDATE player
SET date_of_birth = '0000-00-00'
WHERE pid = 'BENN-SAPP-027306'
  AND gsis_player_id = '00-0038470'
  AND date_of_birth = '1981-01-20';

DELETE FROM player_gamelogs src
WHERE src.pid = 'BENN-SAPP-027306'
  AND src.season_year BETWEEN 2004 AND 2011
  AND EXISTS (
    SELECT 1 FROM player_gamelogs tgt
    WHERE tgt.pid = 'BENJ-SAPP-001764'
      AND tgt.esbid = src.esbid
      AND tgt.season_year = src.season_year
  );

UPDATE player_gamelogs
SET pid = 'BENJ-SAPP-001764'
WHERE pid = 'BENN-SAPP-027306'
  AND season_year BETWEEN 2004 AND 2011;

-- The 2004-2011 seasonlogs read career_year 1-8, which is correct for the
-- elder's own timeline, so they move rather than being dropped. BENJ-SAPP-001764
-- holds none, so there is nothing to collide with.
UPDATE player_seasonlogs
SET pid = 'BENJ-SAPP-001764'
WHERE pid = 'BENN-SAPP-027306'
  AND season_year BETWEEN 2004 AND 2011;

-- What remains on BENN-SAPP-027306 reads career_year 9-10 for 2023-2024, which
-- counts the elder's seasons against a 2023 rookie. Drop it.
DELETE FROM player_seasonlogs
WHERE pid = 'BENN-SAPP-027306'
  AND season_year >= 2023;

-- ---------------------------------------------------------------------------
-- 3. Sean Ryan — release the elder's date_of_birth, drop the 15 emptier target
--    copies, and move all 39 of the elder's gamelogs.
-- ---------------------------------------------------------------------------
UPDATE player
SET date_of_birth = '0000-00-00'
WHERE pid = 'SEAN-RYAN-027249'
  AND gsis_player_id = '00-0038455'
  AND date_of_birth = '1980-03-27';

DELETE FROM player_gamelogs tgt
WHERE tgt.pid = 'SEAN-RYAN-001783'
  AND EXISTS (
    SELECT 1 FROM player_gamelogs src
    WHERE src.pid = 'SEAN-RYAN-027249'
      AND src.season_year BETWEEN 2004 AND 2010
      AND src.esbid = tgt.esbid
      AND src.season_year = tgt.season_year
  );

UPDATE player_gamelogs
SET pid = 'SEAN-RYAN-001783'
WHERE pid = 'SEAN-RYAN-027249'
  AND season_year BETWEEN 2004 AND 2010;

-- career_year 1-6 across 2004-2010 is correct for the elder's timeline.
UPDATE player_seasonlogs
SET pid = 'SEAN-RYAN-001783'
WHERE pid = 'SEAN-RYAN-027249'
  AND season_year BETWEEN 2004 AND 2010;

DELETE FROM player_seasonlogs
WHERE pid = 'SEAN-RYAN-027249'
  AND season_year >= 2023;

-- ---------------------------------------------------------------------------
-- 4. Levi Jones — release the 2002 player's date_of_birth.
-- ---------------------------------------------------------------------------
UPDATE player
SET date_of_birth = '0000-00-00'
WHERE pid = 'LEVI-JONE-015466'
  AND gsis_player_id = '00-0037153'
  AND date_of_birth = '1979-08-24';

-- ---------------------------------------------------------------------------
-- 5. Four rows holding another person's nfl_draft_year.
-- ---------------------------------------------------------------------------
UPDATE player
SET nfl_draft_year = NULL
WHERE pid = 'JEFF-FIEL-021440'
  AND gsis_player_id = '00-0025959'
  AND nfl_draft_year = 1991;

UPDATE player
SET nfl_draft_year = NULL
WHERE pid = 'JONA-HARR-010436'
  AND gsis_player_id = '00-0026785'
  AND nfl_draft_year = 1997;

UPDATE player
SET nfl_draft_year = NULL
WHERE pid = 'SHAW-JOHN-013688'
  AND gsis_player_id = '00-0027328'
  AND nfl_draft_year = 2004;

UPDATE player
SET nfl_draft_year = NULL
WHERE pid = 'SHAN-ANDR-023769'
  AND gsis_player_id = '00-0023728'
  AND nfl_draft_year = 2000;

COMMIT;
