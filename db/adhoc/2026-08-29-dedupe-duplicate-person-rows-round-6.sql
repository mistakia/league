-- STATUS: APPLIED 2026-08-29 against league_production
--
-- Duplicate-person cleanup, round 6. Eleven merges out of eleven candidates.
--
-- Surfaced by the registered check `duplicate-person-rows` (signals 126936 and
-- 127175). The 08-26/08-28 payloads are stale -- the interrupted 08-28 apply
-- (`scripts/merge-duplicate-person-rows.mjs --apply`) already landed fifteen of
-- the twenty-six, and this file finishes the eleven that remained, re-planned
-- from the live population on 2026-08-29. The check now reports only these
-- eleven unparked candidate shells; all eleven are genuine duplicates.
--
-- This is NOT the father/son and namesake class. That class was adjudicated and
-- parked in earlier rounds: the seventeen different-people shells now parked in
-- db/checks/parked.json are asserted absent from this map in step 0. Every shell
-- here pairs with a twin carrying two-plus external identifiers and the
-- `0000-00-00` birth-date sentinel, so there is no pair of real dates to
-- disagree on -- the only real date_of_birth sits on the shell (the donor), and
-- the additive fill in step 9 carries it onto the survivor. Adjudication on
-- date_of_birth, as the check's repair_command specifies, is therefore a
-- present-value-plus-absent-value shape, never two competing dates.
--
--   JOSE-TOLE-018789 -> JOSE-TOLE-024592   T/OL,  Washington,      2006, pick 114
--   KADE-WEST-018835 -> KADE-WEST-010827   DT,     Georgia,         2010, pick 248
--   KEIT-JACK-021983 -> KEIT-JACK-024623   DT/DL, Arkansas,        2007
--   MICH-SIMS-022580 -> MICH-SIMS-014170   WR,     UCF,             2007
--   PRIN-DANI-022921 -> PRIN-DANI-012236   RB,     Georgia Tech,    2006
--   QUAN-STUR-010412 -> QUAN-STUR-023036   LB,     North Carolina,  2011, pick 171
--   QUIN-MOND-013711 -> QUIN-MOND-023057   S,      Auburn,          2022
--   ROBE-HEND-010615 -> ROBE-HEND-023269   DE,     Southern Miss.,  2008, pick 199
--   STON-WOOD-023914 -> STON-WOOD-023904   CB/DB,  South Carolina,  2009
--   TERR-TAYL-024028 -> TERR-TAYL-024719   DT,     Michigan,        2009
--   WILR-FONT-024477 -> WILR-FONT-015112   CB,     Arizona,         2008
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.
--
-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------
--
-- Every pair agrees on formatted_name, college, nfl_draft_year and position
-- family, with near-identical measurables. One side (the donor) is a pure shell:
-- zero external identifiers, the real date_of_birth, and one player_changelog
-- row and nothing else. The other side (the survivor) holds the external
-- identifiers (gsis and esb at least) and the `0000-00-00` birth-date sentinel.
-- These are the split-person duplicates this class is defined to repair -- a
-- legacy biography row and a later id-bearing row for the SAME person that an
-- importer could not match onto each other. The shells' real draft pick, where
-- present, corroborates the identity independently of the date.
--
-- JOSE-TOLE-018789 + JOSE-TOLE-024592
--   Washington OT. Survivor holds gsis 00-0024329 / esb TOL276528; shell holds
--   1982-10-20 and draft_overall_pick 114 (2006 4th round, Tennessee). Same
--   draft year 2006 and college. Position reads T against OL -- the same
--   position under two vocabularies. Measurables 77/332 against 78/337.
--
-- KADE-WEST-018835 + KADE-WEST-010827
--   Georgia DT, 2010 entry. Survivor holds gsis 00-0027839 / esb WES750982;
--   shell holds 1986-11-29 and draft_overall_pick 248 (2006... no -- 2010 7th
--   round). Measurables 77/315 against 77/317. The shell is the survivor in the
--   interactive plan (it holds one more changelog reference) but here the
--   gsis-bearing row is kept and the shell folded, which is lossless and keeps
--   the canonical identifiers on the surviving pid.
--
-- KEIT-JACK-021983 + KEIT-JACK-024623
--   Arkansas DT, 2007 entry. Survivor holds gsis 00-0025635 / esb JAC283632;
--   shell holds 1985-02-25. Measurables 72/315 against 72/305. Position DT/DL.
--
-- MICH-SIMS-022580 + MICH-SIMS-014170
--   UCF WR, 2007 entry. Survivor holds gsis 00-0025466 / esb WAL281506; shell
--   holds 1984-11-21. Identical measurables 74/209.
--
-- PRIN-DANI-022921 + PRIN-DANI-012236
--   Georgia Tech RB, 2006 entry. Survivor holds gsis 00-0024346 / esb DAN579136;
--   shell holds 1982-12-21 (short_name "P.Daniels Jr."). Measurables 70/210
--   against 70/214.
--
-- QUAN-STUR-010412 + QUAN-STUR-023036
--   North Carolina LB, 2011 entry. Survivor holds gsis 00-0028109 / esb
--   STU626066; shell holds 1988-12-05 and draft_overall_pick 171 (6th round).
--   Identical measurables 73/241.
--
-- QUIN-MOND-013711 + QUIN-MOND-023057
--   Auburn S, 2022 entry. Survivor holds gsis 00-0037540 / esb MON123542; shell
--   holds 2000-02-19. Measurables 75/199 against 74/207.
--
-- ROBE-HEND-010615 + ROBE-HEND-023269
--   Southern Mississippi DE, 2008 entry. Survivor holds gsis 00-0026339 / esb
--   HEN130264; shell holds 1983-11-09 and draft_overall_pick 199 (6th round).
--   Identical measurables 75/278.
--
-- STON-WOOD-023914 + STON-WOOD-023904
--   South Carolina CB, 2009 entry. Survivor holds gsis 00-0026954 / esb
--   WOO705782; shell holds 1985-10-11 (short_name "S.Woodson Jr."). Measurables
--   70/198 against 71/197. Position CB/DB.
--
-- TERR-TAYL-024028 + TERR-TAYL-024719
--   Michigan DT, 2009 entry. Survivor holds gsis 00-0027100 / esb TAY720600;
--   shell holds 1986-05-14. Measurables 72/319 against 72/306.
--
-- WILR-FONT-024477 + WILR-FONT-015112
--   Arizona CB, 2008 entry. Survivor holds gsis 00-0026352 / esb FON434790;
--   shell holds 1984-10-14. Measurables 70/169 against 69/171.
--
-- In every pair the two rows could not be more clearly the same person, and
-- none of the eleven pairs joins on a date gap of more than a few years -- the
-- sentinel on the survivor means there is no second real date to distance the
-- two rows. Cluster size was checked, not assumed: no shell in this map pairs
-- with more than one twin (each would have refused as NOT_ONE_TWIN), and no
-- pid appears on both sides or in the parked set.
--
-- ---------------------------------------------------------------------------
-- A note on why step 9 is generated rather than written out
-- ---------------------------------------------------------------------------
--
-- Round 4 spelled its additive fill as a hand-written list of ninety-odd
-- columns. Three of those column names no longer exist: `contract_apy`,
-- `contract_apy_cap_pct` and `contract_inflated_apy` were renamed to
-- `contract_average_annual_value`, `contract_average_annual_value_cap_percentage`
-- and `contract_inflated_average_annual_value` by a later conform. Copying that
-- list forward would fail on three columns, and -- worse -- a hand-written list
-- silently STOPS CARRYING any column added to `player` after it was written, so
-- a new identifier column would be dropped on the floor by every future merge
-- with no error at all. Step 9 is therefore generated from the catalog, exactly
-- as steps 5, 6 and 7 already are. This file follows round 5's shape, not round
-- 4's for exactly that reason.

