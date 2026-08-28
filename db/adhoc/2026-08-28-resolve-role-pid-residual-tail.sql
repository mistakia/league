-- Resolve the 2025 REG role-pid residual tail left by
-- scripts/backfill-role-pids.mjs (signal 126567 / base 126406).
--
-- The bulk backfill cleared 1,227 of 1,242 rows. Fifteen survived, in two
-- disjoint groups, neither of which that script can reach:
--
--   * 10 ball_carrier rows -- backfill-role-pids persists only ROLE_COLS,
--     which is the passer/target family. Ball carrier is out of its scope by
--     construction, not by failure.
--   * 5 passer rows on NOPL plays that carry ZERO nfl_play_stats rows. The
--     player-identification enrichment resolves a play-row _gsis to a _pid
--     only for plays it emits (State 2 in
--     libs-server/play-enrichment/player-identification-enrichment.mjs); a
--     play with no play_stats never reaches that path, so no amount of
--     re-running enrichment resolves it. That gap is the durable defect and
--     is tracked separately -- this file only repairs the data it left.
--
-- ADDITIVE ONLY, deliberately. This writes a _pid where one is missing and
-- never clears a _gsis. Signal 126536 (role-attribution-erased) grades the
-- opposite shape and warns that clearing a resolvable _gsis to make the
-- residual monitor green destroys the last record of who the player was, so
-- the WHERE clauses below require the _gsis to be present and the _pid to be
-- absent, and the join requires the gsis to resolve to exactly one player.
--
-- Idempotent: re-running matches nothing once applied.

BEGIN;

UPDATE nfl_plays np
SET ball_carrier_pid = p.pid
FROM player p
WHERE p.gsis_player_id = np.ball_carrier_gsis_player_id
  AND np.season_year = 2025
  AND np.season_type = 'REG'
  AND np.ball_carrier_gsis_player_id IS NOT NULL
  AND np.ball_carrier_pid IS NULL
  AND (
    SELECT COUNT(*) FROM player d
    WHERE d.gsis_player_id = np.ball_carrier_gsis_player_id
  ) = 1;

UPDATE nfl_plays np
SET passer_pid = p.pid
FROM player p
WHERE p.gsis_player_id = np.passer_gsis_player_id
  AND np.season_year = 2025
  AND np.season_type = 'REG'
  AND np.passer_gsis_player_id IS NOT NULL
  AND np.passer_pid IS NULL
  AND (
    SELECT COUNT(*) FROM player d
    WHERE d.gsis_player_id = np.passer_gsis_player_id
  ) = 1;

COMMIT;
