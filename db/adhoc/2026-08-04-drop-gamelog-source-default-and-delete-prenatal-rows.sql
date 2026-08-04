-- STATUS: APPLIED 2026-08-04 against league_production
--
-- Two repairs to `player_gamelogs`, both following from the same discovery: the
-- `source` column's DEFAULT has been asserting a provenance nobody wrote.
--
-- 1. DROP THE DEFAULT.
--
-- db/adhoc/2026-05-23-add-source-columns.sql created the column as
-- `DEFAULT 'nfl-pro-gameday-roster'` on the stated premise that this was "the
-- live importer that has been writing to each table". For the other three
-- tables in that file that was true. For `player_gamelogs` it was not:
-- scripts/generate-player-gamelogs.mjs writes the same table from play stats
-- and snaps, and did not stamp a `source` of its own until 2026-08-04. So the
-- default did not tag historical rows with their originating importer -- it
-- tagged every row that omitted the column, from any writer, with the gameday
-- roster importer's name.
--
-- The cost was a wrong diagnosis. A 2026-08-04 audit read `source` as
-- provenance and concluded that 262 era-impossible gamelog rows were "a fourth
-- mechanism -- that importer asserting a player was on a gameday roster", and
-- filed it as belonging to a different owner. That importer resolves players
-- solely through `player.gsis_it_player_id`, and 11 of the 19 players carrying
-- those rows have a null `gsis_it_player_id`; it also fetches from an NFL Pro
-- endpoint verified only for 2023-2025, while these rows span 2001-2021. It
-- cannot have written them.
--
-- After this file, an omitted `source` is NULL -- honestly unknown -- rather
-- than a false accusation. Every current writer names itself explicitly:
-- generate-player-gamelogs.mjs ('play-stats'), import-nflverse-weekly-rosters
-- .mjs ('nflverse-weekly-rosters'), and private/scripts/import-gameday-rosters
-- .mjs ('nfl-pro-gameday-roster', added in the same change as this file).
--
-- Existing values are left alone. They cannot be re-derived: the information
-- that would distinguish a pre-stamp play-stats row from a real roster row is
-- exactly what the default destroyed. Dropping it stops the lie going forward,
-- which is the only part still recoverable.
--
-- `player_gamelogs` is partitioned and a column default is stored per relation
-- rather than inherited at read time, so the parent and all 28 partitions each
-- need the drop. The DO block covers whatever partitions exist at apply time
-- rather than hardcoding a list that a new season's partition would fall out
-- of.
--
-- 2. DELETE 138 GAMELOG ROWS NAMING A PLAYER WHO WAS NOT YET BORN.
--
-- The same 262 rows split cleanly on `player.date_of_birth`, which is evidence
-- independent of the draft bookkeeping that flagged them. 138 rows across 5
-- players name a player who would have been under 20 in that season -- one
-- aged 1, one aged 2, one aged 3. Those are deleted here. The other 124 rows
-- name players aged 21 to 25, an ordinary NFL age; for those the wrong field
-- is `player.nfl_draft_year` on a conflated player row, not the gamelog.
--
-- Those 124 are not merely left alone, they are no longer flagged at all:
-- libs-server/player-era.mjs now lets `date_of_birth` DECIDE when it is
-- present and consults `nfl_draft_year` only in its absence. A draft year
-- contradicting a birth date is a contradiction rather than proof, and a
-- reject-only predicate has to pass a contradiction. The 15 players behind
-- those rows are father/son conflations -- `benny sapp` born 1981 on a row
-- reading `nfl_draft_year: 2023`, `tyrone wheatley` born 1972 reading 2021,
-- `kwamie lassiter` born 1969 reading 2022 -- where the draft year is the
-- son's and condemns the father's real career. Under the corrected predicate
-- the whole-table flagged population is exactly the 138 this file deletes,
-- so the oracle reads 0 afterward.
--
-- Every one of the 138 carries zero participation: no counting stat and no
-- snap in any column. The delete therefore removes a false roster assertion
-- and no measurement. The predicate below re-derives the population rather
-- than hardcoding row keys, and the `deleted` count is the assertion -- if it
-- is not 138, the data moved under this file and it should be re-read before
-- committing.
--
-- Revert: the deleted rows carried only roster status and are reproducible
-- only from whatever wrote them, which is unknown; there is no clean revert
-- for part 2. Part 1 reverts with ALTER TABLE ... ALTER COLUMN source SET
-- DEFAULT 'nfl-pro-gameday-roster' on the parent and each partition.

-- Part 1: stop the column default from asserting a writer.
ALTER TABLE player_gamelogs ALTER COLUMN source DROP DEFAULT;

DO $$
DECLARE
  partition_name text;
BEGIN
  FOR partition_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'player_gamelogs'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN source DROP DEFAULT', partition_name
    );
  END LOOP;
END $$;

-- Part 2: delete gamelogs naming a player born too late to have played.
WITH prenatal AS (
  SELECT gl.esbid, gl.pid, gl.season_year
  FROM player_gamelogs gl
  JOIN player p ON p.pid = gl.pid
  WHERE p.date_of_birth ~ '^\d{4}-'
    AND substring(p.date_of_birth from 1 for 4)::int > 1900
    AND gl.season_year - substring(p.date_of_birth from 1 for 4)::int < 20
)
DELETE FROM player_gamelogs gl
USING prenatal
WHERE gl.esbid = prenatal.esbid
  AND gl.pid = prenatal.pid
  AND gl.season_year = prenatal.season_year;
