-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Collapse 9 duplicate-PERSON rows in `player` onto 9 survivors. This is round
-- three, and unlike 7eda49a6c (189 pairs) and ca5c3aca0 (170 pairs) it is NOT
-- cleanup after the March 2023 pid migration. Every pair here was minted in the
-- 2024 or 2025 draft class by a defect that was still live when this file was
-- written, and the importer fix ships alongside it.
--
-- The defect. `scripts/import-players-combine-profiles.mjs` resolved a combine
-- profile to an existing player with ONE matcher -- find_player_row by
-- esb_player_id -- and minted a new row on a miss, with no name and no birth
-- date fallback. `find_player_row`'s external-id chain (libs-server/
-- find-player-row.mjs:187-232) is an exclusive else-if that is also exclusive
-- with the name/date-of-birth branch, so a single id parameter suppresses name
-- matching entirely. SIS draft profiles carry no esb id, so every player that
-- `private/scripts/import-draft-profiles-sis.mjs` minted first was structurally
-- invisible to the combine importer, which then minted a second row for the
-- same person weeks later.
--
-- That is the whole signature: the GSIS/NFL feed family (esb, gsis,
-- gsis_it, smart) on one row, sis_player_id and every commercial source on the
-- other, with no overlap. It is not one importer failing to match -- it is two
-- importers each creating a row and neither able to see the other's.
--
-- NOTE for anyone extending the earlier sweeps: the round-one and round-two
-- method note says a sweep for this class must DROP the equal-nfl_draft_year
-- predicate, because draft year is corrupt on those rows. That does not hold
-- here. All 18 rows carry a correct nfl_draft_year and both sides of all 9
-- pairs agree, so an equal-draft-year predicate does not hide this subclass --
-- it is what identifies it. The two populations are different defects.
--
-- Population. 9 pairs, 18 rows, no cluster larger than two: every one of the 9
-- formatted_names appears exactly twice in `player` and nowhere else.
--
-- Survivor rule, unchanged from round two: most gamelogs wins; on a tie, most
-- identifiers. It happens that every one of the 9 dropped rows carries ZERO
-- gamelogs, so this migration moves no gamelog data at all and step 4 asserts
-- that rather than assuming it.
--
-- Evidence. Every pair is corroborated by a source outside our own database,
-- on fields that were NOT used to pair the rows.
--   * nflverse identifier join -- 4 pairs (Harris, Johnson, Aumavae,
--     Haynesworth). The survivor's gsis_player_id resolves in the nflverse
--     snapshot to one person whose birth date, college and measurements match
--     our row, and nflverse holds no second person with that last name in that
--     draft class.
--   * Sleeper biography -- 8 pairs. Sleeper compiles its own biographies and
--     holds exactly ONE player at each of these names; its birth date and
--     college agree exactly with the row that carries a real birth date.
--   * Both sources agree on 3 pairs; no pair rests on our own data alone.
--
-- The one disagreement, recorded rather than resolved. Sleeper gives Tarique
-- Barnes a birth date of 1998-03-05 where our combine-derived row says
-- 2000-11-23. Note this is a disagreement between two SOURCES about one
-- person's birthday, not evidence of two people: our two rows do not disagree
-- with each other at all, because the SIS row carries the 0000-00-00 sentinel.
-- Everything that can be compared agrees -- same distinctive name, same
-- college, same draft class, same position, same height, one pound apart. The
-- pair merges; nothing is written to date_of_birth on the strength of one
-- source, following the Kupper/Menkin precedent from round two.
--
-- Twin risk, which is what produced the 12 exclusions in the prior rounds, is
-- not live here: a false positive would require two people sharing a first
-- name, a surname, a college AND a draft class. Sleeper was asked directly how
-- many people share each surname-and-college and returned no collision except
-- an unrelated 1989-born James-Michael Johnson.
--
-- The 0000-00-00 sentinel. `player.date_of_birth` is a varchar and the SIS and
-- combine mint paths both seed the string '0000-00-00' rather than NULL. Four
-- of the nine SURVIVORS carry it. A plain coalesce would therefore preserve the
-- sentinel and discard the real birth date sitting on the donor, so step 9
-- treats the sentinel as absent via nullif. This is the one place this file
-- departs from round two's fill.
--
-- Era gate on nfl_player_id. Exactly one identifier in this set needs the gate:
-- nfl_player_id 2574515, held by the dropped Harris row. Same method as round
-- two -- the 60 nearest nfl_player_id neighbours (spanning 2572411..2574608)
-- have a median nfl_draft_year of 2025, matching the survivor's 2025 exactly.
-- Carried.
--
-- Display name. The surviving Harris row is filed under his legal first name,
-- Cleveland. That is not a matcher artifact -- nflverse records first_name
-- `Cleveland` against common_first_name `Tre` -- but it is the wrong name to
-- display, and it disagrees with this codebase's own convention:
-- `scripts/import-players-nfl.mjs` deliberately prefers nflverse footballName
-- (`Tre`) over the legal firstName. Step 10 conforms the survivor to Tre Harris
-- and keeps `cleveland harris` as an alias so the legal-name feeds still
-- resolve. No other survivor's first name disagrees with its common name.
--
-- A full snapshot of all 18 rows sits in
-- scratch/dedupe-duplicate-person-rows/2026-08-05-dedupe-round3-backup.json.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

