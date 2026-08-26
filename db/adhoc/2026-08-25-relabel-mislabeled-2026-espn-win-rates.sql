-- STATUS: APPLIED 2026-08-26 against league_production
--
-- 2026-08-25: Relabel the ESPN line-win-rate rows that were written as season
-- 2026 but are the 2025 season's data.
--
-- CAUSE. `config.espn_config.espn_line_win_rates_url` is a season-pinned ESPN
-- article (.../id/46138675/2025-nfl-win-rates-...), while
-- scripts/import-espn-line-win-rates.mjs stamped every row with
-- `current_season.year` -- the clock, not the source. Four runs on 2026-03-14
-- and 2026-03-15 scraped the 2025 article after the season constants had
-- rolled over and wrote it as season_year 2026, a season that has not been
-- played. The importer's two aggregate row-count floors both passed. Fixed in
-- the same change that adds this file: the season is now derived from the
-- article URL and asserted against the season the run is importing.
--
-- The offseason skip guard was also dead (`week > nflFinalWeek` against a week
-- counter clamped at 0 before the opener), which is why runs happened in March
-- at all; that is fixed alongside.
--
-- WHY RELABEL RATHER THAN DELETE. The March 2026 scrape is the 2025 article
-- read AFTER the 2025 regular season finished, so it is the most final 2025
-- snapshot we hold -- strictly better than the 2025-12-17 observation the
-- index currently serves, which was taken with weeks still to play:
--
--   ARI  pass_rush 0.38 -> 0.39, pass_block 0.62 -> 0.63   (2025-12-17 -> 2026-03-15)
--   KC   pass_block 0.73 -> 0.71
--
-- Deleting it would remove a fabricated season and throw away the best 2025
-- numbers in the same stroke.
--
-- SHAPE. The _history tables are append-only and their primary keys do not
-- include season_year ((nfl_team, observed_at) and (player_name,
-- espn_player_id, espn_win_rate_type, observed_at)), so the relabel cannot
-- collide. The _index tables key ON season_year, so the four 2026 index rows
-- would collide with their 2025 twins; both years are therefore rebuilt from
-- _history using the same DISTINCT ON keys the importer's onConflict targets
-- use, which is how db/adhoc/2026-07-31-conform-espn-win-rates-feeds.sql
-- established these pairs are reproducible from history by construction.
--
-- EXPECTED ROW COUNTS (measured against league_production 2026-08-25):
--   espn_team_win_rates_history    128 rows relabelled  (4 observations x 32 teams)
--   espn_player_win_rates_history  432 rows relabelled  (4 observations x 108 players)
--   espn_team_win_rates_index       32 rows for 2026 gone, 32 rows for 2025 refreshed
--   espn_player_win_rates_index    108 rows for 2026 gone, 2025 refreshed
--   no espn_*_win_rates row of any table carries season_year 2026 afterwards

BEGIN;

UPDATE espn_team_win_rates_history SET season_year = 2025 WHERE season_year = 2026;

UPDATE espn_player_win_rates_history SET season_year = 2025 WHERE season_year = 2026;

-- Rebuild both index tables for 2025 from history. The 2026 index rows are
-- removed by the same delete: nothing in history carries 2026 any more, so the
-- reinsert cannot reproduce them.
DELETE FROM espn_team_win_rates_index WHERE season_year IN (2025, 2026);

INSERT INTO espn_team_win_rates_index (
  nfl_team, pass_rush_win_rate, run_stop_win_rate, pass_block_win_rate,
  run_block_win_rate, observed_at, season_year
)
SELECT DISTINCT ON (nfl_team, season_year)
  nfl_team, pass_rush_win_rate, run_stop_win_rate, pass_block_win_rate,
  run_block_win_rate, observed_at, season_year
FROM espn_team_win_rates_history
WHERE season_year = 2025
ORDER BY nfl_team, season_year, observed_at DESC;

DELETE FROM espn_player_win_rates_index WHERE season_year IN (2025, 2026);

INSERT INTO espn_player_win_rates_index (
  pid, player_name, espn_player_id, nfl_team, line_win_count, total_plays,
  win_rate, double_team_percentage, espn_win_rate_type, observed_at, season_year
)
SELECT DISTINCT ON (player_name, espn_player_id, espn_win_rate_type, season_year)
  pid, player_name, espn_player_id, nfl_team, line_win_count, total_plays,
  win_rate, double_team_percentage, espn_win_rate_type, observed_at, season_year
FROM espn_player_win_rates_history
WHERE season_year = 2025
ORDER BY player_name, espn_player_id, espn_win_rate_type, season_year, observed_at DESC;

-- Oracle. A count is not an integrity check on its own, so assert the three
-- things that must hold rather than eyeballing row totals: no fabricated season
-- survives anywhere in the cluster, every team is present for 2025, and the
-- rebuilt index carries the LATER observation rather than the one it replaced.
DO $$
DECLARE
  stray_2026 integer;
  team_rows integer;
  latest_obs timestamptz;
BEGIN
  SELECT
    (SELECT count(*) FROM espn_team_win_rates_index WHERE season_year = 2026)
    + (SELECT count(*) FROM espn_team_win_rates_history WHERE season_year = 2026)
    + (SELECT count(*) FROM espn_player_win_rates_index WHERE season_year = 2026)
    + (SELECT count(*) FROM espn_player_win_rates_history WHERE season_year = 2026)
  INTO stray_2026;
  IF stray_2026 <> 0 THEN
    RAISE EXCEPTION 'ORACLE FAIL: % espn win-rate row(s) still carry season_year 2026', stray_2026;
  END IF;

  SELECT count(*) INTO team_rows
  FROM espn_team_win_rates_index WHERE season_year = 2025;
  IF team_rows <> 32 THEN
    RAISE EXCEPTION 'ORACLE FAIL: 2025 team index holds % row(s), expected 32', team_rows;
  END IF;

  SELECT max(observed_at) INTO latest_obs
  FROM espn_team_win_rates_index WHERE season_year = 2025;
  IF latest_obs < '2026-03-01'::timestamptz THEN
    RAISE EXCEPTION 'ORACLE FAIL: 2025 team index newest observation is %, expected the 2026-03 scrape', latest_obs;
  END IF;

  RAISE NOTICE 'ORACLE PASS: no season_year 2026 rows remain; 2025 team index rebuilt at 32 rows, newest observation %', latest_obs;
END $$;

COMMIT;
