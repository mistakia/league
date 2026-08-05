-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Residual duplicate-person and orphan-row cleanup, round 3. Three independent
-- pieces of work in one file, all reading the same verified artifact set in
-- scratch/dedupe-residual-round-3/:
--
--   A. 48 duplicate-PERSON merges, plus a reconciliation of the six fields the
--      operator directed be driven from nflverse/PFR rather than from either row.
--   B. Two confirmed NON-duplicates whose rows carry each other's values.
--   C. Orphan pids: 34 re-pointed, 383 rows deleted, 5 draft picks de-attributed,
--      21 composite pids deliberately left orphaned.
--
-- The merge set was presented to the operator in full and approved. This file
-- changes nothing about that set: 48 pairs in, 48 pairs merged. Independent
-- re-verification against production before writing this file found the two
-- traps the handoff said to re-check are both still absent -- ZERO
-- player_gamelogs collisions between the two sides of any pair, and ZERO third
-- rows sharing any survivor's (last name, birth date), so no pairwise merge can
-- leave a survivor still duplicated.
--
-- Deliberately NOT touched: CLEV-HARR-002939 / CLEV-HARR-007173 (a sibling
-- session owns that pair), and the five conflated-identity referrals, which are
-- one league row resolving to two different nflverse people and are recorded as
-- observations on the repair-name-match-play-stat-misattribution task instead.
--
-- Backup: every row this file reads or writes -- 12,122 rows across 27 tables
-- plus 100 player rows -- is in
-- scratch/dedupe-residual-round-3/2026-08-05-dedupe-round3-backup.jsonl.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

-- ---------------------------------------------------------------------------
-- PART A -- 48 duplicate-person merges
-- ---------------------------------------------------------------------------
--
-- Survivor rule (unchanged from round 2): most dependent rows, then most
-- identifiers, then lower serial. 432 donor rows re-point; 2,504 survivor rows
-- are untouched.
--
-- Evidence, per the approval gate: 30 pairs have both sides resolving through
-- DIFFERENT identifier types to ONE nflverse person; the other 18 have one side
-- resolving and the other's biography matching that same nflverse record. Zero
-- pairs resolve to two different people.
--
-- Ordering is mandatory and is why this file is shaped the way it is. `player`
-- carries 31 unique indexes, `player_nfl_player_id_unique` among them, so
-- copying an identifier onto the survivor while the donor still holds it puts
-- two rows at one value for the duration of the statement. Snapshot, re-point,
-- DELETE, then fill from the snapshot.
--
-- nfl_player_id era gate. 31 of the 48 merges carry an nfl_player_id. None lands
-- inside the sparse 2508600-2530400 zone -- asserted in step 0 rather than
-- assumed. Each carry was additionally gated by predicting an entry year from
-- the 60 nearest nfl_player_id neighbours and comparing it against nflverse's
-- own rookie_season for the resolved person. 29 agree within five years; two do
-- not and are withheld:
--   * Bryan Barker  -- neighbours predict 1996, nflverse rookie_season 1990
--   * Mark Royals   -- neighbours predict 1997, nflverse rookie_season 1987
-- Both are long-career punters whose ids were plausibly assigned late rather
-- than at debut, so the gap is likely an artifact -- but the value is preserved
-- in player_changelog by step 2 either way, so withholding costs nothing.
--
-- Note the gate was run against nflverse rookie_season, NOT against date of
-- birth plus 22. This population is overwhelmingly punters, kickers and 1940s-60s
-- quarterbacks -- late NFL entrants, for whom birth-year-plus-22 is a poor
-- expectation. The dob+22 form flags 7 of the 31; the rookie_season form flags 2,
-- and inspection of the other 5 shows each is a late entrant, not a hijack.

