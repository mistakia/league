-- STATUS: APPLIED 2026-09-04 against league_production
--
-- Give `leagues` the column that says a league is a CLONE, and stamp the one
-- clone that already exists.
--
-- WHY A NEW COLUMN RATHER THAN A PREDICATE OVER THE ONES WE HAVE. There is no
-- such predicate. `is_hosted` is true for the auction mirror AND for league 1,
-- the league it copies -- an external read-only mirror is what `is_hosted`
-- false means, so a clone you can write to must set it. `archived_at` is null
-- on a live clone by design; `clone_league_metadata` clears it explicitly,
-- because a clone is live by definition. Name and commissioner are copied.
-- After 2026-09-01 the database held two leagues that agreed on every column a
-- consumer could have filtered on, and one of them was a mirror.
--
-- WHAT THAT COST. `cli/monitoring/check-league-lineage-consistency.sh` grades
-- every league for STILL_HELD roster-asset holdings that the latest
-- rosters_players snapshot does not confirm, and league 119 reported 338 of
-- them against league 1's 0. None is drift. The clone copies the transaction
-- log whole while `NOT_CLONED_REASONS` deliberately withholds `trades`,
-- `waivers` and `poaches`, and the lineage walk reads the `trades` tables
-- DIRECTLY (libs-server/roster-asset-lineage/walk-transactions.mjs, scoped by
-- `trades.lid`) rather than inferring transfers from transactions alone. So
-- 119's transactions say a player moved and its trade tables say nothing, the
-- holding never terminates, and every such holding reads as a phantom orphan.
-- That is structural to what a clone IS, it is not a defect in the mirror, and
-- it will recur for every future mirror -- which is why the fix is a marker and
-- not a league-id exclusion list. Signals 128066/128067/128255.
--
-- NULLABLE, NOT DEFAULTED. Null means "not a clone", which is the honest
-- reading for every league that predates this column: none of them was created
-- by `clone_league_metadata`, and 119 is the only clone the database has ever
-- held. A backfill wider than one row would be asserting provenance nobody
-- recorded.
--
-- SELF-REFERENCING FK, so a clone cannot name a league that does not exist and
-- the source cannot be deleted out from under it.
--
-- DEFERRABLE INITIALLY DEFERRED, and that is not caution -- without it a `--sync`
-- of a clone that is ITSELF the source of another clone would abort. `--sync`
-- wipes and restores: `wipe_league` DELETEs the target's own `leagues` row and
-- `restore_league_configuration` re-inserts the captured one, both inside a
-- single transaction. A non-deferrable check fires at statement time, sees the
-- parent momentarily gone while a child still points at it, and throws on an
-- operation that is atomic and correct end to end. Deferring moves the check to
-- COMMIT, by which point the parent is back -- while a genuinely dangling
-- reference still fails the transaction, which is the whole point of the FK.
--
-- ON DELETE SET NULL was considered and is WRONG here, which is worth recording
-- because it is the reflexive answer. It would null the child's provenance at
-- the DELETE, and the parent's re-insert would never restore it -- so a routine
-- sync would silently erase a second generation's record of where it came from.
-- A constraint that quietly destroys data is worse than one that throws.
--
-- NO ACTION over CASCADE deliberately, though every other FK into `leagues`
-- cascades: deleting a source must not delete the mirrors taken from it.
--
-- db:exec supplies the transaction; do NOT add BEGIN/COMMIT.

-- Bounded wait to ACQUIRE, unlimited to execute. The statement itself is
-- trivial -- a nullable column with no default is metadata-only and the FK
-- validation scans ~117 rows -- so `statement_timeout` is not the exposure. The
-- ACCESS EXCLUSIVE lock is: once queued it blocks every new reader of `leagues`
-- behind it, and league 1's auction is live through 2026-09-08. Failing to
-- acquire is strictly better than stalling the auction; re-run the file.
SET lock_timeout = '3s';

ALTER TABLE leagues
  ADD COLUMN cloned_from_league_id bigint
    REFERENCES leagues (league_id)
    DEFERRABLE INITIALLY DEFERRED;

COMMENT ON COLUMN leagues.cloned_from_league_id IS
  'The league this one was copied from by clone_league_metadata, null when it is not a clone. Set to the IMMEDIATE source, so a clone of a clone names the clone.';

-- League 119 is the auction mirror of league 1, cloned 2026-09-01; it is the
-- only clone in production and the only row this touches.
--
-- ASSERTED RATHER THAN LEFT TO THE OUTPUT. An UPDATE that matches zero rows is a
-- SUCCESS: ON_ERROR_STOP has nothing to say about a correct statement whose
-- predicate matched nothing, and db:exec would rewrite the banner to APPLIED with
-- the whole point of the file undone. Telling the reader to eyeball the count is
-- weaker than refusing to commit without it.
DO $$
DECLARE
  stamped int;
BEGIN
  UPDATE leagues
     SET cloned_from_league_id = 1
   WHERE league_id = 119;

  GET DIAGNOSTICS stamped = ROW_COUNT;
  IF stamped <> 1 THEN
    RAISE EXCEPTION
      'expected to stamp exactly 1 league as a clone, stamped %', stamped;
  END IF;
END $$;