-- The server sets statement_timeout to 40s, which is not enough for step 5.
-- That step probes every UNIQUE index carrying `pid` with a correlated EXISTS,
-- and the ones on the large odds tables take longer than that even though they
-- match nothing here. See round 5's header for the measured detail.
--
-- lock_timeout is set in the same breath and deliberately NOT left at 0. Once a
-- statement is queued for a lock it blocks every new reader behind it, so an
-- unbounded wait to ACQUIRE is strictly worse than failing; 30s to acquire and
-- unlimited to execute is the asymmetry that is wanted. Both are
-- transaction-local and revert when db:exec's transaction ends.
SET lock_timeout = '30s';
SET statement_timeout = 0;

CREATE TEMP TABLE merge_map (
  drop_pid varchar NOT NULL PRIMARY KEY,
  keep_pid varchar NOT NULL
) ON COMMIT DROP;

-- Survivor rule, unchanged from rounds 2 through 5: most dependent rows, then
-- most identifiers, then lower serial. Every survivor here holds the external
-- identifiers, which is the canonical half of each pair; the folded shell holds
-- at most a single player_changelog reference. Measured reference counts:
--   JOSE-TOLE-024592  16 rows   vs  018789  1 row
--   KADE-WEST-010827   0 rows   vs  018835  1 row   (id-row kept for canonical ids)
--   KEIT-JACK-024623  18 rows   vs  021983  1 row
--   MICH-SIMS-014170  13 rows   vs  022580  1 row
--   PRIN-DANI-012236  13 rows   vs  022921  1 row
--   QUAN-STUR-023036  18 rows   vs  010412  1 row
--   QUIN-MOND-023057  14 rows   vs  013711  1 row
--   ROBE-HEND-023269   0 rows   vs  010615  1 row   (id-row kept for canonical ids)
--   STON-WOOD-023904   0 rows   vs  023914  1 row   (id-row kept for canonical ids)
--   TERR-TAYL-024719  18 rows   vs  024028  1 row
--   WILR-FONT-015112  18 rows   vs  024477  1 row
-- For the three pairs where the shell out-references the id-row, the id-row is
-- kept anyway so the canonical gsis/esb identifiers survive on the kept pid; the
-- fold is lossless in either direction because step 9 additively fills whatever
-- the survivor lacks from the shell's snapshot.
INSERT INTO merge_map (drop_pid, keep_pid) VALUES
  ('JOSE-TOLE-018789', 'JOSE-TOLE-024592'),
  ('KADE-WEST-018835', 'KADE-WEST-010827'),
  ('KEIT-JACK-021983', 'KEIT-JACK-024623'),
  ('MICH-SIMS-022580', 'MICH-SIMS-014170'),
  ('PRIN-DANI-022921', 'PRIN-DANI-012236'),
  ('QUAN-STUR-010412', 'QUAN-STUR-023036'),
  ('QUIN-MOND-013711', 'QUIN-MOND-023057'),
  ('ROBE-HEND-010615', 'ROBE-HEND-023269'),
  ('STON-WOOD-023914', 'STON-WOOD-023904'),
  ('TERR-TAYL-024028', 'TERR-TAYL-024719'),
  ('WILR-FONT-024477', 'WILR-FONT-015112');

