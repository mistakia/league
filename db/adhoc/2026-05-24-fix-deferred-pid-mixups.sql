-- Deferred player-ID reconciliations following the Frank Gore-style hijack
-- cleanup. Phase A: pure backfills + gamelog drift. No pid renames here.
-- Pid renames (Brian Price, Tillman, Pharms, Anthony Johnson stub) defer to
-- a JS-driven follow-up using libs-server/update-player-id.mjs, which
-- auto-enumerates all 848 pid-bearing columns rather than relying on a
-- hand-maintained allow-list.
--
-- Authoritative external lookups verified via Sleeper + nflverse players.csv:
--   gsis 00-0032649 pff 11157  Brian Price (UTSA DI, b. 1994-06-24, rookie 2016)
--   gsis 00-0027650 pff 5560   Brian Price (UCLA DT, b. 1989-04-10, drafted 2010)
--   gsis 00-0040365 pff 123429 Daryl Porter Jr. (Miami CB, b. 2002-02-03, BUF, rookie 2025)
--   gsis 00-0038907 pff 55628  Anthony Johnson (Virginia CB, b. 1999-06-12, rookie 2023)
--   gsis 00-0038411 pff 76736  Anthony Johnson Jr. (Iowa State S, b. 1999-12-02) [canonical]
--   gsis 00-0039433 pff 97937  Marcus Harris (Auburn DT, b. 2000-09-27, KC, rookie 2024)
--   gsis 00-0039483 pff 106073 Isaiah Johnson (Syracuse CB, b. 2000-03-29, MIA, rookie 2024)
--   gsis 00-0037799 pff 156124 Dondrea Tillman (Indiana PA DL, b. 1998-04-30, DEN)
--   gsis 00-0037711 pff 156117 Jeremiah Pharms Jr. (Friends DT, b. 1996-10-16, NE)
--
-- Note: Sleeper's DOB for the Virginia Anthony Johnson (sleeper_id 11112,
-- dob 2000-02-04) disagrees with nflverse (1999-06-12). Trusting nflverse
-- because that DOB pairs with the authoritative gsisid 00-0038907. We do
-- NOT attach sleeper_id 11112 here to avoid binding a possibly-distinct
-- record; a later sleeper import can match by gsisid once that lands.

-- ============================================================================
-- 1. Anthony Johnson 2023 stub (Virginia CB, different person from canonical
--    Iowa State Jr safety on ANTH-JOHN-2023-1999-12-02).
-- ============================================================================
UPDATE player
   SET dob='1999-06-12',
       pff_id=55628,
       espn_id=4240077,
       col=COALESCE(NULLIF(col, ''), 'Virginia')
 WHERE pid='ANTH-JOHN-2023-0000-00-00'
   AND dob='0000-00-00';

-- ============================================================================
-- 2. Marcus Harris 2024 DT KC stub (Auburn; third distinct Marcus Harris,
--    separate from 2011 WR Murray State and 2025 Cal CB).
-- ============================================================================
UPDATE player
   SET dob='2000-09-27',
       gsisid='00-0039433',
       pff_id=97937,
       col=COALESCE(NULLIF(col, ''), 'Auburn')
 WHERE pid='MARC-HARR-2024-0000-00-00'
   AND dob='0000-00-00';

-- ============================================================================
-- 3. Isaiah Johnson 2024 Syracuse CB stub (already owns pff_id 106073 from
--    last session; backfill DOB, sleeper, gsisid, current team).
--    Precondition: sleeper_id 12124 is currently mis-attached to the Sr
--    Georgia Tech pid ISAI-JOHN-2015-1992-05-16 (its real sleeper_id is 2640,
--    but a Sleeper name-fallback hijack put 12124 there). Clear it from the
--    Sr first so the unique constraint on sleeper_id doesn't fire when we
--    set it on the Jr stub. The Sr's correct sleeper_id (2640) is left to
--    the next Sleeper import to repopulate via gsisid match.
-- ============================================================================
UPDATE player SET sleeper_id=NULL
 WHERE pid='ISAI-JOHN-2015-1992-05-16' AND sleeper_id='12124';

