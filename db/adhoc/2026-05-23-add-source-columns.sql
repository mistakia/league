-- Add provenance `source` columns to the four tables Phase A/B ingestion paths
-- write to. Existing rows carry the table's default sentinel so historical data
-- is correctly tagged with its originating importer; new rows tag their
-- provenance per importer. Lets us run multiple importers without conflict and
-- revert any single source's writes by `DELETE WHERE source = '<sentinel>'`.
--
-- Defaults match the live importer that has been writing to each table:
--   player_changelog       -> libs-server/update-player.mjs (Sleeper)
--   practice               -> scripts/import-rotowire-practice-report.mjs (Rotowire)
--   player_aliases         -> manual / scripts/resolve-player-match.mjs
--   player_gamelogs        -> private/scripts/import-gameday-rosters.mjs (NFL Pro)
--
-- player_gamelogs is partitioned -- ADD COLUMN on the parent cascades to all
-- partitions automatically (PostgreSQL 11+ inherited-column semantics).
--
-- Phase A2's nflverse-weekly-rosters importer writes with source='nflverse-weekly-rosters'.
-- Phase B2's nflverse-injuries importer writes player_changelog rows with source='nflverse-backfill'
-- (historical 2009-2022) or source='nflverse' (ongoing 2026+).
-- Phase A3's orphan-resolver writes player_aliases rows with source='changelog-orphan-resolver'.
-- Phase B4's nflverse practice backfill writes practice rows with source='nflverse-backfill'.
--
-- Revert: ALTER TABLE <table> DROP COLUMN source; for each table.

ALTER TABLE player_changelog ADD COLUMN source varchar(32) DEFAULT 'sleeper';
ALTER TABLE practice         ADD COLUMN source varchar(32) DEFAULT 'rotowire';
ALTER TABLE player_aliases   ADD COLUMN source varchar(32) DEFAULT 'manual';
ALTER TABLE player_gamelogs  ADD COLUMN source varchar(32) DEFAULT 'nfl-pro-gameday-roster';