-- Step 0. Refuse to run against a database this map was not built for.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 11 THEN RAISE EXCEPTION 'expected 11 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 11 THEN RAISE EXCEPTION 'expected 11 distinct survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m JOIN merge_map x ON x.drop_pid = m.keep_pid;
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion', n; END IF;

  -- The seventeen adjudicated NON-duplicates. These are different people and a
  -- merge would be unrecoverable, so the map is refused outright if one appears
  -- on either side. This is the parked set for `duplicate-person-rows` in
  -- db/checks/parked.json as of 2026-08-29 (17 entries; round 5 listed 19 and
  -- two of those -- BRIA-SMIT-010600 and CHRI-JONE-019749 -- have since been
  -- removed from the live candidate population and are not parked).
  SELECT count(*) INTO n FROM merge_map
   WHERE drop_pid IN ('ANTH-CHIC-005743','ANTH-DORS-005314','ARTH-JONE-005199','CHAR-JOHN-008165',
                      'CHRI-JONE-019714','CLAR-WILL-019775','CURT-YOUN-019847','DANI-GRAY-012020',
                      'DAVI-JONE-008821','DAVI-JONE-008822','GARY-JOHN-012209','MICH-HOLM-013452',
                      'MICH-ZORD-013513','REGI-JONE-023090','STEV-JACK-014426','THOM-GRAH-014723',
                      'WILL-GLAS-024423')
      OR keep_pid IN ('ANTH-CHIC-005743','ANTH-DORS-005314','ARTH-JONE-005199','CHAR-JOHN-008165',
                      'CHRI-JONE-019714','CLAR-WILL-019775','CURT-YOUN-019847','DANI-GRAY-012020',
                      'DAVI-JONE-008821','DAVI-JONE-008822','GARY-JOHN-012209','MICH-HOLM-013452',
                      'MICH-ZORD-013513','REGI-JONE-023090','STEV-JACK-014426','THOM-GRAH-014723',
                      'WILL-GLAS-024423');
  IF n > 0 THEN RAISE EXCEPTION 'map contains a pid adjudicated as a DIFFERENT PERSON -- refusing'; END IF;

  -- Pids reserved to other lines of work by rounds 3 and 4.
  SELECT count(*) INTO n FROM merge_map
   WHERE drop_pid IN ('CLEV-HARR-002939','CLEV-HARR-007173','MARV-LEWI-006866','CURT-THOM-008802',
                      'DERW-WILL-020031','ANTH-DAVI-018663','JASO-PHIL-004707')
      OR keep_pid IN ('CLEV-HARR-002939','CLEV-HARR-007173','MARV-LEWI-006866','CURT-THOM-008802',
                      'DERW-WILL-020031','ANTH-DAVI-018663','JASO-PHIL-004707');
  IF n > 0 THEN RAISE EXCEPTION 'map contains a pid reserved to another line of work'; END IF;

  -- Each pair must still agree on the anchor that identified it. A map that has
  -- drifted onto rows whose college or entry year no longer match is stale.
  SELECT count(*) INTO n
    FROM merge_map m
    JOIN player d ON d.pid = m.drop_pid
    JOIN player k ON k.pid = m.keep_pid
   WHERE d.college IS DISTINCT FROM k.college
      OR d.nfl_draft_year IS DISTINCT FROM k.nfl_draft_year;
  IF n > 0 THEN RAISE EXCEPTION '% pairs no longer agree on college and entry year -- map is stale', n; END IF;

  -- Every donor must still be a shell. If one has acquired an identifier since
  -- adjudication it is no longer the row this file adjudicated.
  SELECT count(*) INTO n
    FROM merge_map m JOIN player d ON d.pid = m.drop_pid
   WHERE num_nonnulls(d.cbs_player_id, d.cfbref_player_id, d.draftkings_player_id, d.esb_player_id,
                      d.espn_player_id, d.fanduel_player_id, d.fantasy_data_player_id,
                      d.fantasylabs_player_id, d.fantasypoints_player_id, d.fantrax_player_id,
                      d.ffpc_player_id, d.fleaflicker_player_id, d.gsis_it_player_id,
                      d.gsis_player_id, d.keeptradecut_player_id, d.mfl_player_id, d.nffc_player_id,
                      d.nfl_player_id, d.otc_player_id, d.pff_player_id, d.pfr_player_id,
                      d.rotowire_player_id, d.rotoworld_player_id, d.rts_player_id, d.sis_player_id,
                      d.sleeper_player_id, d.smart_player_id, d.sportradar_player_id,
                      d.sumer_player_id, d.swish_player_id, d.underdog_player_id,
                      d.yahoo_player_id) <> 0;
  IF n > 0 THEN RAISE EXCEPTION '% donor rows now hold an external identifier -- re-adjudicate', n; END IF;
