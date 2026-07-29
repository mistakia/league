-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Drop `projections_archive`, and with it the last trace of the MySQL-era
-- retention mechanism.
--
-- The table is empty (0 rows, 32 kB) and has no consumer: nothing in `api/`,
-- `libs-server/`, `jobs/`, `scripts/`, or any crontab reads or writes it. Its
-- only reference was `scripts/archive-projections.mjs`, deleted in the same
-- commit.
--
-- WHY THE SCRIPT WAS NOT REWRITTEN
--
-- `archive-projections.mjs` was not a mistake and not dead code that never
-- worked. It was FUNCTIONING retention in the MySQL era: it moved non-current
-- seasons out of the hot `projections` table into `projections_archive`, which
-- is exactly why the 2023-11-29 dump holds 2020-2022 in the archive table and
-- only 2023 in `projections`. Archiving was lossless -- the 2022-02-03 dump's
-- `projections` holds 2020 and 2021 at row and timestamp counts identical to
-- the same seasons in the 2023-11-29 dump's `projections_archive`.
--
-- What killed it was the MySQL->Postgres migration, which carried neither the
-- archive's contents nor `projections`' 2023, recreated `projections_archive`
-- empty, and left the script behind holding MySQL-only grammar (`INSERT
-- IGNORE`, `DELETE <alias> FROM ... INNER JOIN`) that Postgres cannot execute.
-- That is how working retention came to look like a table that had never been
-- used.
--
-- Its output is the very thing recovered by
-- `2026-07-29-backfill-projections-history.sql`, which is why this drop runs
-- AFTER that backfill: the dump's `projections_archive` was the source.
--
-- It has no Postgres role now. Two-table archival was a workaround for MySQL's
-- lack of partitioning; the correct mechanism here is declarative partitioning
-- of `projections_history` by `season_year`, which makes season-level archival
-- a metadata-only DETACH rather than a multi-million-row copy-and-delete.
-- Rewriting the script would rebuild the inferior mechanism.

-- `yarn db:exec` already wraps this file in a single transaction with
-- ON_ERROR_STOP=1, so no explicit BEGIN/COMMIT here.

-- Guard: never drop this table if a future run has put rows back in it.
DO $$
DECLARE remaining bigint;
BEGIN
  SELECT count(*) INTO remaining FROM public.projections_archive;
  IF remaining > 0 THEN
    RAISE EXCEPTION
      'projections_archive holds % rows; refusing to drop', remaining;
  END IF;
END $$;

DROP TABLE public.projections_archive;

COMMIT;
