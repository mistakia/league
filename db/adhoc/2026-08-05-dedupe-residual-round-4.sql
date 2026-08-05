-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Residual duplicate-person cleanup, round 4. Two merges, and nothing else.
--
-- These two pairs exist BECAUSE of round 3. Repairing two corrupt birth dates in
-- db/adhoc/2026-08-05-dedupe-residual-round-3.sql made each pair's two rows agree
-- on a date they had never agreed on, which is what made them visible at all.
-- They are outside the operator-approved 48-pair set, so they were deliberately
-- left unmerged by round 3 and were re-adjudicated from scratch here.
--
--   GARY-ANDE-006465 -> GARY-ANDE-016337   Gary Allan Anderson, K, Syracuse
--   ROOS-NIXX-001769 -> ROOS-NIXX-015668   Roosevelt Delbert Nix, FB, Kent State
--
-- Backup: every row either merge reads or writes -- 21,909 rows across 27 tables,
-- all four player rows included -- is in
-- scratch/dedupe-residual-round-4/2026-08-05-dedupe-round4-backup.jsonl.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.
--
-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------
--
-- Each pair was confirmed by TWO independent oracles that do not share an input,
-- and neither oracle depends on the birth date that surfaced the pair.
--
-- GARY-ANDE-006465 + GARY-ANDE-016337
--   PFR andergar02 is "Gary Allan Anderson", K, 5-11/193, born 1959-07-16,
--     Syracuse, HS Brettonwood (South Africa), Buffalo round 7 pick 171 of 1982.
--   nflverse gsis 00-0000313 carries esb AND273108 AND pfr andergar02 on ONE row:
--     K, Syracuse, 1959-07-16, draft 1982/7/171, rookie_season 1982.
--   016337 resolves to that nflverse row by gsis and by esb. 006465 holds no
--     identifier nflverse can read -- its only id is nfl_player_id 2499425, and
--     nflverse nfl_id is gsis_it_player_id, a documented dead end -- but its
--     biography matches that same record on every field it carries: K, 71/193,
--     Syracuse, 1959-07-16, 1982 round 7 pick 171.
--   The nfl_player_id was independently era-checked rather than assumed. That id
--     block is assigned ALPHABETICALLY: 2499416 is Morten Andersen (1982, born
--     1960), 2499425 is this row, 2499427 is Jamal Anderson. A 1982-entry
--     Anderson sits exactly where 2499425 falls, by name and by era.
--
-- ROOS-NIXX-001769 + ROOS-NIXX-015668
--   PFR NixxRo01 is "Roosevelt Delbert Nix", FB, 5-11/248, born 1992-03-30 in
--     Reynoldsburg OH, Kent State, HS Reynoldsburg (OH), undrafted.
--   nflverse gsis 00-0030741 carries esb NIX511473 and pfr NixxRo01 on ONE row:
--     FB, Kent State, 1992-03-30, no draft record, rookie_season 2015.
--   015668 already stores pfr_player_id NixxRo01, so our own data points the two
--     rows at one PFR person. 001769 holds no identifier at all, and its
--     biography -- FB, 71/248, Kent State, Reynoldsburg (OH), 1992-03-30 --
--     matches that record exactly, including the weight 015668 has wrong.
--
-- Cluster size was checked, not assumed. Four rows share the name Gary Anderson
-- and three share Roosevelt Nix; each merge is strictly pairwise and no third row
-- shares either survivor's identity:
--   GARY-ANDE-005181  G,  Stanford,             1955-09-22  -- distinct person
--   GARY-ANDE-016338  RB, Arkansas,             1961-04-18  -- distinct person,
--     resolves to its OWN nflverse row (gsis 00-0000311, pfr AndeGa00)
--   ROOS-NIXX-001755  DE, Central State (Ohio), 1967-04-17  -- distinct person,
--     resolves to its OWN nflverse row (gsis 00-0012124, pfr NixxRo20)
--
-- Explicitly NOT merged: WILL-JOHN-016794 / WILL-JOHN-024279. They share a birth
-- date and are two people. PFR carries JohnWi00 (William Christopher Johnson, FB,
-- West Virginia) and JohnWi01 (Will Johnson, P, Texas State) as separate players;
-- nflverse has the fullback (gsis 00-0028841) and no row for the punter at all.
-- 024279's 1988-11-14 is almost certainly copied from the fullback -- PFR gives
-- the Texas State player no birth date, and no oracle offers a replacement -- so
-- the value is left alone rather than guessed at. That pair is the inverse of the
-- mechanism above: a corrupt date FORGING a match rather than hiding one.
--
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE merge_map (
  drop_pid varchar NOT NULL PRIMARY KEY,
  keep_pid varchar NOT NULL,
  carry_nfl_player_id boolean NOT NULL
) ON COMMIT DROP;