END $$;

-- Step 1. Snapshot every row about to be deleted. Everything after this reads
-- the deleted rows from here, never from `player`, so the fill in step 9 still
-- works after the delete in step 8.
CREATE TEMP TABLE drop_snapshot ON COMMIT DROP AS
SELECT p.* FROM player p JOIN merge_map m ON m.drop_pid = p.pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM drop_snapshot;
  IF n <> 11 THEN RAISE EXCEPTION 'expected 11 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone, and it is what preserves the shells'
-- real birth dates and the four draft picks noted in the evidence above.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-29-dedupe-duplicate-person-rows-round-6',
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
  'adhoc/2026-08-29-dedupe-duplicate-person-rows-round-6',
  'duplicate-person row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Assert the gamelog-collision trap is absent. Every donor in this set
-- is a shell with no gamelogs at all -- the check's own predicate requires it --
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

-- Step 5. Drop the donor rows that would collide once re-pointed. Driven off
-- the live unique indexes rather than a hand-written table list, so an index
-- added since this file was written is still respected.
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

-- Step 8. Drop the duplicate rows, releasing their identifiers from every
-- UNIQUE index before those identifiers are written onto the survivors in
-- step 9.
DELETE FROM player p USING merge_map m WHERE p.pid = m.drop_pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.drop_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% duplicate rows survived the delete', n; END IF;
END $$;

