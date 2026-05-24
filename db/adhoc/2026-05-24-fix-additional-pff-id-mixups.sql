-- Batch fix for additional PFF ID hijacks where a younger relative's PFF rows
-- and pff_id got written onto an older relative's pid.
--
-- Authoritative PFF IDs verified via pff.com URLs:
--   76736  = Anthony Johnson Jr.  (S/CHI, Iowa State, b. 1999-12-02)
--   129584 = Kris Jenkins         (DI/CIN, Michigan, b. 2001-10-10)
--   123429 = Daryl Porter Jr.     (CB/BUF, Miami) -- no canonical Jr pid in DB yet
--   3689   = Jacoby Jones (Sr)    (WR, Texans/Ravens, 2007-2015 career) -- recovered
--   157518 = Jacoby Jones         (WR/WAS, UCF) -- the younger one currently on Sr's pid
--   106073 = Isaiah Johnson       (CB/MIA, Syracuse, b. 2000-03-29)
--   99106  = Sam Williams         (ED/DAL, Ole Miss, b. 1999-03-31)
--   83220  = Chris Smith II       (S/NYJ, Georgia, b. 2000-05-01)
--   97230  = Marcus Harris        (CB/TEN, Cal)
--
-- For each: move PFF seasonlog rows from Sr to canonical Jr pid (delete-then-update
-- pattern to avoid (pid, year) pk collision), then reassign player.pff_id.

-- ============================================================================
-- 1. Anthony Johnson Jr. (Iowa State, S/CHI)
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='ANTH-JOHN-2023-1999-12-02' AND year IN (2023, 2024);
UPDATE pff_player_seasonlogs SET pid='ANTH-JOHN-2023-1999-12-02'
WHERE pid='ANTH-JOHN-1989-1967-06-22' AND year IN (2023, 2024);

UPDATE player SET pff_id=NULL    WHERE pid='ANTH-JOHN-1989-1967-06-22';
UPDATE player SET pff_id=76736   WHERE pid='ANTH-JOHN-2023-1999-12-02';

-- ============================================================================
-- 2. Kris Jenkins (Michigan, DI/CIN) -- Sr was Carolina Panthers DT b. 1979
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='KRIS-JENK-2024-0000-00-00' AND year=2025;
UPDATE pff_player_seasonlogs SET pid='KRIS-JENK-2024-0000-00-00'
WHERE pid='KRIS-JENK-2001-1979-08-03' AND year=2025;

UPDATE player SET pff_id=NULL    WHERE pid='KRIS-JENK-2001-1979-08-03';
UPDATE player SET pff_id=129584  WHERE pid='KRIS-JENK-2024-0000-00-00';

-- ============================================================================
-- 3. Daryl Porter Jr. -- no canonical Jr pid in DB yet; remove the corrupted
--    row and clear Sr's pff_id. Operator creates Jr's pid and re-imports.
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='DARY-PORT-1997-1974-01-16' AND year=2025;
UPDATE player SET pff_id=NULL    WHERE pid='DARY-PORT-1997-1974-01-16';

-- ============================================================================
-- 4. Jacoby Jones (UCF, WR/WAS) -- Sr's real pff_id is 3689 (recovered from
--    historical 2007-2015 seasonlog rows which were correctly attributed).
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='JACO-JONE-2025-2001-07-18' AND year=2025;
UPDATE pff_player_seasonlogs SET pid='JACO-JONE-2025-2001-07-18'
WHERE pid='JACO-JONE-2007-1984-07-11' AND year=2025;

UPDATE player SET pff_id=3689    WHERE pid='JACO-JONE-2007-1984-07-11';
UPDATE player SET pff_id=157518  WHERE pid='JACO-JONE-2025-2001-07-18';

-- ============================================================================
-- 5. Isaiah Johnson (Syracuse, CB/MIA)
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='ISAI-JOHN-2024-0000-00-00' AND year=2025;
UPDATE pff_player_seasonlogs SET pid='ISAI-JOHN-2024-0000-00-00'
WHERE pid='ISAI-JOHN-2015-1992-05-16' AND year=2025;

UPDATE player SET pff_id=NULL    WHERE pid='ISAI-JOHN-2015-1992-05-16';
UPDATE player SET pff_id=106073  WHERE pid='ISAI-JOHN-2024-0000-00-00';

-- ============================================================================
-- 6. Sam Williams (Ole Miss, ED/DAL)
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='SAMU-WILL-2022-1999-03-31' AND year=2025;
UPDATE pff_player_seasonlogs SET pid='SAMU-WILL-2022-1999-03-31'
WHERE pid='SAMX-WILL-2003-1980-07-28' AND year=2025;

UPDATE player SET pff_id=NULL    WHERE pid='SAMX-WILL-2003-1980-07-28';
UPDATE player SET pff_id=99106   WHERE pid='SAMU-WILL-2022-1999-03-31';

-- ============================================================================
-- 7. Chris Smith II (Georgia, S/NYJ)
--    Note: canonical pid CHRI-SMIT-2023-0000-00-00 uses fname="Christopher",
--    but format_player_name strips Jr/II so name lookup works.
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='CHRI-SMIT-2023-0000-00-00' AND year IN (2023, 2024, 2025);
UPDATE pff_player_seasonlogs SET pid='CHRI-SMIT-2023-0000-00-00'
WHERE pid='CHRI-SMIT-2011-1987-06-23' AND year IN (2023, 2024, 2025);

UPDATE player SET pff_id=NULL    WHERE pid='CHRI-SMIT-2011-1987-06-23';
UPDATE player SET pff_id=83220   WHERE pid='CHRI-SMIT-2023-0000-00-00';

-- ============================================================================
-- 8. Marcus Harris (Cal, CB/TEN)
-- ============================================================================
DELETE FROM pff_player_seasonlogs WHERE pid='MARC-HARR-2025-0000-00-00' AND year=2025;
UPDATE pff_player_seasonlogs SET pid='MARC-HARR-2025-0000-00-00'
WHERE pid='MARC-HARR-2011-1989-03-01' AND year=2025;

UPDATE player SET pff_id=NULL    WHERE pid='MARC-HARR-2011-1989-03-01';
UPDATE player SET pff_id=97230   WHERE pid='MARC-HARR-2025-0000-00-00';

-- ============================================================================
-- 9. Reset corrupted current_nfl_team on retired Sr pids where the Jr's team
--    leaked onto the Sr via name-fallback (Sr is retired/INA).
-- ============================================================================
UPDATE player SET current_nfl_team='INA'
WHERE pid IN (
  'MARC-HARR-2011-1989-03-01',   -- Sr WR, retired; TEN is Jr's team
  'SAMX-WILL-2003-1980-07-28'    -- Sr DL, retired; DAL is Jr's team
);
