-- Phase B pid renames: backfill DOB-bearing pids for 4 stub players.
-- See task #10 ("Phase B pid renames") in user-base; follow-up to the
-- 2026-05-24 deferred-pid-mixup fixes (commits 3647e713 / 3e6cb02).
--
-- Mechanics (per rename):
--   1. Capture source row values into a temp table.
--   2. NULL the unique-constrained IDs on the source row (to free them
--      for re-attachment under the target pid without violating any of
--      player's UNIQUE constraints: pff_id, otc_id, mfl_id, cbs_id,
--      cfbref_id, fleaflicker_id, swish_id, draftkings_id, fanduel_id,
--      ffpc_id, nffc_id, fantrax_id, rtsports_id, rts_id).
--   3. INSERT a clone at the target pid (with optional nfl_draft_year
--      override) carrying every column verbatim from the temp.
--   4. Enumerate every pid-bearing column in the public schema
--      (column_name LIKE '%_pid' OR column_name = 'pid'), skip the
--      player table itself, and UPDATE col = target WHERE col = source.
--      Matches the libs-server/update-player-id.mjs algorithm.
--   5. DELETE the now-empty source player row.
--
-- For BRIA-PRIC the target pid already exists as an empty placeholder
-- (gsisid/pff_id/etc. all NULL); pre-delete that row and also override
-- nfl_draft_year from 2010 to 2016 on the new clone.

-- This rewrites ~130 pid-bearing columns across the schema; many of the
-- referenced tables (nfl_plays, player_gamelogs partitions, projections,
-- props) are large and the WHERE pid=... predicate is unindexed on most
-- of them, so individual statements can exceed the 40s default timeout.
SET LOCAL statement_timeout = 0;

-- Pre-delete BRIA-PRIC-2016-1994-06-24 placeholder (must be empty).
DELETE FROM player
WHERE pid = 'BRIA-PRIC-2016-1994-06-24'
  AND gsisid IS NULL
  AND pff_id IS NULL
  AND sleeper_id IS NULL
  AND espn_id IS NULL
  AND gsis_it_id IS NULL
  AND esbid IS NULL;

DO $rename$
DECLARE
  renames CONSTANT TEXT[][] := ARRAY[
    ['BRIA-PRIC-2010-1994-06-24', 'BRIA-PRIC-2016-1994-06-24', '2016'],
    ['DOND-TILL-2020-0000-00-00', 'DOND-TILL-2020-1998-04-30', NULL],
    ['JERE-PHAR-2020-0000-00-00', 'JERE-PHAR-2020-1996-10-16', NULL],
    ['ANTH-JOHN-2023-0000-00-00', 'ANTH-JOHN-2023-1999-06-12', NULL]
  ];
  v_src TEXT;
  v_tgt TEXT;
  v_year_override INT;
  r RECORD;
  n_src INT;
  n_tgt INT;