-- Step 9. Fill every column the survivor is missing, from the snapshot. Purely
-- additive: coalesce never overwrites a value the survivor already holds, so no
-- adjudication between two competing non-null values happens here.
--
-- Generated from the catalog rather than written out -- see the note in the
-- header for why. Three columns carry a non-NULL empty value and need the
-- sentinel made absent first, or a bare coalesce keeps the sentinel and discards
-- a real value:
--   date_of_birth       varchar whose absent value is the string '0000-00-00'
--   draft_overall_pick  0 is the empty value, not NULL
--   draft_round         0 is the empty value, not NULL
--   jersey_number       0 is the empty value, not NULL
-- `pid` is excluded because it is the join key, and `name_search_vector` because
-- it is derived from the name columns rather than carried.
DO $$
DECLARE assignments text; n int;
BEGIN
  SELECT string_agg(
    CASE
      WHEN c.column_name = 'date_of_birth'
        THEN format('%1$I = coalesce(nullif(c.%1$I, %2$L), nullif(s.%1$I, %2$L), c.%1$I)',
                    c.column_name, '0000-00-00')
      WHEN c.column_name IN ('draft_overall_pick', 'draft_round', 'jersey_number')
        THEN format('%1$I = coalesce(nullif(c.%1$I, 0), nullif(s.%1$I, 0), c.%1$I)', c.column_name)
      ELSE format('%1$I = coalesce(c.%1$I, s.%1$I)', c.column_name)
    END, ', ' ORDER BY c.ordinal_position)
  INTO assignments
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'player'
    AND c.column_name NOT IN ('pid', 'name_search_vector')
    AND c.is_generated = 'NEVER';

  -- A generator that resolved nothing would make this step a silent no-op, so
  -- assert it found the column set before executing it.
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'player'
     AND column_name NOT IN ('pid', 'name_search_vector') AND is_generated = 'NEVER';
  IF n < 80 THEN RAISE EXCEPTION 'expected at least 80 fillable player columns, resolved % -- the generator is not seeing the table', n; END IF;
  RAISE NOTICE 'step 9: filling % columns additively', n;

  EXECUTE format(
    'UPDATE player c SET %s FROM drop_snapshot s JOIN merge_map m ON m.drop_pid = s.pid WHERE c.pid = m.keep_pid',
    assignments);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 11 THEN RAISE EXCEPTION 'expected 11 survivors filled, got %', n; END IF;
END $$;

