-- STATUS: APPLIED 2026-08-08 against league_production
--
-- Drop public.footballoutsiders. Last file of the retirement cluster.
--
-- The table is dead: zero writers and zero readers since the footballoutsiders.com
-- weekly scraper was removed in 36e41816 (the site has been down since 2023). It
-- holds 224 rows -- 2020 only, weeks 4-10, 32 teams, offense and defense packed
-- into one wide row under 78 shorthand column names.
--
-- It carries 24 of the schema conformance audit's 25 live violations (22
-- shorthand, 1 season_grain on `year`, 1 ambiguous_team on `team`), which is the
-- largest single bucket by a wide margin -- the next table carries one. Dropping
-- it takes the audit to 1, the survivor being league_formats.cap, which belongs
-- to the auction-economy task.
--
-- Its index idx_24613_team and its league_reader GRANT are NOT dropped
-- separately: both are owned by the table and go with it. Naming them in their
-- own statements would fail after the table is gone.
--
-- Archived first to a base-storage pg_dump, deliberately NOT to an in-database
-- footballoutsiders_archive table. A CREATE TABLE ... AS SELECT * copy would
-- carry all 78 shorthand names into a table audit-schema-conformance.mjs reads
-- straight out of the schema dump -- its CREATE TABLE public.* match has no
-- _archive exclusion -- so it would mint 24 fresh violations under a new name at
-- the same moment this drop clears 24, taking the audit 25 -> 25 rather than
-- 25 -> 1. That is the build-and-swap ratchet hazard recorded in league
-- CLAUDE.md.
--
-- Guarded on the source count AND on both fold-ins having landed, so this cannot
-- run against a half-applied cluster.

DO $$
DECLARE
    source_rows integer;
    drive_rows integer;
    unit_rows integer;
BEGIN
    SELECT count(*) INTO source_rows FROM public.footballoutsiders;
    IF source_rows <> 224 THEN
        RAISE EXCEPTION 'footballoutsiders holds % rows, expected 224 -- refusing to drop', source_rows;
    END IF;

    SELECT count(*) INTO drive_rows
      FROM public.dvoa_team_drive_seasonlogs
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10;
    IF drive_rows <> 448 THEN
        RAISE EXCEPTION 'drive fold-in has % rows, expected 448 -- refusing to drop', drive_rows;
    END IF;

    SELECT count(*) INTO unit_rows
      FROM public.dvoa_team_unit_seasonlogs_history
     WHERE season_year = 2020 AND week BETWEEN 4 AND 10;
    IF unit_rows <> 448 THEN
        RAISE EXCEPTION 'unit fold-in has % rows, expected 448 -- refusing to drop', unit_rows;
    END IF;
END $$;

DROP TABLE public.footballoutsiders;