-- The production statement_timeout is 40s, which is a sensible ceiling for
-- application queries and too low for step 5. The collision sweep visits every
-- unique index containing `pid`, and two of those tables are large enough that
-- a single DELETE exceeds it: scoring_format_player_projection_points (1.28M
-- rows) and the partitioned projections_history, whose natural-key index leads
-- on sourceid rather than pid and so cannot serve the correlated lookup
-- directly. SET LOCAL scopes this to db:exec's transaction and reverts on
-- commit or rollback; nothing outside this file sees a raised ceiling.
SET LOCAL statement_timeout = '30min';

CREATE TEMP TABLE merge_map (
  drop_pid varchar NOT NULL PRIMARY KEY,
  keep_pid varchar NOT NULL,
  carry_nfl_player_id boolean NOT NULL
) ON COMMIT DROP;

-- drop -> keep. The dropped side is the combine-minted row for five clusters
-- and the SIS-minted row for four; the survivor rule decides, not provenance.
INSERT INTO merge_map (drop_pid, keep_pid, carry_nfl_player_id) VALUES
  ('CLAR-BARR-003355', 'CLAR-BARR-001052', true),
  ('CLEV-HARR-007173', 'CLEV-HARR-002939', true),
  ('DUKE-CLEM-002188', 'DUKE-CLEM-000823', true),
  ('EMAN-JOHN-001003', 'EMAN-JOHN-005937', true),
  ('MASO-FAIR-001638', 'MASO-FAIR-006747', true),
  ('PHIL-BROO-000672', 'PHIL-BROO-002125', true),
  ('POPO-AUMA-000932', 'POPO-AUMA-003745', true),
  ('SINC-HAYN-016438', 'SINC-HAYN-001249', true),
  ('TARI-BARN-004372', 'TARI-BARN-001232', true);