-- Survivor rule, unchanged from rounds 2 and 3: most dependent rows, then most
-- identifiers, then lower serial. Both survivors win on all three.
--   GARY-ANDE-016337  5,343 rows, gsis + esb   vs  006465  14 rows, one id
--   ROOS-NIXX-015668 16,515 rows, five ids     vs  001769  37 rows, no ids
--
-- carry_nfl_player_id is true for both. Gary carries 2499425 onto a survivor
-- holding NULL, era-gated above. The Nix donor holds no nfl_player_id, so its
-- flag is a no-op and is set true rather than inventing a distinction.
INSERT INTO merge_map (drop_pid, keep_pid, carry_nfl_player_id) VALUES
  ('GARY-ANDE-006465', 'GARY-ANDE-016337', true),
  ('ROOS-NIXX-001769', 'ROOS-NIXX-015668', true);

-- Field reconciliation. Same policy as round 3: the six fields below are driven
-- from nflverse/PFR rather than from either league row, and this runs AFTER the
-- additive fill so the oracle is the final word.
--
-- Every conflict between the two sides of these pairs is resolved by an oracle
-- rather than by preferring a row. There are six, and in four of them the DONOR
-- is the row that was right:
--
--   GARY-ANDE-016337
--     draft_round        0 -> 7      survivor wrong; PFR and nflverse both say
--                                    round 7, pick 171. The donor held 7.
--     position_depth     kept "K"    donor held "INA". Transient depth-chart
--                                    state, not identity, and not reconciled.
--     jersey_number      kept 1      donor held 0, which is this column's empty
--                                    value. Anderson wore 1.
--
--   ROOS-NIXX-015668
--     primary_position   RB -> FB    survivor wrong; PFR and nflverse both say
--     secondary_position RB -> FB    FB. The donor held FB. normalize_position
--                                    is the identity on FB, which is already in
--                                    the canonical 25-value vocabulary.
--     weight_pounds      265 -> 248  survivor wrong; PFR says 248. The donor
--                                    held 248.
--
-- nfl_draft_year is treated differently here than in round 3, deliberately.
-- Round 3 wrote NULL wherever nflverse was silent, because draft year conflicted
-- on all 48 of its pairs and was demonstrably corrupt across that population.
-- Neither condition holds here: neither donor carries a draft year at all, so
-- there is no conflict to resolve.
--   Gary Anderson keeps 1982, which nflverse and PFR both confirm.
--   Roosevelt Nix keeps 2014. nflverse gives him no draft year (undrafted) and a
--     rookie_season of 2015, and 2014 is the year he entered the league as an
--     undrafted free agent -- exactly the entry-year-precedes-debut shape
--     libs-server/player-era.mjs documents for undrafted players, and inside the
--     two-year grace that predicate already allows. Writing NULL would destroy a
--     correct value to satisfy a rule aimed at a different population.
-- Round and pick ARE nulled for Nix: he was undrafted, and 0 is a sentinel.
--
-- college is written but changes nothing -- nflverse agrees with both rows on
-- "Syracuse" and "Kent State". It is named here only so the reconciliation
-- covers the same six fields round 3 did.
CREATE TEMP TABLE reconciled (
  keep_pid varchar NOT NULL PRIMARY KEY,
  nfl_draft_year integer,
  draft_round smallint,
  draft_overall_pick smallint,
  primary_position varchar(4) NOT NULL,
  secondary_position varchar(4) NOT NULL,
  college varchar(255),
  height_inches smallint,
  weight_pounds smallint
) ON COMMIT DROP;

