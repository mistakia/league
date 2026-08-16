-- STATUS: APPLIED 2026-08-16 against league_production
--
-- Duplicate-person cleanup, round 5. Five merges out of twenty-four candidates.
--
-- Surfaced by the registered check `duplicate-person-rows` (signal 125615),
-- which reported 24 findings. NINETEEN OF THOSE TWENTY-FOUR ARE DIFFERENT
-- PEOPLE and are parked as adjudicated in db/checks/parked.json rather than
-- merged here -- father/son and namesake pairs decades apart, which the
-- predicate joins because it asks only that the second row hold zero external
-- identifiers, and every thin historical row satisfies that. Step 0 asserts
-- none of the nineteen can appear in this map.
--
--   DONA-SHOC-020327 -> DONA-SHOC-003116   QB, Georgia, 2006 entry
--   JOHN-BOOT-005866 -> JOHN-BOOT-021604   QB, USC, 2008 draft pick 137
--   MAXX-DUFF-022473 -> MAXX-DUFF-022597   P,  Kentucky, 2021 entry
--   POOK-WILL-022915 -> POOK-WILL-006776   RB, Kansas, 2021 entry
--   REGG-RUSK-007449 -> REGG-RUSK-019199   DB, Kentucky, 1996 draft pick 221
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.
--
-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------
--
-- Every pair agrees on last name, college, entry year and position family while
-- one side is a pure shell: zero external identifiers, no gamelogs, and one to
-- three player_changelog rows and nothing else. Each was adjudicated on
-- date_of_birth, which is what the check's repair_command specifies and what
-- separates these five from the nineteen parked ones -- there the two dates sit
-- 15 to 50 years apart, and here they agree, are absent on one side, or differ
-- in a way an independent field contradicts.
--
-- DONA-SHOC-020327 + DONA-SHOC-003116
--   Both QB, Georgia, nfl_draft_year 2006, 72/218 against 73/214. The survivor
--   carries the '0000-00-00' sentinel for date_of_birth; the shell holds
--   1983-03-23, so there is no conflicting pair of dates, only a present value
--   and an absent one. Nothing else on either row disagrees.
--
-- JOHN-BOOT-005866 + JOHN-BOOT-021604
--   Both QB, USC, nfl_draft_year 2008, 75/208 against 74/218. The shell holds
--   both the birth date (1985-01-03) and draft_overall_pick 137; the survivor
--   holds neither. Again an absent value rather than a conflicting one, and the
--   shell's pick is a fact the survivor is simply missing.
--
-- MAXX-DUFF-022473 + MAXX-DUFF-022597
--   Kentucky, nfl_draft_year 2021, and IDENTICAL measurables on both rows --
--   73 inches and 196 pounds. Two different people sharing a college, an entry
--   year, a surname and both measurables exactly is not a shape this table
--   produces. The survivor carries the sentinel date; the shell holds
--   1993-04-11. The positions differ as K against P, which is a specialist
--   label rather than an identity: the survivor's P is kept.
--
-- POOK-WILL-022915 + POOK-WILL-006776
--   Both RB, Kansas, nfl_draft_year 2021, 70/170 against 69/175. Here the SHELL
--   carries the sentinel and the survivor holds 1999-06-19, so the merge adds no
--   date at all. The survivor already holds fourteen identifiers.
--
-- REGG-RUSK-007449 + REGG-RUSK-019199
--   Kentucky, nfl_draft_year 1996, IDENTICAL measurables (70/190), and -- the
--   deciding field -- draft_overall_pick 221 on BOTH rows. One selection cannot
--   belong to two people, and the check's sibling `nickname-legal-name-
--   duplicate-rows` names a shared draft_overall_pick as the strongest positive
--   same-person evidence available in this table. Positions read S and DB,
--   which is the same position under two vocabularies.
--
--   THIS IS THE ONE PAIR WHERE THE TWO BIRTH DATES GENUINELY CONFLICT:
--   1972-12-19 on the shell against 1972-10-19 on the survivor. They agree on
--   the year and the day and differ by two months, which is the shape of a
--   transcription error rather than of two people, and the shared draft pick
--   settles the identity independently of the date. NO ORACLE WAS CONSULTED TO
--   DECIDE WHICH MONTH IS CORRECT. The additive fill in step 9 never overwrites
--   a value the survivor already holds, so 1972-10-19 stands -- by default, not
--   by evidence. The shell's 1972-12-19 is preserved in player_changelog by
--   step 2 and can be recovered if an oracle later says otherwise. Flagged here
--   rather than silently resolved.
--
-- Cluster size was checked, not assumed. No third row shares any survivor's
-- (formatted_name, college) and no survivor appears in the parked set.
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
-- as steps 5, 6 and 7 already are.

-- The server sets statement_timeout to 40s, which is not enough for step 5.
-- That step probes every UNIQUE index carrying `pid` with a correlated EXISTS,
-- and the ones on the large odds tables -- `props` is the first to blow the
-- budget -- take longer than that even though they match nothing here, because
-- the cost is in the scan rather than in the rows deleted. Measured: a dry run
-- without this was cancelled inside the `props` delete.
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

-- Survivor rule, unchanged from rounds 2 through 4: most dependent rows, then
-- most identifiers, then lower serial. Every survivor wins on the first two by
-- a wide margin -- measured across all 78 pid-bearing tables:
--   DONA-SHOC-003116  1,937 rows, 4 ids   vs  020327      1 row, 0 ids
--   JOHN-BOOT-021604  1,007 rows, 5 ids   vs  005866      1 row, 0 ids
--   MAXX-DUFF-022597    193 rows, 4 ids   vs  022473      1 row, 0 ids
--   POOK-WILL-006776    815 rows, 14 ids  vs  022915      1 row, 0 ids
--   REGG-RUSK-019199     11 rows, 4 ids   vs  007449      3 rows, 0 ids
-- The shells' only dependent rows are their own player_changelog entries.
INSERT INTO merge_map (drop_pid, keep_pid) VALUES
  ('DONA-SHOC-020327', 'DONA-SHOC-003116'),
  ('JOHN-BOOT-005866', 'JOHN-BOOT-021604'),
  ('MAXX-DUFF-022473', 'MAXX-DUFF-022597'),
  ('POOK-WILL-022915', 'POOK-WILL-006776'),
  ('REGG-RUSK-007449', 'REGG-RUSK-019199');

-- Step 0. Refuse to run against a database this map was not built for.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 5 THEN RAISE EXCEPTION 'expected 5 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 5 THEN RAISE EXCEPTION 'expected 5 distinct survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m JOIN merge_map x ON x.drop_pid = m.keep_pid;
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion', n; END IF;

  -- The nineteen adjudicated NON-duplicates. These are different people and a
  -- merge would be unrecoverable, so the map is refused outright if one appears
  -- on either side. This list is the parked set for `duplicate-person-rows` in
  -- db/checks/parked.json as of 2026-08-16.
  SELECT count(*) INTO n FROM merge_map
   WHERE drop_pid IN ('ANTH-CHIC-005743','ANTH-DORS-005314','ARTH-JONE-005199','BRIA-SMIT-010600',
                      'CHAR-JOHN-008165','CHRI-JONE-019714','CHRI-JONE-019749','CLAR-WILL-019775',
                      'CURT-YOUN-019847','DANI-GRAY-012020','DAVI-JONE-008821','DAVI-JONE-008822',
                      'GARY-JOHN-012209','MICH-HOLM-013452','MICH-ZORD-013513','REGI-JONE-023090',
                      'STEV-JACK-014426','THOM-GRAH-014723','WILL-GLAS-024423')
      OR keep_pid IN ('ANTH-CHIC-005743','ANTH-DORS-005314','ARTH-JONE-005199','BRIA-SMIT-010600',
                      'CHAR-JOHN-008165','CHRI-JONE-019714','CHRI-JONE-019749','CLAR-WILL-019775',
                      'CURT-YOUN-019847','DANI-GRAY-012020','DAVI-JONE-008821','DAVI-JONE-008822',
                      'GARY-JOHN-012209','MICH-HOLM-013452','MICH-ZORD-013513','REGI-JONE-023090',
                      'STEV-JACK-014426','THOM-GRAH-014723','WILL-GLAS-024423');
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
  IF n <> 5 THEN RAISE EXCEPTION 'expected 5 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone, and it is what preserves the REGG-RUSK
-- shell's 1972-12-19 birth date noted in the evidence above.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-16-dedupe-duplicate-person-rows-round-5',
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
  'adhoc/2026-08-16-dedupe-duplicate-person-rows-round-5',
  'duplicate-person row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Assert the gamelog-collision trap is absent. Round 2 needed a
-- column-wise COALESCE rescue here. Every donor in this set is a shell with no
-- gamelogs at all -- the check's own predicate requires it -- but the assertion
-- is what makes that a fact rather than an inherited claim.
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
  IF n <> 5 THEN RAISE EXCEPTION 'expected 5 survivors filled, got %', n; END IF;
END $$;

-- Step 10. Post-conditions. The five survivors remain, the five donors are gone,
-- and each survivor now carries the birth date its pair established.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('DONA-SHOC-003116','JOHN-BOOT-021604','MAXX-DUFF-022597','POOK-WILL-006776','REGG-RUSK-019199');
  IF n <> 5 THEN RAISE EXCEPTION 'expected 5 survivors present, got %', n; END IF;

  SELECT count(*) INTO n FROM player
   WHERE pid IN ('DONA-SHOC-020327','JOHN-BOOT-005866','MAXX-DUFF-022473','POOK-WILL-022915','REGG-RUSK-007449');
  IF n <> 0 THEN RAISE EXCEPTION 'expected 0 donors present, got %', n; END IF;

  -- The three survivors that held the '0000-00-00' sentinel must now hold a real
  -- date carried from their shell. This is the whole point of the merge for
  -- those pairs, so a fill that silently did nothing must fail the run.
  SELECT count(*) INTO n FROM player
   WHERE pid IN ('DONA-SHOC-003116','JOHN-BOOT-021604','MAXX-DUFF-022597')
     AND (date_of_birth IS NULL OR date_of_birth = '0000-00-00');
  IF n <> 0 THEN RAISE EXCEPTION '% survivors still carry no birth date after the fill', n; END IF;

  -- JOHN-BOOT's draft pick is the other value this merge exists to carry.
  SELECT count(*) INTO n FROM player
   WHERE pid = 'JOHN-BOOT-021604' AND draft_overall_pick = 137;
  IF n <> 1 THEN RAISE EXCEPTION 'JOHN-BOOT-021604 did not receive draft_overall_pick 137'; END IF;

  -- The check that surfaced this set must now return exactly the nineteen
  -- adjudicated rows and nothing else. Recomputing its predicate here is what
  -- turns "the merge ran" into "the finding is gone".
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
  IF n <> 19 THEN RAISE EXCEPTION 'duplicate-person-rows should return exactly the 19 parked rows after this merge, got %', n; END IF;
END $$;