CREATE TEMP TABLE merge_map (
  drop_pid varchar NOT NULL PRIMARY KEY,
  keep_pid varchar NOT NULL,
  carry_nfl_player_id boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO merge_map (drop_pid, keep_pid, carry_nfl_player_id) VALUES
  ('ALEX-SULF-000367', 'ALEX-SULF-000369', true),
  ('ANDY-GROO-001851', 'ANDY-GROO-000510', true),
  ('ANTH-ADAM-000016', 'ANTH-ADAM-016932', true),
  ('ANTH-ALAB-017035', 'ANTH-ALAB-000928', true),
  ('BILL-LAFL-019028', 'BILL-LAFL-001165', true),
  ('BRIA-MOOR-017317', 'BRIA-MOOR-000764', true),
  ('BRYA-BARK-019389', 'BRYA-BARK-000064', false),
  ('CHAR-JOHN-000485', 'CHAR-JOHN-019634', true),
  ('CHRI-EDMO-019710', 'CHRI-EDMO-001267', true),
  ('CORB-LACI-002497', 'CORB-LACI-017939', true),
  ('DAMI-ROBI-018136', 'DAMI-ROBI-018058', true),
  ('DANT-PAST-000648', 'DANT-PAST-019921', true),
  ('DARR-BENN-019959', 'DARR-BENN-000073', true),
  ('DERR-FROS-020178', 'DERR-FROS-001484', true),
  ('DHAN-JONE-018393', 'DHAN-JONE-009524', true),
  ('DONA-HORN-000459', 'DONA-HORN-020509', true),
  ('GERA-DIXO-006628', 'GERA-DIXO-005238', true),
  ('GLEN-PAKU-020787', 'GLEN-PAKU-002000', true),
  ('GREG-LAND-000564', 'GREG-LAND-012307', true),
  ('JASH-SYKE-021398', 'JASH-SYKE-001413', true),
  ('JERR-WILS-008743', 'JERR-WILS-009117', true),
  ('JOHN-JETT-018713', 'JOHN-JETT-010357', true),
  ('JOHN-PATE-012812', 'JOHN-PATE-000650', true),
  ('JOSE-REED-000685', 'JOSE-REED-012881', true),
  ('JOSH-MILL-010715', 'JOSH-MILL-000754', true),
  ('JOSH-PARR-021877', 'JOSH-PARR-001665', true),
  ('KENN-ANDE-000017', 'KENN-ANDE-021991', true),
  ('KEVI-STEM-022062', 'KEVI-STEM-001662', true),
  ('LEMA-HALL-007203', 'LEMA-HALL-008234', true),
  ('LEOX-ARAG-000063', 'LEOX-ARAG-022207', true),
  ('LEXX-HILL-008477', 'LEXX-HILL-008492', true),
  ('MARC-SPEA-014005', 'MARC-SPEA-009973', true),
  ('MARK-ROYA-022397', 'MARK-ROYA-000965', false),
  ('MATX-MCBR-022539', 'MATX-MCBR-001699', true),
  ('MATT-ALLE-022530', 'MATT-ALLE-001822', true),
  ('MATT-TURK-022538', 'MATT-TURK-001053', true),
  ('MICH-LIVI-000574', 'MICH-LIVI-013463', true),
  ('MIKE-BARR-001935', 'MIKE-BARR-022648', true),
  ('PAUL-OLIV-022873', 'PAUL-OLIV-022957', true),
  ('RAND-JOHN-000489', 'RAND-JOHN-013724', true),
  ('RASH-BUTL-019166', 'RASH-BUTL-011750', true),
  ('ROBE-LEEX-000570', 'ROBE-LEEX-013979', true),
  ('RYAN-DIMP-019311', 'RYAN-DIMP-019289', true),
  ('RYAN-FLIN-001853', 'RYAN-FLIN-023680', true),
  ('SCOT-PLAY-023694', 'SCOT-PLAY-000904', true),
  ('TOMX-ROUE-024113', 'TOMX-ROUE-000963', true),
  ('TYJU-HAGL-006828', 'TYJU-HAGL-008062', true),
  ('WILL-MUNS-000623', 'WILL-MUNS-024447', true);

-- Field reconciliation, per the operator's answer on the fill policy
-- ("nflverse and pfr is reliable"). These values are written in step 10, AFTER
-- the additive fill in step 9, so they are the final word on every column they
-- name.
--
--   nfl_draft_year / draft_round / draft_overall_pick -- nflverse, NULL where
--     absent. Draft year conflicts on all 48 pairs, which independently confirms
--     it is corrupt on exactly this population; round and pick are the same fact
--     and are taken with it rather than left to fill by accident. nflverse
--     draft_pick was verified to be the OVERALL pick, not the within-round one
--     (Dixon 3/78, Butler 3/89, Lacina 6/167 all match PFR).
--   primary_position / secondary_position -- nflverse position, through the
--     normalize_position folding map. Both columns are NOT NULL, so where
--     nflverse is silent the survivor keeps its value. This is the fix that
--     matters most here: it resolves P-vs-K correctly on the punters, where the
--     survivor's own value is wrong on several -- John Jett was stored as a
--     TIGHT END.
--   height_inches / weight_pounds -- PFR where PFR contradicts both rows, else
--     nflverse; never written where the oracle is silent.
--   college -- the survivor keeps a non-null value; only a NULL is filled.
--     DEVIATION from the gate's wording, forced by the data: on this pre-2010
--     population nflverse college_name is frequently a semicolon list of every
--     school attended ('South Carolina; Garden City CC') or the literal string
--     'None', and it abbreviates away disambiguators we hold ('Miami (Fla.)' ->
--     'Miami'). The gate established there are ZERO real school conflicts across
--     the 48, so which side wins a formatting conflict carries no information --
--     while overwriting would churn 18 good values and write junk into several.
--     Filling only the NULLs takes all of the gain and none of the loss.
--   last_name / short_name -- no action needed. All four conflicts already keep
--     the suffixed form on the survivor ('Alabi II', 'Pastorini Jr.', 'LaFleur',
--     'Wilson Jr.').
--
-- Five survivors where PFR contradicts BOTH league rows and neither row can be
-- preferred -- these take PFR: Gerald Dixon (6-3/250, round 3 pick 78), John
-- Jett (6-0/197), Matt Allen (6-2/246), Corbin Lacina (6-4/302), Rashad Butler
-- (6-4/317). Dixon is the one with no good row at all: one side has the correct
-- high school and draft year, the other the correct height, weight and round, so
-- it was adjudicated field by field.
--
-- One value is withheld rather than written. nflverse encodes a SUPPLEMENTAL
-- draft selection with a within-draft pick number rather than an overall one, so
-- Paul Oliver reads as round 4, pick 1 of the 2007 supplemental. An overall pick
-- that low is impossible for the round, so the round is written and the pick is
-- left NULL.

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
  ('ALEX-SULF-000369', 2001, 6, 176, 'T', 'T', 'Miami (Ohio)', 75, 320),
  ('ANDY-GROO-000510', NULL, NULL, NULL, 'P', 'P', 'Ohio State', 72, 196),  -- andy groom -- position K -> P
  ('ANTH-ADAM-016932', NULL, NULL, NULL, 'QB', 'QB', 'Utah State', 72, 198),
  ('ANTH-ALAB-000928', 2005, 5, 162, 'T', 'T', 'TCU', 77, 315),
  ('BILL-LAFL-001165', NULL, NULL, NULL, 'P', 'P', 'Nebraska', 72, 204),
  ('BRIA-MOOR-000764', NULL, NULL, NULL, 'P', 'P', 'Pittsburg State (KS)', 72, 174),
  ('BRYA-BARK-000064', NULL, NULL, NULL, 'P', 'P', 'Santa Clara University', 73, 202),
  ('CHAR-JOHN-019634', NULL, NULL, NULL, 'QB', 'QB', 'New Mexico State', 73, 200),
  ('CHRI-EDMO-001267', NULL, NULL, NULL, 'FB', 'FB', 'West Virginia', 75, 250),
  ('CORB-LACI-017939', 1993, 6, 167, 'G', 'G', 'Augustana (S.D.)', 76, 302),  -- corbin lacina -- PFR
  ('DAMI-ROBI-018058', 1997, 4, 119, 'S', 'S', 'Iowa', 74, 223),
  ('DANT-PAST-019921', NULL, NULL, NULL, 'QB', 'QB', 'Santa Clara', 74, 208),
  ('DARR-BENN-000073', NULL, NULL, NULL, 'P', 'P', NULL, 77, 235),
  ('DERR-FROS-001484', NULL, NULL, NULL, 'P', 'P', 'Northern Iowa', 74, 210),
  ('DHAN-JONE-009524', 2000, 6, 177, 'MLB', 'MLB', 'Michigan', 73, 236),
  ('DONA-HORN-020509', NULL, NULL, NULL, 'QB', 'QB', 'San Diego State', 74, 195),
  ('GERA-DIXO-005238', 1992, 3, 78, 'OLB', 'OLB', 'South Carolina', 75, 250),  -- gerald dixon -- PFR
  ('GLEN-PAKU-002000', NULL, NULL, NULL, 'P', 'P', 'Kentucky', 75, 220),
  ('GREG-LAND-012307', NULL, NULL, NULL, 'QB', 'QB', 'Massachusetts', 76, 210),
  ('JASH-SYKE-001413', NULL, NULL, NULL, 'OLB', 'OLB', 'Colorado', 74, 236),
  ('JERR-WILS-009117', NULL, NULL, NULL, 'S', 'S', 'Southern University', 71, 190),
  ('JOHN-JETT-010357', NULL, NULL, NULL, 'P', 'P', 'East Carolina', 72, 197),  -- john jett -- position TE -> P
  ('JOHN-PATE-000650', NULL, NULL, NULL, 'QB', 'QB', 'Stephen F. Austin State; Louisiana Tech', 74, 228),
  ('JOSE-REED-012881', NULL, NULL, NULL, 'QB', 'QB', 'Mississippi State', 73, 195),
  ('JOSH-MILL-000754', NULL, NULL, NULL, 'P', 'P', 'Arizona', 76, 225),
  ('JOSH-PARR-001665', NULL, NULL, NULL, 'FB', 'FB', 'San Jose State', 74, 250),  -- josh parry -- position LB -> FB
  ('KENN-ANDE-021991', NULL, NULL, NULL, 'QB', 'QB', 'Augustana (Ill.)', 74, 212),
  ('KEVI-STEM-001662', NULL, NULL, NULL, 'P', 'P', 'Wisconsin', 74, 190),
  ('LEMA-HALL-008234', 1994, 7, 220, 'OLB', 'OLB', 'Alabama', 72, 234),
  ('LEOX-ARAG-022207', NULL, NULL, NULL, 'P', 'P', 'S.F. Austin', 71, 190),  -- leo araguz -- position K -> P
  ('LEXX-HILL-008492', 2008, 6, 204, 'FB', 'FB', 'Montana', 71, 235),
  ('MARC-SPEA-009973', 1994, 2, 39, 'T', 'T', 'Northwestern State-Louisiana', 76, 320),
  ('MARK-ROYA-000965', NULL, NULL, NULL, 'P', 'P', 'Appalachian State', 77, 225),
  ('MATX-MCBR-001699', NULL, NULL, NULL, 'P', 'P', 'Hawaii', 72, 227),
  ('MATT-ALLE-001822', NULL, NULL, NULL, 'P', 'P', 'Troy', 74, 246),  -- matt allen -- PFR
  ('MATT-TURK-001053', NULL, NULL, NULL, 'P', 'P', 'Wisconsin-Whitewater', 77, 251),
  ('MICH-LIVI-013463', NULL, NULL, NULL, 'QB', 'QB', 'Southern Methodist', 76, 212),
  ('MIKE-BARR-022648', NULL, NULL, NULL, 'P', 'P', 'Rutgers', 74, 230),  -- mike barr -- position K -> P
  ('PAUL-OLIV-022957', 2007, 4, NULL, 'S', 'S', 'Georgia', 71, 210),
  ('RAND-JOHN-013724', NULL, NULL, NULL, 'QB', 'QB', 'Texas A&M - Kingsville', 75, 205),
  ('RASH-BUTL-011750', 2006, 3, 89, 'T', 'T', 'Miami (Fla.)', 76, 317),  -- rashad butler -- PFR
  ('ROBE-LEEX-013979', NULL, NULL, NULL, 'QB', 'QB', 'U. of Pacific', 74, 195),
  ('RYAN-DIMP-019289', 2010, 7, 237, 'LB', 'LB', 'Rutgers', 75, 240),  -- ryan dimperio -- position RB -> LB
  ('RYAN-FLIN-023680', NULL, NULL, NULL, 'P', 'P', 'Central Florida', 77, 205),  -- ryan flinn -- position K -> P
  ('SCOT-PLAY-000904', NULL, NULL, NULL, 'P', 'P', 'Florida State', 73, 206),
  ('TOMX-ROUE-000963', NULL, NULL, NULL, 'P', 'P', 'Colorado State', 75, 225),
  ('TYJU-HAGL-008062', 2005, 5, 173, 'OLB', 'OLB', 'Cincinnati', 72, 236),
  ('WILL-MUNS-024447', NULL, NULL, NULL, 'QB', 'QB', 'Utah State', 74, 210);

-- Step 0. Refuse to run against a database this map was not built for.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 48 THEN RAISE EXCEPTION 'expected 48 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 48 THEN RAISE EXCEPTION 'expected 48 distinct survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m JOIN merge_map x ON x.drop_pid = m.keep_pid;
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion', n; END IF;

  SELECT count(*) INTO n FROM merge_map WHERE NOT carry_nfl_player_id;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 withheld nfl_player_id carries, got %', n; END IF;

  -- the sibling session's pair must not be in this map under any circumstances
  SELECT count(*) INTO n FROM merge_map
   WHERE drop_pid IN ('CLEV-HARR-002939','CLEV-HARR-007173')
      OR keep_pid IN ('CLEV-HARR-002939','CLEV-HARR-007173');
  IF n > 0 THEN RAISE EXCEPTION 'map contains the sibling session''s CLEV-HARR pair'; END IF;

  SELECT count(*) INTO n FROM reconciled r WHERE NOT EXISTS (SELECT 1 FROM merge_map m WHERE m.keep_pid = r.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% reconciled rows name a pid that is not a survivor', n; END IF;

  -- no nfl_player_id carry may land inside the sparse dead zone, where an era
  -- prediction from nearest neighbours is a coin flip
  SELECT count(*) INTO n
    FROM merge_map m JOIN player d ON d.pid = m.drop_pid JOIN player k ON k.pid = m.keep_pid
   WHERE m.carry_nfl_player_id AND k.nfl_player_id IS NULL
     AND d.nfl_player_id BETWEEN 2508600 AND 2530400;
  IF n > 0 THEN RAISE EXCEPTION '% nfl_player_id carries land in the sparse 2508600-2530400 zone', n; END IF;
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
  IF n <> 48 THEN RAISE EXCEPTION 'expected 48 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone, and what keeps the two withheld
-- nfl_player_id values recoverable.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-05-dedupe-residual-round-3',
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
  'adhoc/2026-08-05-dedupe-residual-round-3',
  'duplicate-person row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Assert the gamelog-collision trap really is absent. Round 2 needed a
-- column-wise COALESCE rescue here because 36 surviving gamelog rows collided
-- with a donor copy. This set has none, re-verified against production while
-- writing this file -- but the assertion is what makes that a fact rather than
-- an inherited claim, and it aborts the file if a collision appears between now
-- and the apply.
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
-- where the six reconciled fields get their final values.
--
-- nfl_player_id is the one field NOT filled unconditionally: it is gated on the
-- era test recorded in merge_map.carry_nfl_player_id.
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
  date_of_birth = coalesce(c.date_of_birth, s.date_of_birth),
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

-- Step 10. Write the reconciled fields. Runs AFTER the additive fill so it is
-- the final word: where step 9 carried a donor value into a NULL and the oracle
-- disagrees, the oracle wins. Every changed value is logged first.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT r.keep_pid, v.col, v.prev, v.new,
  'adhoc/2026-08-05-dedupe-residual-round-3',
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
-- PART B -- two confirmed NON-duplicates
-- ---------------------------------------------------------------------------
--
-- Both pairs were caught by a biography field that is never part of any matching
-- predicate, then settled on Pro Football Reference's legal name and nflverse's
-- identifier record. A sweep acting on identifier complementarity plus name and
-- birth date would have merged both. They are NOT merged. Each row is repaired
-- so that neither carries the other person's values, which is also what stops
-- the next sweep re-flagging them.
--
-- Gary Anderson. GARY-ANDE-006465 is Gary ALLAN Anderson, K, Syracuse, 5-11/193
-- (nflverse 00-0000313, PFR andergar02), born 1959-07-16 in Parys, South Africa.
-- Its stored date_of_birth is 1961-04-18 -- the RUNNING BACK's, held by
-- GARY-ANDE-016338 (Gary WAYNE Anderson, RB, Arkansas, PFR AndeGa00), which is
-- correct as stored. That single corrupt value is the only reason the pair
-- matched any sweep. draft_round is filled from the same nflverse record, where
-- the row holds the 0 unknown-sentinel.
--
-- Roosevelt Nix. Two different people, and the values are crossed both ways.
--   * ROOS-NIXX-001755 is Roosevelt THEODORE Nix, DE, Central State (OH), born
--     1967-04-17 (nflverse 00-0012124, PFR NixxRo20). Its 71/248 belongs to the
--     OTHER Nix; PFR gives 6-6/299 and nflverse 78/292, so height is 78 on both
--     and weight takes PFR. Its draft is filled from nflverse: 1992 round 8
--     pick 199.
--   * ROOS-NIXX-001769 is Roosevelt Nix-Jones, ILB/FB, Kent State, 5-11/248
--     (nflverse 00-0030741, PFR NixxRo01). Its 71/248 and its Reynoldsburg OH
--     high school are its own and are correct. It wrongly carries the Central
--     State player's date_of_birth, college and 1992 draft year.
--
-- The handoff flagged this row's birth date as unresolved and said to prefer
-- NULL over a guess, because the PFR page read gave no birth date. nflverse
-- does give one -- 1992-03-30 -- so it is written rather than nulled. Note what
-- that reveals about the corruption: the 1992 sitting in nfl_draft_year is his
-- BIRTH YEAR, not a draft year. He was undrafted, so the field goes NULL.

INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT v.pid, v.col, v.prev, v.new,
  'adhoc/2026-08-05-dedupe-residual-round-3', v.why, now()
FROM (VALUES
  ('GARY-ANDE-006465', 'date_of_birth', '1961-04-18', '1959-07-16',
   'held the OTHER Gary Anderson''s birth date; nflverse 00-0000313 and PFR andergar02 give 1959-07-16'),
  ('GARY-ANDE-006465', 'draft_round', '0', '7',
   'unknown-sentinel filled from nflverse 00-0000313 (1982 round 7 pick 171)'),
  ('ROOS-NIXX-001755', 'height_inches', '71', '78',
   'held the OTHER Roosevelt Nix''s height; PFR NixxRo20 gives 6-6 and nflverse 00-0012124 gives 78'),
  ('ROOS-NIXX-001755', 'weight_pounds', '248', '299',
   'held the OTHER Roosevelt Nix''s weight; PFR NixxRo20 gives 299'),
  ('ROOS-NIXX-001755', 'draft_round', '0', '8',
   'unknown-sentinel filled from nflverse 00-0012124 (1992 round 8 pick 199)'),
  ('ROOS-NIXX-001755', 'draft_overall_pick', NULL, '199',
   'filled from nflverse 00-0012124 (1992 round 8 pick 199)'),
  ('ROOS-NIXX-001769', 'date_of_birth', '1967-04-17', '1992-03-30',
   'held the Central State Nix''s birth date; nflverse 00-0030741 gives 1992-03-30'),
  ('ROOS-NIXX-001769', 'college', 'Central State University, Oh', 'Kent State',
   'held the Central State Nix''s college; nflverse 00-0030741 gives Kent State'),
  ('ROOS-NIXX-001769', 'nfl_draft_year', '1992', NULL,
   'the 1992 is this player''s BIRTH year, not a draft year -- he was undrafted (nflverse 00-0030741)')
) AS v(pid, col, prev, new, why);

UPDATE player SET date_of_birth = '1959-07-16', draft_round = 7 WHERE pid = 'GARY-ANDE-006465';
UPDATE player SET height_inches = 78, weight_pounds = 299, draft_round = 8, draft_overall_pick = 199
  WHERE pid = 'ROOS-NIXX-001755';
UPDATE player SET date_of_birth = '1992-03-30', college = 'Kent State', nfl_draft_year = NULL
  WHERE pid = 'ROOS-NIXX-001769';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player
   WHERE (pid = 'GARY-ANDE-006465' AND date_of_birth = '1959-07-16')
      OR (pid = 'GARY-ANDE-016338' AND date_of_birth = '1961-04-18')
      OR (pid = 'ROOS-NIXX-001755' AND height_inches = 78 AND weight_pounds = 299)
      OR (pid = 'ROOS-NIXX-001769' AND date_of_birth = '1992-03-30' AND college = 'Kent State');
  IF n <> 4 THEN RAISE EXCEPTION 'expected 4 repaired non-duplicate rows, got %', n; END IF;

  -- the whole point: these two pairs must no longer share a birth date
  SELECT count(*) INTO n FROM player a JOIN player b ON b.last_name = a.last_name
    AND b.date_of_birth = a.date_of_birth AND b.pid > a.pid
   WHERE a.pid IN ('GARY-ANDE-006465','ROOS-NIXX-001755')
     AND b.pid IN ('GARY-ANDE-016338','ROOS-NIXX-001769');
  IF n <> 0 THEN RAISE EXCEPTION '% non-duplicate pairs still share a birth date', n; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PART C -- orphan pids
-- ---------------------------------------------------------------------------
--
-- 60 orphan pids, measured against production while writing this file.
-- KTCPICK-* is excluded from every predicate here: 50,712 rows across 36 pids
-- are KeepTradeCut draft picks that will never have a player row, and including
-- them produces a misleading 51,076 headline.
--
-- 34 re-point, 5 pids lose 383 rows, 5 draft picks are de-attributed, and 21
-- composite pids are deliberately left orphaned.

CREATE TEMP TABLE orphan_repoint (from_pid varchar NOT NULL PRIMARY KEY, to_pid varchar NOT NULL) ON COMMIT DROP;

-- 30 legacy DST pids (833 props_index rows, all season 2023, plus 1 changelog
-- row on ARI_DEF) plus 2 stale team abbreviations plus 2 composite pids whose
-- embedded birth date corroborates the target. Deleting the DST rows would
-- discard a full season of team-defence prop history that has a valid home.
INSERT INTO orphan_repoint (from_pid, to_pid) VALUES
  ('ARI_DEF', 'ARI'),
  ('ATL_DEF', 'ATL'),
  ('BAL_DEF', 'BAL'),
  ('BUF_DEF', 'BUF'),
  ('CAR_DEF', 'CAR'),
  ('CHI_DEF', 'CHI'),
  ('CIN_DEF', 'CIN'),
  ('CLE_DEF', 'CLE'),
  ('DAL_DEF', 'DAL'),
  ('DEN_DEF', 'DEN'),
  ('DET_DEF', 'DET'),
  ('GB_DEF', 'GB'),
  ('HOU_DEF', 'HOU'),
  ('IND_DEF', 'IND'),
  ('JAX_DEF', 'JAX'),
  ('KC_DEF', 'KC'),
  ('LA_DEF', 'LA'),
  ('LV_DEF', 'LV'),
  ('MIA_DEF', 'MIA'),
  ('MIN_DEF', 'MIN'),
  ('NE_DEF', 'NE'),
  ('NO_DEF', 'NO'),
  ('NYJ_DEF', 'NYJ'),
  ('PHI_DEF', 'PHI'),
  ('PIT_DEF', 'PIT'),
  ('SEA_DEF', 'SEA'),
  ('SF_DEF', 'SF'),
  ('TB_DEF', 'TB'),
  ('TEN_DEF', 'TEN'),
  ('WAS_DEF', 'WAS'),
  ('JAC', 'JAX'),
  ('LAR', 'LA'),
  ('ELIJ-JONE-2022-2000-01-08', 'ELIJ-JONE-003361'),
  ('TYRE-JACK-2021-1997-11-07', 'TYRE-JACK-004584');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM orphan_repoint;
  IF n <> 34 THEN RAISE EXCEPTION 'expected 34 re-point rows, got %', n; END IF;

  SELECT count(*) INTO n FROM orphan_repoint r WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = r.to_pid);
  IF n > 0 THEN RAISE EXCEPTION '% re-point targets are absent from player', n; END IF;

  SELECT count(*) INTO n FROM orphan_repoint r WHERE EXISTS (SELECT 1 FROM player p WHERE p.pid = r.from_pid);
  IF n > 0 THEN RAISE EXCEPTION '% re-point sources exist in player and are therefore not orphans', n; END IF;

  -- the briefed claim, asserted rather than trusted: props_index holds no rows
  -- on any bare team abbreviation, so the DST re-point cannot collide there
  SELECT count(*) INTO n FROM props_index pi
    JOIN orphan_repoint r ON r.to_pid = pi.pid WHERE r.from_pid LIKE '%\_DEF';
  IF n > 0 THEN RAISE EXCEPTION 'props_index already holds % rows on a bare team abbreviation', n; END IF;

  -- both composite re-points must be corroborated by the birth date embedded in
  -- the pid itself -- this is the ONLY thing separating them from the 16 that
  -- resolve by name prefix alone and are deliberately left orphaned
  SELECT count(*) INTO n FROM orphan_repoint r JOIN player p ON p.pid = r.to_pid
   WHERE r.from_pid LIKE '%-%-____-__-__' AND p.date_of_birth <> right(r.from_pid, 10);
  IF n > 0 THEN RAISE EXCEPTION '% composite re-points are not corroborated by birth date', n; END IF;
END $$;

-- Drop the orphan rows that would collide once re-pointed -- four in total, all
-- on the four NON-DST re-points, each a duplicate of a row the target already
-- holds because the same importer wrote both under a stale and a live pid. All
-- four are in the JSONL backup.
DO $$
DECLARE r record; n int; total int := 0;
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
    EXECUTE format(
      'DELETE FROM %I d USING orphan_repoint m WHERE m.from_pid = d.pid AND EXISTS (SELECT 1 FROM %I k WHERE k.pid = m.to_pid%s)',
      r.tbl, r.tbl,
      (SELECT coalesce(string_agg(format(' AND k.%I IS NOT DISTINCT FROM d.%I', c, c), ''), '')
       FROM unnest(r.colnames) c WHERE c <> 'pid'));
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'orphan collisions: dropped % rows from %', n, r.tbl;
      total := total + n;
    END IF;
  END LOOP;
  IF total <> 4 THEN RAISE EXCEPTION 'expected 4 colliding orphan rows, got %', total; END IF;
END $$;

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
    EXECUTE format('UPDATE %I t SET pid = m.to_pid FROM orphan_repoint m WHERE t.pid = m.from_pid', tbl);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'orphan re-point: moved % rows in %', n, tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'orphan re-point: % rows moved in total', total;
  IF total < 1000 THEN RAISE EXCEPTION 'expected ~1050 re-pointed orphan rows, got % -- population has shifted', total; END IF;
END $$;

-- The 5 draft rows are NOT deleted. They carry pid '1' and '0', which is garbage
-- attribution -- but they are real league-1 rookie picks (2021 rounds 4-5, 2023
-- round 4) with a valid round, pick, team and league. Deleting them would remove
-- five picks from that league's draft history, which is not what "unattributable
-- rows with no plausible target" meant. draft.pid is nullable and every unmade
-- 2026/2027 pick already carries NULL, so nulling is the shape the schema
-- already has for a pick with no player. This is a DEVIATION from the approved
-- 388-row deletion, in the direction of destroying less; it is fully reversible
-- from the backup, and deleting them later is one statement.
UPDATE draft SET pid = NULL WHERE pid IN ('0', '1');

DO $$
DECLARE n int;
BEGIN
  GET DIAGNOSTICS n = ROW_COUNT;
  SELECT count(*) INTO n FROM draft WHERE pid IN ('0','1');
  IF n <> 0 THEN RAISE EXCEPTION '% draft rows still carry a garbage pid', n; END IF;
END $$;

-- 383 rows on 4 pids, none attributable to any player and none with a plausible
-- target. No player_changelog entry is written for these, deliberately: the
-- table keys on pid, so an entry for a row whose pid resolves to nobody would
-- itself be a new orphan -- roughly a thousand of them, recreating the exact
-- defect this part of the file is clearing. The recovery path is the JSONL
-- backup, which holds every column of every one of these rows.
--
--   ''         364 rows  keeptradecut_valuations  (a scraped value series under an empty pid)
--   NW-0115     18 rows  projections_index        (2022 REG weeks 0-17, source 18)
--   'E-1000      1 row   player_changelog         (one sleeper dpos change on a mangled pid)
DELETE FROM keeptradecut_valuations WHERE pid = '';
DELETE FROM projections_index WHERE pid = 'NW-0115';
DELETE FROM player_changelog WHERE pid = '''E-1000';

-- 21 composite pids are LEFT ORPHANED on purpose. 16 resolve to exactly one live
-- player by 4-letter name prefix alone with no birth date to confirm it, 2 are
-- ambiguous (DYLA-PARH and FRAN-GORE each match two players), and 3 resolve to
-- nothing -- CHRI-BROO-2023-2000-01-11 at 5,033 rows, KWAU-WILL-2020 at 1,200,
-- RODN-THOM-1988-1965-12-21 at 62 -- plus KEEN-REYN-2016-1994-12-13 at 28.
--
-- Repairing them by name prefix is precisely the name-match mechanism that
-- produced the hijacked rows this whole line of work exists to clean up, so
-- using it as the fix would reintroduce the defect. Most of the remaining volume
-- is player_changelog, an audit trail whose value does not depend on the pid
-- resolving.

-- ---------------------------------------------------------------------------
-- Post-conditions. Any failure here rolls the whole file back.
-- ---------------------------------------------------------------------------
DO $$
DECLARE n int; tbl text;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.drop_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% merged duplicate rows survive in player', n; END IF;

  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.keep_pid = p.pid;
  IF n <> 48 THEN RAISE EXCEPTION 'expected 48 surviving rows, got %', n; END IF;

  -- no survivor may still be duplicated by (last name, birth date)
  SELECT count(*) INTO n FROM merge_map m
    JOIN player k ON k.pid = m.keep_pid
    JOIN player o ON o.last_name = k.last_name AND o.date_of_birth = k.date_of_birth AND o.pid <> k.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% survivors are still duplicated on (last name, birth date)', n; END IF;

  -- every reconciled position must be in the canonical vocabulary; the CHECK
  -- constraint enforces this too, but failing here names the pid
  SELECT count(*) INTO n FROM player p JOIN reconciled r ON r.keep_pid = p.pid
   WHERE p.primary_position IS DISTINCT FROM r.primary_position
      OR p.secondary_position IS DISTINCT FROM r.secondary_position;
  IF n <> 0 THEN RAISE EXCEPTION '% survivors did not take their reconciled position', n; END IF;

  -- nothing anywhere may still reference a deleted or re-pointed pid
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.drop_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still holds % rows on a merged pid', tbl, n; END IF;
    EXECUTE format('SELECT count(*) FROM %I t JOIN orphan_repoint m ON m.from_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still holds % rows on a re-pointed orphan pid', tbl, n; END IF;
  END LOOP;

  SELECT count(*) INTO n FROM keeptradecut_valuations WHERE pid = '';
  IF n <> 0 THEN RAISE EXCEPTION 'empty-pid keeptradecut rows survive'; END IF;
  SELECT count(*) INTO n FROM projections_index WHERE pid = 'NW-0115';
  IF n <> 0 THEN RAISE EXCEPTION 'NW-0115 projection rows survive'; END IF;

  -- The CLEV-HARR pair belongs to a sibling session. It merged 007173 into
  -- 002939 at 22:13 on 2026-08-04, hours before this file was written, so only
  -- the survivor exists now -- which is why this asserts the survivor's presence
  -- rather than a row count of two. Step 0 has already refused the file outright
  -- if either pid appears in merge_map, so this is the second of two guards.
  SELECT count(*) INTO n FROM player WHERE pid = 'CLEV-HARR-002939';
  IF n <> 1 THEN RAISE EXCEPTION 'the sibling session''s surviving CLEV-HARR row is gone'; END IF;

  RAISE NOTICE 'all post-conditions passed';
END $$;
