-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Remove the 107,532 orphaned SLEEPER rows from player_rankings_index.
--
-- Run with: yarn db:exec db/adhoc/2026-09-02-remove-orphaned-sleeper-rankings-rows.sql
--
-- WHAT THESE ROWS ARE
--
-- They are Sleeper ADP, written into the RANKINGS table under 18 fabricated
-- ranking_type names. `create_ranking_entries` in
-- scripts/import-sleeper-adp-and-projections.mjs mapped Sleeper's 10 ADP fields
-- onto 18 ranking_type labels and emitted one row per player per label with no
-- filter:
--
--   return ranking_types.map(({ type, adp_key }) => ({
--     pid: player_row.pid, week: 0, year: constants.season.year,
--     avg: adp[adp_key],
--     min: null, max: null, std: null, overall_rank: null, position_rank: null,
--     source_id: 'SLEEPER', ranking_type: type
--   }))
--
-- Commit 885308ac3 deleted that function on 2025-07-26 when Sleeper ADP moved
-- to player_adp_index/_history. It removed the writer and left the rows.
--
-- Everything measurable about them follows from that one expression:
--
--   - min_rank, max_rank, rank_standard_deviation, overall_rank and
--     position_rank are NULL on all 107,532 rows, because they are hardcoded
--     null above. No FantasyPros row has that shape.
--   - 94,258 rows (88 percent) carry average_rank = 999, Sleeper's UNDRAFTED
--     sentinel, passed straight through by `avg: adp[adp_key]`. Zero
--     FantasyPros rows carry it. The identical defect was fixed on the ADP side
--     on 2026-06-29 in commit 6bea782f2 ("stop storing Sleeper 999 sentinel"),
--     which never swept this table.
--   - The population is a dense 5,974 x 18 cross product -- every ranking_type
--     holds exactly 5,974 rows -- because the map has no filter.
--   - Ten source fields became eighteen labels, so some are stored three and
--     six times over. adp_2qb feeds the three superflex-redraft labels, which
--     hold 1,139 real ranks each; adp_dynasty_2qb feeds the three
--     superflex-dynasty labels at 1,346 each; adp_rookie feeds all six ROOKIE
--     labels, which hold ZERO real ranks and are 100 percent sentinel.
--
-- Only 13,224 of the 107,532 rows carry a real value at all, and the copy
-- groups above mean the distinct information is smaller still.
--
-- Season 2025 is the only season present because the writer stamped
-- `constants.season.year` at run time and was removed in July 2025.
--
-- WHY DELETING LOSES NOTHING
--
-- The underlying observations are retained in their proper table and their
-- proper shape. player_adp_history holds 1,198,053 SLEEPER rows for season 2025
-- over the same 2,459 pids, beginning 2025-06-01 -- before the rankings write
-- was removed. Step 1 below ASSERTS that retention before any delete runs, so
-- this file cannot remove the copy if the original is not there.
--
-- No consumer breaks. libs-server/data-views-column-definitions/
-- player-rankings-column-definitions.mjs defaults ranking_source_id to
-- ['FANTASYPROS']; of 196 saved user_data_views, 5 set that param and 0 name
-- SLEEPER.
--
-- WHY NOT REPAIR THE HISTORY SIDE INSTEAD
--
-- player_rankings_history holds zero SLEEPER rows in any season, so the obvious
-- alternative -- backfilling history from the index to restore parity -- would
-- mean writing 107,532 history rows that assert Sleeper published per-format
-- RANKINGS it never published, at an observation instant we do not have. That
-- manufactures a record rather than restoring one.
--
-- This clears 107,532 of the 109,103 findings on population-index-rebuild-parity
-- for the player_rankings feed. The residual ~1,571 are FantasyPros rows in
-- 2021-2024 and are a separate question, so the feed still reports.
--
-- Operator approved 2026-09-02. See
-- user:task/league/disposition-population-check-findings.md.

\echo === 1. ASSERT the Sleeper ADP retention this delete depends on ===
DO $$
DECLARE
  adp_rows bigint;
  adp_pids bigint;
  adp_first date;
