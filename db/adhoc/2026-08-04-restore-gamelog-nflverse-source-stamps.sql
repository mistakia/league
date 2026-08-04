-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Restore the `nflverse-weekly-rosters` provenance stamp that the two era-
-- falsifier gamelog restores dropped. 154 rows across 7 players.
--
-- WHAT WENT WRONG. Both restores replayed
-- scratch/repair-name-match-misattribution/gamelogs-residue-before.json but
-- wrote `source` as NULL rather than the backup value, each citing the same
-- reasoning: the backup's `source` was the column DEFAULT
-- ('nfl-pro-gameday-roster') that
-- db/adhoc/2026-08-04-drop-gamelog-source-default-and-delete-prenatal-rows.sql
-- established was never a writer stamp, so NULL was the honest record.
--
-- That reasoning is correct, but it does not describe every row it was applied
-- to. The backup carries TWO source values, not one: 1,343 of its 1,560 rows
-- read 'nfl-pro-gameday-roster' (the default, correctly NULLed) and 217 read
-- 'nflverse-weekly-rosters' -- an explicit stamp written by
-- scripts/import-nflverse-weekly-rosters.mjs, which is one of the three writers
-- that default-drop file lists as naming itself. It was never a default and it
-- names a real writer.
--
-- 154 of those 217 rows were restored to their own pid and now read NULL:
--
--   db/adhoc/2026-08-04-restore-conflated-player-gamelogs.sql  (38dfc4c32) 120
--   db/adhoc/2026-08-04-restore-final-era-falsifier-gamelog-residue.sql
--                                                              (2f8a4fe52)  34
--
-- The other 63 of the 217 are in rows that stay deleted and are not addressed
-- here. Verified 2026-08-04 before this file: all 154 currently read NULL, none
-- already reads 'nflverse-weekly-rosters', and none reads some third value, so
-- no concurrent writer has restamped them and nothing here overwrites a value
-- a later writer chose.
--
-- WHY IT MATTERS ENOUGH TO FIX. The default-drop file's own rule is "existing
-- values are left alone -- they cannot be re-derived". These 154 stamps are
-- exactly that: unrecoverable except from the backup, and the backup is
-- gitignored, single-machine, and under an open retention decision
-- (user:continuation/preserve-name-match-repair-restore-path.md). If that
-- directory is retired before this runs, the stamps are gone for good.
--
-- NOT ADDRESSED HERE: the 6 rows of 2f8a4fe52's 40, and the 168 of the earlier
-- restore's, whose backup source is 'nfl-pro-gameday-roster'. Those stay NULL
-- -- that value WAS the default and NULL remains the honest record for them.
--
-- Scoped by (pid, esbid) with an explicit `source IS NULL` guard so a rerun or
-- a concurrent restamp is a no-op rather than an overwrite.
--
-- Expected: 154 rows affected.
--
-- Revert: UPDATE player_gamelogs SET source = NULL WHERE the same (pid, esbid)
--   pairs listed below.

BEGIN;

-- CHRI-SMIT-007265: 41 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'CHRI-SMIT-007265' AND source IS NULL AND esbid IN (2014090707,2014102603,2014110903,2014113004,2014121401,2014122803,2015092706,2015100404,2015101104,2015101807,2015102500,2015110805,2015111506,2015111900,2015120604,2015122003,2015122700,2016010304,2016091103,2016091812,2016092504,2016101601,2016102303,2016110603,2016111302,2016112003,2016112702,2016121105,2016121804,2016122405,2017010103,2017100800,2017102208,2017123101,2019090801,2019100700,2019101302,2019102711,2019110309,2019111002,2019120110);

-- DEVI-TAYL-016049: 15 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'DEVI-TAYL-016049' AND source IS NULL AND esbid IN (2013090804,2013091509,2013092209,2013111707,2013112402,2014092103,2014101205,2014101903,2014112306,2014112700,2014122101,2015092007,2015101108,2015111501,2015112201);

-- JOHN-LOVE-025414: 16 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'JOHN-LOVE-025414' AND source IS NULL AND esbid IN (2019090802,2019091510,2019092204,2019092903,2019100612,2019101304,2019101700,2019102712,2019110303,2019111007,2019111800,2019120105,2019120811,2019121504,2019122214,2019122908);

-- JORD-WILL-021812: 32 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'JORD-WILL-021812' AND source IS NULL AND esbid IN (2018090907,2018091613,2018092303,2018093011,2018100701,2018101100,2018102200,2018102806,2018111200,2018111805,2018112506,2018120207,2018120908,2018121608,2018122300,2018123008,2019090801,2019091508,2019091900,2019092900,2019100608,2019101309,2019102008,2019102708,2019110302,2019111007,2019112408,2019120103,2019120812,2019121507,2019122210,2019122906);

-- MARK-MART-016413: 18 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'MARK-MART-016413' AND source IS NULL AND esbid IN (2002122203,2002122901,2003090713,2003091407,2003092110,2003092804,2003100504,2003101201,2003101904,2003102604,2003110903,2003111602,2003112314,2003120100,2003120702,2003121407,2003122103,2003122807);

-- MAUR-ALEX-020348: 31 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'MAUR-ALEX-020348' AND source IS NULL AND esbid IN (2014090709,2014091409,2014092109,2014100507,2014101300,2014101907,2014102604,2014110207,2014110908,2014113007,2014121100,2014122108,2015091301,2015092705,2015100410,2015101107,2015102501,2016121500,2016122409,2017100808,2018121609,2019091506,2019110301,2019111002,2019111704,2019112401,2019112801,2019120801,2019121506,2019122101,2019122901);

-- MIKE-ROSE-003617: 1 rows
UPDATE player_gamelogs SET source = 'nflverse-weekly-rosters'
 WHERE pid = 'MIKE-ROSE-003617' AND source IS NULL AND esbid IN (2016091110);

COMMIT;