UPDATE player
   SET dob='2000-03-29',
       sleeper_id='12124',
       gsisid='00-0039483',
       current_nfl_team='MIA',
       col=COALESCE(NULLIF(col, ''), 'Syracuse')
 WHERE pid='ISAI-JOHN-2024-0000-00-00'
   AND dob='0000-00-00';

-- ============================================================================
-- 4. Jeremiah Pharms Jr. DOB backfill (pid stays JERE-PHAR-2020-0000-00-00
--    for now; rename deferred to JS pass).
-- ============================================================================
UPDATE player SET dob='1996-10-16'
 WHERE pid='JERE-PHAR-2020-0000-00-00' AND dob='0000-00-00';

-- ============================================================================
-- 5. Brian Price (UCLA) pff_id backfill -- never set; otherwise would be a
--    future hijack risk should PFF ever re-emit historical seasons.
-- ============================================================================
UPDATE player SET pff_id=5560
 WHERE pid='BRIA-PRIC-2010-1989-04-10' AND pff_id IS NULL;

-- ============================================================================
-- 6. Downstream gamelog drift -- Sam Williams Jr / Isaiah Johnson Jr rows
--    landed on Sr pids. (pid, esbid) is the PK on player_gamelogs, so
--    duplicates get deleted and uniques get repointed.
-- ============================================================================

-- ISAI-JOHN: both 2025 esbids already exist on Jr pid -> Sr rows are duplicates
DELETE FROM player_gamelogs
 WHERE pid='ISAI-JOHN-2015-1992-05-16' AND esbid IN (2025103000, 2025121500);

-- SAMX-WILL: 5 esbids collide on Jr pid (delete dupes), 2 do not (repoint)
DELETE FROM player_gamelogs
 WHERE pid='SAMX-WILL-2003-1980-07-28'
   AND esbid IN (2023010811, 2023122410, 2023123000, 2024010707, 2024011401);

UPDATE player_gamelogs SET pid='SAMU-WILL-2022-1999-03-31'
 WHERE pid='SAMX-WILL-2003-1980-07-28'
   AND esbid IN (2023011600, 2023012201);

-- ============================================================================
-- 7. Sanity checks
-- ============================================================================
DO $$
DECLARE n bigint;
BEGIN
  -- All four backfills landed
  SELECT COUNT(*) INTO n FROM player
   WHERE pid IN ('ANTH-JOHN-2023-0000-00-00','MARC-HARR-2024-0000-00-00',
                 'ISAI-JOHN-2024-0000-00-00','JERE-PHAR-2020-0000-00-00')
     AND dob='0000-00-00';
  IF n > 0 THEN RAISE EXCEPTION 'expected 0 stub DOBs remaining, got %', n; END IF;

  -- UCLA Brian Price now owns pff_id 5560
  SELECT COUNT(*) INTO n FROM player WHERE pid='BRIA-PRIC-2010-1989-04-10' AND pff_id=5560;
  IF n <> 1 THEN RAISE EXCEPTION 'UCLA Brian Price pff_id not set'; END IF;

  -- Drifted gamelog rows are gone from Sr pids
  SELECT COUNT(*) INTO n FROM player_gamelogs
   WHERE (pid='ISAI-JOHN-2015-1992-05-16' AND esbid IN (2025103000, 2025121500))
      OR (pid='SAMX-WILL-2003-1980-07-28' AND esbid IN (
            2023010811, 2023122410, 2023123000, 2024010707, 2024011401,
            2023011600, 2023012201));
  IF n <> 0 THEN RAISE EXCEPTION 'drifted gamelogs not fully resolved: %', n; END IF;
END $$;
