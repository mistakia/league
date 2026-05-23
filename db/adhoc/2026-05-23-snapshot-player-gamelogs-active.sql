-- Snapshot the `active` column of player_gamelogs before Phase A2c's
-- nflverse weekly_rosters backfill. The nflverse importer's ON CONFLICT
-- merge clause is narrowed to `active` only, but for the subset of existing
-- rows that nflverse touches the `active` value can flip (e.g. NULL -> true,
-- true -> false). This snapshot makes those flips reversible.
--
-- Scoped to non-NULL `active` rows: NULL rows have nothing to restore, and
-- nflverse setting them is the intended effect. Filtering also keeps the
-- snapshot table small (~120k rows from the 2018-2022 era where the deleted
-- import-player-gamelogs.mjs populated active, plus 2023+ gameday-roster ACT
-- rows).
--
-- Revert:
--   UPDATE player_gamelogs pg
--   SET active = s.active
--   FROM player_gamelogs_active_snapshot_2026_05_23 s
--   WHERE pg.esbid = s.esbid AND pg.pid = s.pid AND pg.year = s.year
--     AND pg.source != 'nflverse-weekly-rosters';
--
--   (paired with `DELETE FROM player_gamelogs WHERE source =
--   'nflverse-weekly-rosters';` to remove new INSERTs.)

CREATE TABLE player_gamelogs_active_snapshot_2026_05_23 AS
SELECT esbid, pid, year, active, source
FROM player_gamelogs
WHERE active IS NOT NULL;

CREATE INDEX ON player_gamelogs_active_snapshot_2026_05_23 (esbid, pid, year);