INSERT INTO reconciled (keep_pid, nfl_draft_year, draft_round, draft_overall_pick,
  primary_position, secondary_position, college, height_inches, weight_pounds) VALUES
  ('GARY-ANDE-016337', 1982,    7, 171, 'K',  'K',  'Syracuse',   71, 193),
  ('ROOS-NIXX-015668', 2014, NULL, NULL, 'FB', 'FB', 'Kent State', 71, 248);

-- Step 0. Refuse to run against a database this map was not built for.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 distinct survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m JOIN merge_map x ON x.drop_pid = m.keep_pid;
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion', n; END IF;

  SELECT count(*) INTO n FROM reconciled r WHERE NOT EXISTS (SELECT 1 FROM merge_map m WHERE m.keep_pid = r.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% reconciled rows name a pid that is not a survivor', n; END IF;

  -- The sibling session's pair, and round 3's five conflated-identity referrals,
  -- must never appear in this map.
  SELECT count(*) INTO n FROM merge_map
   WHERE drop_pid IN ('CLEV-HARR-002939','CLEV-HARR-007173','MARV-LEWI-006866','CURT-THOM-008802',
                      'DERW-WILL-020031','ANTH-DAVI-018663','JASO-PHIL-004707')
      OR keep_pid IN ('CLEV-HARR-002939','CLEV-HARR-007173','MARV-LEWI-006866','CURT-THOM-008802',
                      'DERW-WILL-020031','ANTH-DAVI-018663','JASO-PHIL-004707');
  IF n > 0 THEN RAISE EXCEPTION 'map contains a pid reserved to another line of work'; END IF;

  -- The three rows that are NOT part of either merge must still be present and
  -- untouched afterwards. Assert they exist now so a stale map cannot silently
  -- target one of them.
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('GARY-ANDE-005181','GARY-ANDE-016338','ROOS-NIXX-001755');
  IF n <> 3 THEN RAISE EXCEPTION 'expected the 3 distinct same-name rows to be present, got %', n; END IF;

  -- No nfl_player_id carry may land inside the sparse dead zone, where an era
  -- prediction from nearest neighbours is a coin flip.
  SELECT count(*) INTO n
    FROM merge_map m JOIN player d ON d.pid = m.drop_pid JOIN player k ON k.pid = m.keep_pid
   WHERE m.carry_nfl_player_id AND k.nfl_player_id IS NULL
     AND d.nfl_player_id BETWEEN 2508600 AND 2530400;
  IF n > 0 THEN RAISE EXCEPTION '% nfl_player_id carries land in the sparse 2508600-2530400 zone', n; END IF;
END $$;

-- Step 1. Snapshot every row about to be deleted. Everything after this reads the
-- deleted rows from here, never from `player`, so the fill in step 9 still works
-- after the delete in step 8.
CREATE TEMP TABLE drop_snapshot ON COMMIT DROP AS
SELECT p.* FROM player p JOIN merge_map m ON m.drop_pid = p.pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM drop_snapshot;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-05-dedupe-residual-round-4',
  'preserved value from merged duplicate row ' || m.drop_pid,
  now()
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
CROSS JOIN LATERAL jsonb_each(to_jsonb(s)) kv
WHERE kv.value IS NOT NULL
  AND kv.value <> 'null'::jsonb
  AND kv.key NOT IN ('pid', 'name_search_vector');

-- Step 3. Record the merge itself.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, 'pid', m.drop_pid, m.keep_pid,
  'adhoc/2026-08-05-dedupe-residual-round-4',
  'duplicate-person row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Assert the gamelog-collision trap is absent. Round 2 needed a
-- column-wise COALESCE rescue here; round 3 did not. Measured absent for this
-- set too -- the Gary donor has no gamelogs at all and the Nix donor has none --
-- but the assertion is what makes that a fact rather than an inherited claim.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM merge_map m
    JOIN player_gamelogs d ON d.pid = m.drop_pid
    JOIN player_gamelogs k ON k.pid = m.keep_pid AND k.esbid = d.esbid AND k.season_year = d.season_year;
  IF n <> 0 THEN
    RAISE EXCEPTION 'expected 0 colliding gamelog rows, got % -- this set now needs the round-2 COALESCE rescue step', n;
  END IF;
END $$;

-- Step 5. Drop the donor rows that would collide once re-pointed. Driven off the
-- live unique indexes rather than a hand-written table list, so an index added
-- since this file was written is still respected.
DO $$
DECLARE r record; q text; n int; total int := 0;
BEGIN
  FOR r IN
    SELECT t.relname AS tbl, array_agg(a.attname ORDER BY k.ord) AS colnames
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    CROSS JOIN LATERAL unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE x.indisunique AND t.relname <> 'player' AND NOT t.relispartition
    GROUP BY t.relname, x.indexrelid
    HAVING 'pid' = ANY(array_agg(a.attname))
  LOOP
    q := format(
      'DELETE FROM %I d USING merge_map m WHERE m.drop_pid = d.pid AND EXISTS (SELECT 1 FROM %I k WHERE k.pid = m.keep_pid%s)',
      r.tbl, r.tbl,
      (SELECT coalesce(string_agg(format(' AND k.%I IS NOT DISTINCT FROM d.%I', c, c), ''), '')
       FROM unnest(r.colnames) c WHERE c <> 'pid'));
    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'step 5: dropped % colliding rows from %', n, r.tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'step 5: % colliding donor rows dropped in total', total;
END $$;

-- Step 6. Re-point everything that still references a row being deleted. Driven
-- off information_schema so no pid-bearing table can be missed; partition
-- children are skipped because the update is applied to their parent.
DO $$
DECLARE tbl text; n int; total int := 0;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
    ORDER BY 1
  LOOP
    EXECUTE format('UPDATE %I t SET pid = m.keep_pid FROM merge_map m WHERE t.pid = m.drop_pid', tbl);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'step 6: re-pointed % rows in %', n, tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'step 6: % rows re-pointed in total', total;
END $$;

-- Step 7. Verify nothing anywhere still references a row about to be deleted.
DO $$
DECLARE tbl text; n int;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.drop_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still holds % rows on a pid about to be deleted', tbl, n; END IF;
  END LOOP;
END $$;

-- Step 8. Drop the duplicate rows, releasing their identifiers from every UNIQUE
-- index before those identifiers are written onto the survivors in step 9.
DELETE FROM player p USING merge_map m WHERE p.pid = m.drop_pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.drop_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% duplicate rows survived the delete', n; END IF;
END $$;

-- Step 9. Fill every column the survivor is missing, from the snapshot. Purely
-- additive: coalesce never overwrites a value the survivor already holds, so no
-- adjudication between two competing non-null values happens here. Step 10 is
-- where the reconciled fields get their final values.
--
-- date_of_birth uses nullif against the '0000-00-00' sentinel rather than a bare
-- coalesce. The column is a varchar whose absent value is that string and never
-- NULL, so a bare coalesce would keep the sentinel and discard a real date.
-- Neither survivor here carries the sentinel, so this changes nothing today; it
-- is written this way because the bare form is wrong and gets copied forward.
UPDATE player c SET
  first_name = coalesce(c.first_name, s.first_name),
  last_name = coalesce(c.last_name, s.last_name),
  short_name = coalesce(c.short_name, s.short_name),
  formatted_name = coalesce(c.formatted_name, s.formatted_name),
  primary_position = coalesce(c.primary_position, s.primary_position),
  secondary_position = coalesce(c.secondary_position, s.secondary_position),
  tertiary_position = coalesce(c.tertiary_position, s.tertiary_position),
  height_inches = coalesce(c.height_inches, s.height_inches),
  weight_pounds = coalesce(c.weight_pounds, s.weight_pounds),
  date_of_birth = coalesce(nullif(c.date_of_birth, '0000-00-00'),
                           nullif(s.date_of_birth, '0000-00-00'),
                           c.date_of_birth),
  forty_yard_dash_seconds = coalesce(c.forty_yard_dash_seconds, s.forty_yard_dash_seconds),
  bench_press_reps = coalesce(c.bench_press_reps, s.bench_press_reps),
  vertical_jump_inches = coalesce(c.vertical_jump_inches, s.vertical_jump_inches),
  broad_jump_inches = coalesce(c.broad_jump_inches, s.broad_jump_inches),
  shuttle_run_seconds = coalesce(c.shuttle_run_seconds, s.shuttle_run_seconds),
  three_cone_drill_seconds = coalesce(c.three_cone_drill_seconds, s.three_cone_drill_seconds),
  arm_length_inches = coalesce(c.arm_length_inches, s.arm_length_inches),
  hand_size_inches = coalesce(c.hand_size_inches, s.hand_size_inches),
  draft_overall_pick = coalesce(nullif(c.draft_overall_pick, 0), nullif(s.draft_overall_pick, 0), c.draft_overall_pick),
  draft_round = coalesce(nullif(c.draft_round, 0), nullif(s.draft_round, 0), c.draft_round),
  college = coalesce(c.college, s.college),
  college_division = coalesce(c.college_division, s.college_division),
  nfl_draft_year = coalesce(c.nfl_draft_year, s.nfl_draft_year),
  current_nfl_team = coalesce(c.current_nfl_team, s.current_nfl_team),
  position_depth = coalesce(c.position_depth, s.position_depth),
  jersey_number = coalesce(nullif(c.jersey_number, 0), nullif(s.jersey_number, 0), c.jersey_number),
  draft_capital_points = coalesce(c.draft_capital_points, s.draft_capital_points),
  esb_player_id = coalesce(c.esb_player_id, s.esb_player_id),
  gsis_player_id = coalesce(c.gsis_player_id, s.gsis_player_id),
  smart_player_id = coalesce(c.smart_player_id, s.smart_player_id),
  gsis_it_player_id = coalesce(c.gsis_it_player_id, s.gsis_it_player_id),
  high_school = coalesce(c.high_school, s.high_school),
  sleeper_player_id = coalesce(c.sleeper_player_id, s.sleeper_player_id),
  rotoworld_player_id = coalesce(c.rotoworld_player_id, s.rotoworld_player_id),
  rotowire_player_id = coalesce(c.rotowire_player_id, s.rotowire_player_id),
  sportradar_player_id = coalesce(c.sportradar_player_id, s.sportradar_player_id),
  espn_player_id = coalesce(c.espn_player_id, s.espn_player_id),
  fantasy_data_player_id = coalesce(c.fantasy_data_player_id, s.fantasy_data_player_id),
  yahoo_player_id = coalesce(c.yahoo_player_id, s.yahoo_player_id),
  keeptradecut_player_id = coalesce(c.keeptradecut_player_id, s.keeptradecut_player_id),
  pfr_player_id = coalesce(c.pfr_player_id, s.pfr_player_id),
  ngs_athleticism_score = coalesce(c.ngs_athleticism_score, s.ngs_athleticism_score),
  ngs_draft_grade = coalesce(c.ngs_draft_grade, s.ngs_draft_grade),
  nfl_grade = coalesce(c.nfl_grade, s.nfl_grade),
  ngs_production_score = coalesce(c.ngs_production_score, s.ngs_production_score),
  ngs_size_score = coalesce(c.ngs_size_score, s.ngs_size_score),
  otc_player_id = coalesce(c.otc_player_id, s.otc_player_id),
  contract_year_signed = coalesce(c.contract_year_signed, s.contract_year_signed),
  contract_years = coalesce(c.contract_years, s.contract_years),
  contract_value = coalesce(c.contract_value, s.contract_value),
  contract_apy = coalesce(c.contract_apy, s.contract_apy),
  contract_guaranteed = coalesce(c.contract_guaranteed, s.contract_guaranteed),
  contract_apy_cap_pct = coalesce(c.contract_apy_cap_pct, s.contract_apy_cap_pct),
  contract_inflated_value = coalesce(c.contract_inflated_value, s.contract_inflated_value),
  contract_inflated_apy = coalesce(c.contract_inflated_apy, s.contract_inflated_apy),
  contract_inflated_guaranteed = coalesce(c.contract_inflated_guaranteed, s.contract_inflated_guaranteed),
  pff_player_id = coalesce(c.pff_player_id, s.pff_player_id),
  mfl_player_id = coalesce(c.mfl_player_id, s.mfl_player_id),
  fleaflicker_player_id = coalesce(c.fleaflicker_player_id, s.fleaflicker_player_id),
  cbs_player_id = coalesce(c.cbs_player_id, s.cbs_player_id),
  cfbref_player_id = coalesce(c.cfbref_player_id, s.cfbref_player_id),
  twitter_username = coalesce(c.twitter_username, s.twitter_username),
  swish_player_id = coalesce(c.swish_player_id, s.swish_player_id),
  draftkings_player_id = coalesce(c.draftkings_player_id, s.draftkings_player_id),
  fanduel_player_id = coalesce(c.fanduel_player_id, s.fanduel_player_id),
  rts_player_id = coalesce(c.rts_player_id, s.rts_player_id),
  draft_team = coalesce(c.draft_team, s.draft_team),
  sis_player_id = coalesce(c.sis_player_id, s.sis_player_id),
  sis_prospect_grade = coalesce(c.sis_prospect_grade, s.sis_prospect_grade),
  sis_prospect_position_rank = coalesce(c.sis_prospect_position_rank, s.sis_prospect_position_rank),
  sis_prospect_overall_rank = coalesce(c.sis_prospect_overall_rank, s.sis_prospect_overall_rank),
  all_pro_first_team_selections = coalesce(c.all_pro_first_team_selections, s.all_pro_first_team_selections),
  pro_bowls_selections = coalesce(c.pro_bowls_selections, s.pro_bowls_selections),
  pfr_years_as_primary_starter = coalesce(c.pfr_years_as_primary_starter, s.pfr_years_as_primary_starter),
  pfr_weighted_career_approximate_value = coalesce(c.pfr_weighted_career_approximate_value, s.pfr_weighted_career_approximate_value),
  pfr_weighted_career_approximate_value_drafted_team = coalesce(c.pfr_weighted_career_approximate_value_drafted_team, s.pfr_weighted_career_approximate_value_drafted_team),
  ffpc_player_id = coalesce(c.ffpc_player_id, s.ffpc_player_id),
  nffc_player_id = coalesce(c.nffc_player_id, s.nffc_player_id),
  fantrax_player_id = coalesce(c.fantrax_player_id, s.fantrax_player_id),
  roster_status = coalesce(c.roster_status, s.roster_status),
  game_designation = coalesce(c.game_designation, s.game_designation),
  forty_yard_dash_designation = coalesce(c.forty_yard_dash_designation, s.forty_yard_dash_designation),
  ten_yard_split_seconds = coalesce(c.ten_yard_split_seconds, s.ten_yard_split_seconds),
  ten_yard_split_designation = coalesce(c.ten_yard_split_designation, s.ten_yard_split_designation),
  pro_day_forty_seconds = coalesce(c.pro_day_forty_seconds, s.pro_day_forty_seconds),
  pro_day_forty_designation = coalesce(c.pro_day_forty_designation, s.pro_day_forty_designation),
  sixty_yard_shuttle_seconds = coalesce(c.sixty_yard_shuttle_seconds, s.sixty_yard_shuttle_seconds),
  sixty_yard_shuttle_designation = coalesce(c.sixty_yard_shuttle_designation, s.sixty_yard_shuttle_designation),
  has_combine_attendance = coalesce(c.has_combine_attendance, s.has_combine_attendance),
  hometown = coalesce(c.hometown, s.hometown),
  sumer_player_id = coalesce(c.sumer_player_id, s.sumer_player_id),
  fantasylabs_player_id = coalesce(c.fantasylabs_player_id, s.fantasylabs_player_id),
  underdog_player_id = coalesce(c.underdog_player_id, s.underdog_player_id),
  fantasypoints_player_id = coalesce(c.fantasypoints_player_id, s.fantasypoints_player_id),
  nfl_player_id = CASE WHEN m.carry_nfl_player_id THEN coalesce(c.nfl_player_id, s.nfl_player_id)
                       ELSE c.nfl_player_id END
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
WHERE c.pid = m.keep_pid;

-- Step 10. Write the reconciled fields. Runs AFTER the additive fill so it is the
-- final word: where step 9 carried a donor value into a NULL and the oracle
-- disagrees, the oracle wins. Every changed value is logged first.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT r.keep_pid, v.col, v.prev, v.new,
  'adhoc/2026-08-05-dedupe-residual-round-4',
  'reconciled from nflverse/PFR during duplicate-person merge',
  now()
FROM reconciled r
JOIN player p ON p.pid = r.keep_pid
CROSS JOIN LATERAL (VALUES
  ('nfl_draft_year', p.nfl_draft_year::text, r.nfl_draft_year::text),
  ('draft_round', p.draft_round::text, r.draft_round::text),
  ('draft_overall_pick', p.draft_overall_pick::text, r.draft_overall_pick::text),
  ('primary_position', p.primary_position::text, r.primary_position::text),
  ('secondary_position', p.secondary_position::text, r.secondary_position::text),
  ('college', p.college::text, r.college::text),
  ('height_inches', p.height_inches::text, r.height_inches::text),
  ('weight_pounds', p.weight_pounds::text, r.weight_pounds::text)
) AS v(col, prev, new)
WHERE v.prev IS DISTINCT FROM v.new;

UPDATE player p SET
  nfl_draft_year = r.nfl_draft_year,
  draft_round = r.draft_round,
  draft_overall_pick = r.draft_overall_pick,
  primary_position = r.primary_position,
  secondary_position = r.secondary_position,
  college = r.college,
  height_inches = r.height_inches,
  weight_pounds = r.weight_pounds
FROM reconciled r
WHERE p.pid = r.keep_pid;

-- ---------------------------------------------------------------------------
-- Post-conditions
-- ---------------------------------------------------------------------------
DO $$
DECLARE n int; v text;
BEGIN
  SELECT count(*) INTO n FROM player WHERE pid IN ('GARY-ANDE-006465','ROOS-NIXX-001769');
  IF n <> 0 THEN RAISE EXCEPTION 'expected both donors absent, found %', n; END IF;

  SELECT count(*) INTO n FROM player WHERE pid IN ('GARY-ANDE-016337','ROOS-NIXX-015668');
  IF n <> 2 THEN RAISE EXCEPTION 'expected both survivors present, found %', n; END IF;

  -- the three same-name rows that are NOT part of either merge are untouched
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('GARY-ANDE-005181','GARY-ANDE-016338','ROOS-NIXX-001755');
  IF n <> 3 THEN RAISE EXCEPTION 'a distinct same-name row went missing, found %', n; END IF;

  -- the Will Johnson pair is untouched
  SELECT count(*) INTO n FROM player WHERE pid IN ('WILL-JOHN-016794','WILL-JOHN-024279');
  IF n <> 2 THEN RAISE EXCEPTION 'the Will Johnson non-duplicate pair was modified, found %', n; END IF;

  -- reconciled values landed
  SELECT primary_position INTO v FROM player WHERE pid = 'ROOS-NIXX-015668';
  IF v <> 'FB' THEN RAISE EXCEPTION 'Nix primary_position is % not FB', v; END IF;

  SELECT weight_pounds::text INTO v FROM player WHERE pid = 'ROOS-NIXX-015668';
  IF v <> '248' THEN RAISE EXCEPTION 'Nix weight_pounds is % not 248', v; END IF;

  SELECT draft_round::text INTO v FROM player WHERE pid = 'GARY-ANDE-016337';
  IF v <> '7' THEN RAISE EXCEPTION 'Anderson draft_round is % not 7', v; END IF;

  SELECT nfl_player_id::text INTO v FROM player WHERE pid = 'GARY-ANDE-016337';
  IF v <> '2499425' THEN RAISE EXCEPTION 'Anderson nfl_player_id is % not 2499425', v; END IF;

  -- no position-vocabulary violation was introduced
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('GARY-ANDE-016337','ROOS-NIXX-015668')
     AND (primary_position NOT IN ('QB','RB','WR','TE','OL','DL','LB','DB','K','P','LS','DST','FB','T','G','C','DE','DT','NT','EDGE','OLB','ILB','MLB','CB','S')
       OR secondary_position NOT IN ('QB','RB','WR','TE','OL','DL','LB','DB','K','P','LS','DST','FB','T','G','C','DE','DT','NT','EDGE','OLB','ILB','MLB','CB','S'));
  IF n > 0 THEN RAISE EXCEPTION '% survivors carry a non-canonical position', n; END IF;

  RAISE NOTICE 'post-conditions passed: 2 donors merged, 2 survivors reconciled';
END $$;