-- Step 0. Refuse to run against a database this map does not describe.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 9 THEN RAISE EXCEPTION 'expected 9 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 9 THEN RAISE EXCEPTION 'expected 9 survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m
  WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m
  WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m
  WHERE EXISTS (SELECT 1 FROM merge_map d WHERE d.drop_pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion', n; END IF;

  -- Each pair must be one person by the evidence above, which means the two
  -- rows must still agree on the name and draft class that identified them.
  SELECT count(*) INTO n FROM merge_map m
  JOIN player d ON d.pid = m.drop_pid
  JOIN player k ON k.pid = m.keep_pid
  WHERE d.formatted_name IS DISTINCT FROM k.formatted_name
     OR d.nfl_draft_year IS DISTINCT FROM k.nfl_draft_year;
  IF n > 0 THEN RAISE EXCEPTION '% pairs no longer agree on name and draft year', n; END IF;

  -- No cluster may have grown a third row since the map was built.
  SELECT count(*) INTO n FROM (
    SELECT p.formatted_name FROM player p
    WHERE p.formatted_name IN (SELECT k.formatted_name FROM player k JOIN merge_map m ON m.keep_pid = k.pid)
    GROUP BY 1 HAVING count(*) <> 2
  ) t;
  IF n > 0 THEN RAISE EXCEPTION '% clusters no longer hold exactly two rows', n; END IF;
END $$;

-- Step 1. Snapshot every row about to be deleted. Everything after step 8 reads
-- the deleted rows from here, never from `player`.
CREATE TEMP TABLE drop_snapshot ON COMMIT DROP AS
SELECT p.* FROM player p JOIN merge_map m ON m.drop_pid = p.pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM drop_snapshot;
  IF n <> 9 THEN RAISE EXCEPTION 'expected 9 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-05-dedupe-duplicate-person-rows-round-3',
  'preserved value from merged duplicate row ' || m.drop_pid,
  now()
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
CROSS JOIN LATERAL jsonb_each(to_jsonb(s)) kv
WHERE kv.value IS NOT NULL
  AND kv.value <> 'null'::jsonb
  AND kv.key NOT IN ('pid', 'name_search_vector');

-- Step 3. Record the merge itself, mirroring rounds one and two.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, 'pid', m.drop_pid, m.keep_pid,
  'adhoc/2026-08-05-dedupe-duplicate-person-rows-round-3',
  'duplicate-person row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Assert the thing that makes this migration simple: no dropped row
-- carries a gamelog, so nothing has to be rescued out of one. Round two needed
-- a generic column-wise fill here for the Jamir Jones cluster; if this ever
-- fires, port that step across rather than deleting gamelog history.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player_gamelogs g JOIN merge_map m ON m.drop_pid = g.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% gamelogs sit on rows about to be deleted -- port round two step 4', n; END IF;
END $$;

-- Step 5. Drop the donor rows that would collide once re-pointed. Driven off
-- the live unique indexes rather than a hand-written table list, so an index
-- added since this file was written is still respected.
--
-- The comparison operator is chosen per column from attnotnull rather than
-- always being IS NOT DISTINCT FROM, as round two wrote it. That is a planner
-- concern, not a semantic one: on a NOT NULL column the two forms are exactly
-- equivalent, but IS NOT DISTINCT FROM is not indexable, so the correlated
-- EXISTS could not use the very unique index it was derived from and degraded
-- to a scan of the whole table per donor row. Against
-- scoring_format_player_projection_points (1.28M rows, 400 donor rows) that
-- exceeded the 40s statement timeout and aborted the file. Nullable columns
-- keep IS NOT DISTINCT FROM, where it is doing real work.
DO $$
DECLARE r record; q text; n int; total int := 0;
BEGIN
  FOR r IN
    SELECT t.relname AS tbl,
           array_agg(a.attname ORDER BY k.ord) AS colnames,
           array_agg(a.attnotnull ORDER BY k.ord) AS notnulls
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
      (SELECT coalesce(string_agg(
         CASE WHEN c.is_not_null
              THEN format(' AND k.%I = d.%I', c.name, c.name)
              ELSE format(' AND k.%I IS NOT DISTINCT FROM d.%I', c.name, c.name) END, ''), '')
       FROM unnest(r.colnames, r.notnulls) AS c(name, is_not_null)
       WHERE c.name <> 'pid'));
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
-- off information_schema so no pid-bearing table can be missed; partitions are
-- skipped because the update is applied to their parent.
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
-- UNIQUE index before those identifiers are written onto the survivors.
DELETE FROM player p USING merge_map m WHERE p.pid = m.drop_pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.drop_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% duplicate rows survived the delete', n; END IF;
END $$;