BEGIN
  SELECT count(*), count(DISTINCT pid), min(observed_at)::date
    INTO adp_rows, adp_pids, adp_first
    FROM player_adp_history
   WHERE source_id = 'SLEEPER' AND season_year = 2025;

  IF adp_rows < 1000000 THEN
    RAISE EXCEPTION
      'refusing to delete: player_adp_history holds only % SLEEPER 2025 rows, expected over 1,000,000 -- the data this delete relies on is not there',
      adp_rows;
  END IF;

  IF adp_pids < 2400 THEN
    RAISE EXCEPTION
      'refusing to delete: player_adp_history covers only % SLEEPER 2025 pids, expected at least 2,400', adp_pids;
  END IF;

  IF adp_first > DATE '2025-07-26' THEN
    RAISE EXCEPTION
      'refusing to delete: earliest SLEEPER 2025 ADP observation is %, which is after the rankings writer was removed -- the ADP history does not cover the same period', adp_first;
  END IF;

  RAISE NOTICE 'retention ok: % SLEEPER 2025 ADP rows over % pids from %',
    adp_rows, adp_pids, adp_first;
END $$;

\echo === 2. ASSERT the population is exactly what was measured ===
DO $$
DECLARE
  total bigint;
  sentinel bigint;
  seasons bigint;
  types bigint;
  with_rank_metadata bigint;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE average_rank = 999),
         count(DISTINCT season_year),
         count(DISTINCT ranking_type),
         count(*) FILTER (
           WHERE min_rank IS NOT NULL OR max_rank IS NOT NULL
              OR rank_standard_deviation IS NOT NULL
              OR overall_rank IS NOT NULL OR position_rank IS NOT NULL)
    INTO total, sentinel, seasons, types, with_rank_metadata
    FROM player_rankings_index
   WHERE source_id = 'SLEEPER';

  IF total <> 107532 THEN
    RAISE EXCEPTION 'expected 107,532 SLEEPER index rows, found % -- re-diagnose before deleting', total;
  END IF;

  IF sentinel <> 94258 THEN
    RAISE EXCEPTION 'expected 94,258 sentinel rows, found %', sentinel;
  END IF;

  IF seasons <> 1 OR types <> 18 THEN
    RAISE EXCEPTION 'expected 1 season and 18 ranking types, found % and %', seasons, types;
  END IF;

  -- The identifying fingerprint of the retired writer: it hardcoded every one
  -- of these columns to null. A row carrying any of them did NOT come from that
  -- path, and this file has no standing to delete it.
  IF with_rank_metadata <> 0 THEN
    RAISE EXCEPTION
      'refusing to delete: % SLEEPER rows carry rank metadata the retired writer never wrote, so they came from somewhere else',
      with_rank_metadata;
  END IF;
END $$;

\echo === 3. BEFORE: rows by source ===
SELECT source_id, count(*) AS rows
FROM player_rankings_index GROUP BY 1 ORDER BY 1;

\echo === 4. DELETE the orphaned SLEEPER rows ===
DELETE FROM player_rankings_index WHERE source_id = 'SLEEPER';

\echo === 5. AFTER: rows by source ===
SELECT source_id, count(*) AS rows
FROM player_rankings_index GROUP BY 1 ORDER BY 1;

\echo === 6. ASSERT the delete hit its scope and nothing else ===
DO $$
DECLARE
  remaining_sleeper bigint;
  remaining_fantasypros bigint;
BEGIN
  SELECT count(*) INTO remaining_sleeper
    FROM player_rankings_index WHERE source_id = 'SLEEPER';
  IF remaining_sleeper <> 0 THEN
    RAISE EXCEPTION 'expected 0 SLEEPER rows remaining, found %', remaining_sleeper;
  END IF;

  -- Measured 2026-09-02 immediately before this file was written. A delete that
  -- moved this number took rows it had no business taking.
  SELECT count(*) INTO remaining_fantasypros
    FROM player_rankings_index WHERE source_id = 'FANTASYPROS';
  IF remaining_fantasypros <> 59436 THEN
    RAISE EXCEPTION
      'FANTASYPROS row count moved from 59,436 to % -- the delete reached outside its scope',
      remaining_fantasypros;
  END IF;
END $$;