-- Step 10. Post-conditions. The eleven survivors remain, the eleven donors are
-- gone, and each survivor now carries the birth date its pair established.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('JOSE-TOLE-024592','KADE-WEST-010827','KEIT-JACK-024623','MICH-SIMS-014170',
                 'PRIN-DANI-012236','QUAN-STUR-023036','QUIN-MOND-023057','ROBE-HEND-023269',
                 'STON-WOOD-023904','TERR-TAYL-024719','WILR-FONT-015112');
  IF n <> 11 THEN RAISE EXCEPTION 'expected 11 survivors present, got %', n; END IF;

  SELECT count(*) INTO n FROM player
   WHERE pid IN ('JOSE-TOLE-018789','KADE-WEST-018835','KEIT-JACK-021983','MICH-SIMS-022580',
                 'PRIN-DANI-022921','QUAN-STUR-010412','QUIN-MOND-013711','ROBE-HEND-010615',
                 'STON-WOOD-023914','TERR-TAYL-024028','WILR-FONT-024477');
  IF n <> 0 THEN RAISE EXCEPTION 'expected 0 donors present, got %', n; END IF;

  -- Every survivor held the '0000-00-00' sentinel before the merge and must now
  -- hold a real date carried from its shell. A fill that silently did nothing
  -- must fail the run.
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('JOSE-TOLE-024592','KADE-WEST-010827','KEIT-JACK-024623','MICH-SIMS-014170',
                 'PRIN-DANI-012236','QUAN-STUR-023036','QUIN-MOND-023057','ROBE-HEND-023269',
                 'STON-WOOD-023904','TERR-TAYL-024719','WILR-FONT-015112')
     AND (date_of_birth IS NULL OR date_of_birth = '0000-00-00');
  IF n <> 0 THEN RAISE EXCEPTION '% survivors still carry no birth date after the fill', n; END IF;

  -- The four drafts picks this merge exists to carry (Joseph Toledo #114, Kade
  -- Weston #248, Quan Sturdivant #171, Robert Henderson #199).
  SELECT count(*) INTO n FROM player
   WHERE (pid = 'JOSE-TOLE-024592' AND draft_overall_pick = 114)
      OR (pid = 'KADE-WEST-010827' AND draft_overall_pick = 248)
      OR (pid = 'QUAN-STUR-023036' AND draft_overall_pick = 171)
      OR (pid = 'ROBE-HEND-023269' AND draft_overall_pick = 199);
  IF n <> 4 THEN RAISE EXCEPTION 'expected 4 draft picks carried across, got %', n; END IF;

  -- The check that surfaced this set must now return exactly the seventeen
  -- adjudicated-and-parked rows and nothing else. Recomputing its predicate
  -- here is what turns "the merge ran" into "the finding is gone".
  WITH id_counts AS (
    SELECT p.pid, p.formatted_name, p.college,
      num_nonnulls(p.cbs_player_id, p.cfbref_player_id, p.draftkings_player_id, p.esb_player_id,
                   p.espn_player_id, p.fanduel_player_id, p.fantasy_data_player_id,
                   p.fantasylabs_player_id, p.fantasypoints_player_id, p.fantrax_player_id,
                   p.ffpc_player_id, p.fleaflicker_player_id, p.gsis_it_player_id, p.gsis_player_id,
                   p.keeptradecut_player_id, p.mfl_player_id, p.nffc_player_id, p.nfl_player_id,
                   p.otc_player_id, p.pff_player_id, p.pfr_player_id, p.rotowire_player_id,
                   p.rotoworld_player_id, p.rts_player_id, p.sis_player_id, p.sleeper_player_id,
                   p.smart_player_id, p.sportradar_player_id, p.sumer_player_id, p.swish_player_id,
                   p.underdog_player_id, p.yahoo_player_id) AS id_count
    FROM player p
  ),
  shells AS (
    SELECT c.* FROM id_counts c
    WHERE c.id_count = 0 AND NOT EXISTS (SELECT 1 FROM player_gamelogs g WHERE g.pid = c.pid)
  )
  SELECT count(DISTINCT s.pid) INTO n
  FROM shells s
  JOIN id_counts k ON k.formatted_name = s.formatted_name AND k.pid <> s.pid AND k.id_count >= 2
   AND (k.college = s.college OR k.college IS NULL OR s.college IS NULL);
  IF n <> 17 THEN RAISE EXCEPTION 'duplicate-person-rows should return exactly the 17 parked rows after this merge, got %', n; END IF;
END $$;