-- Step 9. Fill every column the survivor is missing, from the snapshot. Purely
-- additive: coalesce never overwrites a value the survivor already holds, so no
-- adjudication between two competing non-null values happens here -- the
-- survivor's own college spelling stands (Mississippi over Ole Miss, and so on).
--
-- date_of_birth is the exception, and the reason is the 0000-00-00 sentinel
-- documented in the header: on the survivor side it means "absent" and must not
-- win a coalesce, and on the donor side it must not be written onto a survivor
-- that has a real value. nullif on BOTH sides gives that, and the outer
-- coalesce restores the sentinel if neither row has a real birth date, so no
-- row gains a NULL it did not have.
--
-- nfl_player_id is gated on the era test recorded in merge_map.
UPDATE player c SET
  tertiary_position = coalesce(c.tertiary_position, s.tertiary_position),
  height_inches = coalesce(c.height_inches, s.height_inches),
  weight_pounds = coalesce(c.weight_pounds, s.weight_pounds),
  date_of_birth = coalesce(
    nullif(c.date_of_birth, '0000-00-00'),
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
  ten_yard_split_seconds = coalesce(c.ten_yard_split_seconds, s.ten_yard_split_seconds),
  pro_day_forty_seconds = coalesce(c.pro_day_forty_seconds, s.pro_day_forty_seconds),
  sixty_yard_shuttle_seconds = coalesce(c.sixty_yard_shuttle_seconds, s.sixty_yard_shuttle_seconds),
  draft_overall_pick = coalesce(c.draft_overall_pick, s.draft_overall_pick),
  draft_round = coalesce(c.draft_round, s.draft_round),
  draft_team = coalesce(c.draft_team, s.draft_team),
  college = coalesce(c.college, s.college),
  college_division = coalesce(c.college_division, s.college_division),
  high_school = coalesce(nullif(c.high_school, ''), nullif(s.high_school, ''), c.high_school),
  hometown = coalesce(nullif(c.hometown, ''), nullif(s.hometown, ''), c.hometown),
  jersey_number = coalesce(c.jersey_number, s.jersey_number),
  nfl_draft_year = coalesce(c.nfl_draft_year, s.nfl_draft_year),
  ngs_athleticism_score = coalesce(c.ngs_athleticism_score, s.ngs_athleticism_score),
  ngs_draft_grade = coalesce(c.ngs_draft_grade, s.ngs_draft_grade),
  ngs_production_score = coalesce(c.ngs_production_score, s.ngs_production_score),
  ngs_size_score = coalesce(c.ngs_size_score, s.ngs_size_score),
  nfl_grade = coalesce(c.nfl_grade, s.nfl_grade),
  sis_prospect_grade = coalesce(c.sis_prospect_grade, s.sis_prospect_grade),
  sis_prospect_position_rank = coalesce(c.sis_prospect_position_rank, s.sis_prospect_position_rank),
  sis_prospect_overall_rank = coalesce(c.sis_prospect_overall_rank, s.sis_prospect_overall_rank),
  esb_player_id = coalesce(c.esb_player_id, s.esb_player_id),
  gsis_player_id = coalesce(c.gsis_player_id, s.gsis_player_id),
  gsis_it_player_id = coalesce(c.gsis_it_player_id, s.gsis_it_player_id),
  smart_player_id = coalesce(c.smart_player_id, s.smart_player_id),
  sis_player_id = coalesce(c.sis_player_id, s.sis_player_id),
  sleeper_player_id = coalesce(c.sleeper_player_id, s.sleeper_player_id),
  pfr_player_id = coalesce(c.pfr_player_id, s.pfr_player_id),
  espn_player_id = coalesce(c.espn_player_id, s.espn_player_id),
  otc_player_id = coalesce(c.otc_player_id, s.otc_player_id),
  keeptradecut_player_id = coalesce(c.keeptradecut_player_id, s.keeptradecut_player_id),
  sportradar_player_id = coalesce(c.sportradar_player_id, s.sportradar_player_id),
  pff_player_id = coalesce(c.pff_player_id, s.pff_player_id),
  yahoo_player_id = coalesce(c.yahoo_player_id, s.yahoo_player_id),
  rotoworld_player_id = coalesce(c.rotoworld_player_id, s.rotoworld_player_id),
  rotowire_player_id = coalesce(c.rotowire_player_id, s.rotowire_player_id),
  fantasy_data_player_id = coalesce(c.fantasy_data_player_id, s.fantasy_data_player_id),
  mfl_player_id = coalesce(c.mfl_player_id, s.mfl_player_id),
  fleaflicker_player_id = coalesce(c.fleaflicker_player_id, s.fleaflicker_player_id),
  cbs_player_id = coalesce(c.cbs_player_id, s.cbs_player_id),
  cfbref_player_id = coalesce(c.cfbref_player_id, s.cfbref_player_id),
  draftkings_player_id = coalesce(c.draftkings_player_id, s.draftkings_player_id),
  fanduel_player_id = coalesce(c.fanduel_player_id, s.fanduel_player_id),
  rts_player_id = coalesce(c.rts_player_id, s.rts_player_id),
  swish_player_id = coalesce(c.swish_player_id, s.swish_player_id),
  ffpc_player_id = coalesce(c.ffpc_player_id, s.ffpc_player_id),
  nffc_player_id = coalesce(c.nffc_player_id, s.nffc_player_id),
  fantrax_player_id = coalesce(c.fantrax_player_id, s.fantrax_player_id),
  underdog_player_id = coalesce(c.underdog_player_id, s.underdog_player_id),
  sumer_player_id = coalesce(c.sumer_player_id, s.sumer_player_id),
  fantasylabs_player_id = coalesce(c.fantasylabs_player_id, s.fantasylabs_player_id),
  fantasypoints_player_id = coalesce(c.fantasypoints_player_id, s.fantasypoints_player_id),
  twitter_username = coalesce(c.twitter_username, s.twitter_username),
  nfl_player_id = CASE WHEN m.carry_nfl_player_id
                       THEN coalesce(c.nfl_player_id, s.nfl_player_id)
                       ELSE c.nfl_player_id END
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
WHERE c.pid = m.keep_pid;

-- Step 10. Conform the surviving Harris row to the name he is universally known
-- by, and keep the legal form reachable as an alias so the NGS/combine feeds --
-- which supply `Cleveland` -- still resolve to this row. `tre harris` is already
-- an alias on this pid, re-pointed from the dropped row in step 6.
UPDATE player
SET first_name = 'Tre', formatted_name = 'tre harris', short_name = 'T.Harris'
WHERE pid = 'CLEV-HARR-002939';

-- player_aliases.source is varchar(32) and its existing vocabulary is short
-- tokens (`manual`, `nfl`), not the full adhoc path used for player_changelog.
INSERT INTO player_aliases (pid, formatted_alias, source)
VALUES ('CLEV-HARR-002939', 'cleveland harris', 'adhoc-dedupe-round-3')
ON CONFLICT (pid, formatted_alias) DO NOTHING;

INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
VALUES ('CLEV-HARR-002939', 'first_name', 'Cleveland', 'Tre',
  'adhoc/2026-08-05-dedupe-duplicate-person-rows-round-3',
  'conform display name to common first name; legal name retained as alias', now());

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player WHERE pid = 'CLEV-HARR-002939' AND formatted_name = 'tre harris';
  IF n <> 1 THEN RAISE EXCEPTION 'Harris display-name conform did not apply'; END IF;

  SELECT count(*) INTO n FROM player_aliases
  WHERE pid = 'CLEV-HARR-002939' AND formatted_alias IN ('tre harris', 'cleveland harris');
  IF n <> 2 THEN RAISE EXCEPTION 'expected both Harris name forms as aliases, got %', n; END IF;
END $$;

-- Step 11. Post-conditions. Any failure here rolls the whole file back.
DO $$
DECLARE tbl text; n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.keep_pid = p.pid;
  IF n <> 9 THEN RAISE EXCEPTION 'expected 9 surviving rows, found %', n; END IF;

  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.drop_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still references % deleted pids', tbl, n; END IF;
  END LOOP;

  -- Every survivor must now hold a real birth date: each pair had exactly one
  -- row carrying one, and step 9 is what moves it across the sentinel.
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.keep_pid = p.pid
  WHERE p.date_of_birth IS NULL OR p.date_of_birth = '0000-00-00';
  IF n > 0 THEN RAISE EXCEPTION '% survivors still carry no usable date_of_birth', n; END IF;

  -- Every survivor must now hold BOTH identifier families, which is the whole
  -- point of the merge: the split is what the defect produced.
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.keep_pid = p.pid
  WHERE p.esb_player_id IS NULL OR p.sis_player_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% survivors did not receive both identifier families', n; END IF;

  -- The defect signature must no longer return any of these people.
  SELECT count(*) INTO n FROM player a JOIN player b
    ON a.formatted_name = b.formatted_name AND a.nfl_draft_year = b.nfl_draft_year AND a.pid < b.pid
  WHERE coalesce(a.esb_player_id, '') <> '' AND a.sis_player_id IS NULL
    AND b.sis_player_id IS NOT NULL AND coalesce(b.esb_player_id, '') = '';
  IF n > 0 THEN RAISE EXCEPTION '% esb-versus-sis duplicate pairs remain', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT nfl_player_id FROM player WHERE nfl_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) t;
  IF n > 0 THEN RAISE EXCEPTION '% nfl_player_id values are now held by more than one row', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT gsis_player_id FROM player WHERE gsis_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) t;
  IF n > 0 THEN RAISE EXCEPTION '% gsis_player_id values are now held by more than one row', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT esb_player_id FROM player WHERE esb_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) t;
  IF n > 0 THEN RAISE EXCEPTION '% esb_player_id values are now held by more than one row', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT sis_player_id FROM player WHERE sis_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) t;
  IF n > 0 THEN RAISE EXCEPTION '% sis_player_id values are now held by more than one row', n; END IF;

  SELECT count(*) INTO n FROM player_changelog
  WHERE source = 'adhoc/2026-08-05-dedupe-duplicate-person-rows-round-3';
  IF n < 9 THEN RAISE EXCEPTION 'too few changelog rows written: %', n; END IF;
END $$;