BEGIN
  FOR i IN 1 .. array_length(renames, 1) LOOP
    v_src := renames[i][1];
    v_tgt := renames[i][2];
    v_year_override := NULLIF(renames[i][3], '')::INT;

    SELECT COUNT(*) INTO n_src FROM player WHERE pid = v_src;
    IF n_src <> 1 THEN
      RAISE EXCEPTION 'source pid % not found (n=%)', v_src, n_src;
    END IF;
    SELECT COUNT(*) INTO n_tgt FROM player WHERE pid = v_tgt;
    IF n_tgt <> 0 THEN
      RAISE EXCEPTION 'target pid % already exists (n=%)', v_tgt, n_tgt;
    END IF;

    CREATE TEMP TABLE _hold ON COMMIT DROP AS
      SELECT * FROM player WHERE pid = v_src;

    -- Free every unique-indexed external ID on source so the clone
    -- can carry them under the target pid. Covers both UNIQUE
    -- constraints and standalone UNIQUE INDEXes on the player table.
    UPDATE player SET
      cbs_id = NULL, cfbref_id = NULL, draftkings_id = NULL,
      fanduel_id = NULL, fantrax_id = NULL, ffpc_id = NULL,
      fleaflicker_id = NULL, mfl_id = NULL, nffc_id = NULL,
      otc_id = NULL, pff_id = NULL, rts_id = NULL,
      rtsports_id = NULL, swish_id = NULL,
      espn_id = NULL, fantasy_data_id = NULL, rotowire_id = NULL,
      gsis_it_id = NULL, gsispid = NULL, sleeper_id = NULL,
      keeptradecut_id = NULL, yahoo_id = NULL, pfr_id = NULL,
      rotoworld_id = NULL, gsisid = NULL, sportradar_id = NULL,
      esbid = NULL, sumer_id = NULL
    WHERE pid = v_src;

    INSERT INTO player (
      pid, fname, lname, pname, formatted, pos, pos1, pos2,
      height, weight, dob, forty, bench, vertical, broad, shuttle, cone,
      arm, hand, dpos, round, col, dv, nfl_draft_year, current_nfl_team,
      posd, jnum, dcp, nfl_id, esbid, gsisid, gsispid, gsis_it_id,
      high_school, sleeper_id, rotoworld_id, rotowire_id, sportradar_id,
      espn_id, fantasy_data_id, yahoo_id, keeptradecut_id, pfr_id,
      name_search_vector, ngs_athleticism_score, ngs_draft_grade,
      nfl_grade, ngs_production_score, ngs_size_score, otc_id,
      contract_year_signed, contract_years, contract_value, contract_apy,
      contract_guaranteed, contract_apy_cap_pct, contract_inflated_value,
      contract_inflated_apy, contract_inflated_guaranteed, pff_id,
      mfl_id, fleaflicker_id, cbs_id, cfbref_id, twitter_username,
      swish_id, draftkings_id, fanduel_id, rts_id, draft_team, sis_id,
      sis_prospect_grade, sis_prospect_pos_rank,
      sis_prospect_overall_rank, all_pro_first_team_selections,
      pro_bowls_selections, pfr_years_as_primary_starter,
      pfr_weighted_career_approximate_value,
      pfr_weighted_career_approximate_value_drafted_team, ffpc_id,
      nffc_id, fantrax_id, rtsports_id, roster_status, game_designation,
      forty_designation, ten_yard_split, ten_yard_split_designation,
      pro_forty, pro_forty_designation, sixty_yard_shuttle,
      sixty_yard_shuttle_designation, combine_attendance, hometown,
      sumer_id, fantasylabs_id
    )
    SELECT
      v_tgt, fname, lname, pname, formatted, pos, pos1, pos2,
      height, weight, dob, forty, bench, vertical, broad, shuttle, cone,
      arm, hand, dpos, round, col, dv,
      COALESCE(v_year_override, nfl_draft_year), current_nfl_team,
      posd, jnum, dcp, nfl_id, esbid, gsisid, gsispid, gsis_it_id,
      high_school, sleeper_id, rotoworld_id, rotowire_id, sportradar_id,
      espn_id, fantasy_data_id, yahoo_id, keeptradecut_id, pfr_id,
      name_search_vector, ngs_athleticism_score, ngs_draft_grade,
      nfl_grade, ngs_production_score, ngs_size_score, otc_id,
      contract_year_signed, contract_years, contract_value, contract_apy,
      contract_guaranteed, contract_apy_cap_pct, contract_inflated_value,
      contract_inflated_apy, contract_inflated_guaranteed, pff_id,
      mfl_id, fleaflicker_id, cbs_id, cfbref_id, twitter_username,
      swish_id, draftkings_id, fanduel_id, rts_id, draft_team, sis_id,
      sis_prospect_grade, sis_prospect_pos_rank,
      sis_prospect_overall_rank, all_pro_first_team_selections,
      pro_bowls_selections, pfr_years_as_primary_starter,
      pfr_weighted_career_approximate_value,
      pfr_weighted_career_approximate_value_drafted_team, ffpc_id,
      nffc_id, fantrax_id, rtsports_id, roster_status, game_designation,
      forty_designation, ten_yard_split, ten_yard_split_designation,
      pro_forty, pro_forty_designation, sixty_yard_shuttle,
      sixty_yard_shuttle_designation, combine_attendance, hometown,
      sumer_id, fantasylabs_id
    FROM _hold;

    -- Move all pid-bearing references in other tables.
    FOR r IN
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE (column_name LIKE '%\_pid' ESCAPE '\' OR column_name = 'pid')
        AND table_schema = current_schema()
        AND table_name <> 'player'
        AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema())
    LOOP
      EXECUTE format(
        'UPDATE %I SET %I = $1 WHERE %I = $2',
        r.table_name, r.column_name, r.column_name
      ) USING v_tgt, v_src;
    END LOOP;

    DELETE FROM player WHERE pid = v_src;

    DROP TABLE _hold;

    RAISE NOTICE 'rename complete: % -> %', v_src, v_tgt;
  END LOOP;
END $rename$;

-- Validation
SELECT pid, fname, lname, dob, nfl_draft_year, gsisid, pff_id, sleeper_id, espn_id
FROM player
WHERE pid LIKE 'BRIA-PRIC-%'
   OR pid LIKE 'DOND-TILL-%'
   OR pid LIKE 'JERE-PHAR-%'
   OR pid LIKE 'ANTH-JOHN-2023-%'
ORDER BY pid;
