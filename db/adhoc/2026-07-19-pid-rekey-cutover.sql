-- Immutable player-id (pid) re-key -- CUTOVER (short swap transaction).
--
-- Runs via `yarn db:exec` as ONE psql transaction (--single-transaction,
-- ON_ERROR_STOP=1): any RAISE/error auto-rolls-back the whole thing, so there is
-- no partial-commit state to clean up -- that IS the rollback recovery.
--
-- PRECONDITIONS (must all hold before running, in the downtime window):
--   * pid-writing importers PAUSED (finalize-week.mjs, live plays/odds workers, ingest).
--   * prep-01 ran: player.new_pid populated (sequence + column + values); sentinel created.
--   * prep-02 ran to completion IN THE WINDOW (after the importer pause): every partition
--     child and every standalone pid leaf over the size threshold pre-remapped, verified
--     clean per-table LIVE, and recorded in _pid_rekey_prep_sentinel.
--   * scan-embedded-pids.mjs --apply ran: embedded text/json/jsonb pids rewritten.
--   * a restorable pre-cutover backup exists (off-box, restore-validated).
--
-- WHY NO LARGE-TABLE SCAN HERE: the earlier design regex-scanned every pid column of
-- every high-volume table inside this swap to prove it was clean -- untenable downtime
-- (nfl_plays alone is ~25 pid columns; the standalone giant player_changelog is 67.6M
-- rows). This version trusts prep-02's LIVE per-table verify, recorded in the sentinel,
-- and does only a CHEAP CATALOG lookup (sentinel coverage) here. Full data verification
-- runs AFTER the window, outside downtime, via check-pid-rekey-coverage.mjs.
--
-- WHAT THIS DOES (in order, all atomic):
--   1. Guards (all cheap -- catalog / metadata only, NO large-table data scan):
--      new_pid populated; SENTINEL COVERAGE -- every prep-02-scoped pid leaf (partition
--      child OR standalone over threshold) appears in the sentinel (so prep-02 pre-remapped
--      and verified it); and a hard abort if any view/matview depends on the player.pid
--      column (would silently read legacy_pid after the rename).
--   2. Drop the two ngs_prospect_scores_* FKs and player_pkey (before remapping the
--      referencing columns -- otherwise setting a pid to a not-yet-live new value
--      violates the FK).
--   3. Remap every remaining typed pid/%_pid column via a dynamic catalog loop over the
--      SMALL leaves only: relkind 'r', excluding player / player_pair_correlations, and
--      excluding every table already in the sentinel (all of which prep-02 pre-remapped
--      live). What remains is the small standalone tables (e.g. nfl_plays_current_week),
--      so the swap stays short. The sentinel-coverage guard in step 1 guarantees nothing
--      large is left for this loop.
--   4. Re-key player_pair_correlations: drop the pid_a<pid_b CHECK, map both pids and
--      renormalize orientation with LEAST/GREATEST in one statement, re-add the CHECK.
--   5. Swap the key: RENAME pid -> legacy_pid, new_pid -> pid.
--   6. Re-add: PK on pid, a nullable UNIQUE index on legacy_pid, the pid format CHECK,
--      and the two ngs FKs.
--   7. Post-conditions: player count unchanged, legacy_pid non-null+unique, no
--      pair-correlations order violation.
--   8. Drop the sentinel table (transient prep scaffolding -- clean end state).
--
-- RENAME/view-dependency hazard (resolved): RENAME COLUMN preserves view/matview
--   dependencies by attribute number, so a view that SELECTs player.pid would,
--   post-rename, read legacy_pid (old) instead of the new pid. Step 1 now HARD-ABORTS
--   if any view/matview depends specifically on the player.pid column, so such a view
--   must be dropped and recreated against the new pid deliberately. Today no view
--   references player, so the guard is a dormant safety net.
--
-- pid shapes:
--   person (new): ^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$
--   team / unit : ^[A-Z]{2,3}(-(OFF|DEF|DST))?$
--   person (old): ^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$

-- Production carries a 40s server-wide statement_timeout (postgresql.conf). The swap's
-- PK/UNIQUE rebuild and pair-correlations reorientation are individually fast, but this
-- disables the interrupt for the whole swap so no single statement can be canceled
-- mid-transaction. Session-scoped (this psql connection only); does not touch server config.
SET statement_timeout = 0;

CREATE TEMP TABLE _pid_rekey_baseline AS
  SELECT count(*) AS player_count FROM player;

-- ---------------------------------------------------------------------------
-- 1. Guards
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_col integer;
  null_new integer;
  uncovered text;
  dep_view text;
  sentinel_count integer;
  oldest_verify timestamptz;
BEGIN
  SELECT count(*) INTO missing_col FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'player' AND column_name = 'new_pid';
  IF missing_col = 0 THEN
    RAISE EXCEPTION 'cutover: player.new_pid missing -- run prep-01 first';
  END IF;

  SELECT count(*) INTO null_new FROM player WHERE new_pid IS NULL;
  IF null_new > 0 THEN
    RAISE EXCEPTION 'cutover: % player row(s) have NULL new_pid -- prep-01 incomplete', null_new;
  END IF;

  IF to_regclass('_pid_rekey_prep_sentinel') IS NULL THEN
    RAISE EXCEPTION 'cutover: _pid_rekey_prep_sentinel missing -- run prep-01 (creates it) then prep-02 (populates it)';
  END IF;

  -- SENTINEL COVERAGE (cheap: catalog + sentinel metadata, NO data scan). Every pid leaf
  -- that prep-02 is responsible for -- a partition child, OR a standalone leaf whose
  -- reltuples exceeds the size threshold (100000, the SAME literal prep-02's PID_REKEY_
  -- THRESHOLD defaults to) -- must appear in the sentinel, proving prep-02 pre-remapped
  -- and LIVE-verified it. This is the union predicate prep-02 targets, so the two never
  -- drift. If any prep-02-scoped table is absent, prep-02 did not run to completion in the
  -- window: ABORT rather than either (a) leaving stale old pids in a large table the swap
  -- won't touch, or (b) monolithically UPDATE-ing a multi-million-row table inside the
  -- swap. relkind 'r' excludes partitioned PARENTS (an UPDATE on a parent cascades to all
  -- children). Namespace-qualified join avoids a cross-schema name-collision estimate.
  SELECT c.table_name INTO uncovered
  FROM (
    SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND (column_name LIKE '%\_pid' OR column_name = 'pid' OR column_name LIKE 'pid\_%')
  ) c
  JOIN pg_namespace ns ON ns.nspname = current_schema()
  JOIN pg_class pc ON pc.relname = c.table_name AND pc.relnamespace = ns.oid
  WHERE pc.relkind = 'r'
    AND c.table_name <> 'player'
    AND c.table_name <> 'player_pair_correlations'
    AND (pc.relispartition OR pc.reltuples > 100000)
    AND NOT EXISTS (SELECT 1 FROM _pid_rekey_prep_sentinel s WHERE s.table_name = c.table_name)
  LIMIT 1;
  IF uncovered IS NOT NULL THEN
    RAISE EXCEPTION 'cutover: pid leaf % is prep-02-scoped (partition child or > threshold) but absent from the sentinel -- run prep-02 to pre-remap + verify it before the swap', uncovered;
  END IF;

  -- FRESHNESS SURFACING (the sentinel proves a table was verified, not WHEN relative to the
  -- importer pause). The guard trusts presence, not recency; a table sentineled in Phase A
  -- and then written before the pause holds stragglers unless the in-window prep-02 re-run
  -- (runbook B2, after the pause) re-cleaned + re-stamped it. Surface the oldest verify time
  -- so the operator can confirm at the go/no-go gate that B2 ran; any residual straggler is
  -- caught post-cutover by the coverage oracle (outside the window), not here.
  SELECT count(*), min(verified_at) INTO sentinel_count, oldest_verify
    FROM _pid_rekey_prep_sentinel;
  RAISE NOTICE 'cutover: sentinel covers % table(s); oldest prep-02 verify at % -- CONFIRM the in-window prep-02 re-run (B2, after importer pause) is newer than this', sentinel_count, oldest_verify;

  -- Hard guard on the RENAME hazard: a view/matview that selects player.pid would,
  -- after RENAME pid -> legacy_pid, silently read the OLD pid (column dependencies are
  -- preserved by attribute number, not by name). Abort if any view/matview depends
  -- specifically on the player.pid COLUMN (refobjsubid = pid's attnum), forcing it to
  -- be dropped/recreated against the new pid deliberately rather than corrupted
  -- silently. (Today the schema has three views, none referencing player, so this is a
  -- dormant safety net; it fires only if a pid-dependent view is added later.)
  FOR dep_view IN
    SELECT DISTINCT dv.relname
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class dv ON dv.oid = r.ev_class
    JOIN pg_class src ON src.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = d.refobjsubid
    WHERE src.relname = 'player' AND a.attname = 'pid' AND dv.relname <> 'player'
  LOOP
    RAISE EXCEPTION 'cutover: view/matview "%" depends on player.pid and would read legacy_pid after the rename -- drop it, run the cutover, recreate it against the new pid', dep_view;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Drop the FKs and PK that block the remap / rename
-- ---------------------------------------------------------------------------
ALTER TABLE ngs_prospect_scores_history DROP CONSTRAINT IF EXISTS ngs_prospect_scores_history_pid_fkey;
ALTER TABLE ngs_prospect_scores_index   DROP CONSTRAINT IF EXISTS ngs_prospect_scores_index_pid_fkey;
ALTER TABLE player DROP CONSTRAINT player_pkey;

-- ---------------------------------------------------------------------------
-- 3. Remap every remaining (small) typed pid / %_pid column (dynamic catalog loop)
-- ---------------------------------------------------------------------------
-- Operates on relkind 'r' (never a partitioned parent, whose UPDATE cascades monolithically
-- to every child) leaves that are NOT already in the sentinel. Every sentineled table was
-- pre-remapped live by prep-02 (all partition children + all standalone leaves over the
-- size threshold), so what remains is the small standalone tables -- e.g. nfl_plays_current_week
-- (relkind 'r', not a partition, 14 pid columns). The step-1 sentinel-coverage guard
-- guarantees nothing prep-02-scoped is left here, so this loop never touches a large table.
-- Excludes player (the map itself) and player_pair_correlations (step 4). relkind 'r' also
-- naturally excludes views/matviews (never UPDATE-able here).
DO $$
DECLARE
  rec record;
  n bigint;
BEGIN
  FOR rec IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN pg_namespace ns ON ns.nspname = c.table_schema
    JOIN pg_class pc ON pc.relname = c.table_name AND pc.relnamespace = ns.oid
    WHERE c.table_schema = current_schema()
      -- Same three-way column predicate as the guard (step 1) and prep-02, so a small
      -- table whose only pid column is pid_%-shaped is not silently missed. pid_a/pid_b
      -- only ever occur on player_pair_correlations today, which is excluded below and
      -- re-keyed by step 4; a future pid_%-columned small table is remapped here.
      AND (c.column_name LIKE '%\_pid' OR c.column_name = 'pid' OR c.column_name LIKE 'pid\_%')
      AND pc.relkind = 'r'
      AND c.table_name <> 'player'
      AND c.table_name <> 'player_pair_correlations'
      AND NOT EXISTS (SELECT 1 FROM _pid_rekey_prep_sentinel s WHERE s.table_name = c.table_name)
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'UPDATE %I AS t SET %I = player.new_pid FROM player WHERE t.%I = player.pid AND t.%I IS NOT NULL',
      rec.table_name, rec.column_name, rec.column_name, rec.column_name
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'remapped %.%: % row(s)', rec.table_name, rec.column_name, n;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. player_pair_correlations: renormalize orientation under a dropped CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE player_pair_correlations DROP CONSTRAINT player_pair_correlations_pid_order;

-- Map both pids old->new (pa.pid/pb.pid are the OLD pids; player.new_pid the NEW)
-- and re-derive a<b orientation in a single statement -- a bare join-update would
-- flip a pair whose new-serial ordering inverts the old ordering and abort the CHECK.
UPDATE player_pair_correlations ppc
SET pid_a = LEAST(pa.new_pid, pb.new_pid),
    pid_b = GREATEST(pa.new_pid, pb.new_pid)
FROM player pa, player pb
WHERE pa.pid = ppc.pid_a
  AND pb.pid = ppc.pid_b;

ALTER TABLE player_pair_correlations
  ADD CONSTRAINT player_pair_correlations_pid_order CHECK (((pid_a)::text < (pid_b)::text));

-- ---------------------------------------------------------------------------
-- 5. Swap the key
-- ---------------------------------------------------------------------------
ALTER TABLE player RENAME COLUMN pid TO legacy_pid;
ALTER TABLE player RENAME COLUMN new_pid TO pid;

-- ---------------------------------------------------------------------------
-- 6. Re-add PK, legacy_pid alternate key, format CHECK, and the ngs FKs
-- ---------------------------------------------------------------------------
ALTER TABLE player ADD CONSTRAINT player_pkey PRIMARY KEY (pid);

-- Demoted alternate key: retains every pre-migration pid for resolution. Nullable
-- (future college-only mints may have no legacy pid); UNIQUE with default
-- nulls-distinct so multiple future NULLs are allowed.
CREATE UNIQUE INDEX player_legacy_pid_key ON player (legacy_pid);

ALTER TABLE player ADD CONSTRAINT player_pid_format CHECK (
  pid ~ '^[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{6,}$'
  OR pid ~ '^[A-Z]{2,3}(-(OFF|DEF|DST))?$'
);

ALTER TABLE ngs_prospect_scores_history
  ADD CONSTRAINT ngs_prospect_scores_history_pid_fkey FOREIGN KEY (pid) REFERENCES player(pid);
ALTER TABLE ngs_prospect_scores_index
  ADD CONSTRAINT ngs_prospect_scores_index_pid_fkey FOREIGN KEY (pid) REFERENCES player(pid);

-- ---------------------------------------------------------------------------
-- 7. Post-conditions
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  base integer;
  now_count integer;
  null_legacy integer;
  dup_legacy integer;
  bad_order integer;
BEGIN
  SELECT player_count INTO base FROM _pid_rekey_baseline;
  SELECT count(*) INTO now_count FROM player;
  IF now_count <> base THEN
    RAISE EXCEPTION 'cutover: player row count changed % -> %', base, now_count;
  END IF;

  SELECT count(*) INTO null_legacy FROM player WHERE legacy_pid IS NULL;
  IF null_legacy > 0 THEN
    RAISE EXCEPTION 'cutover: % player row(s) have NULL legacy_pid (every migrated row must retain its old pid)', null_legacy;
  END IF;

  SELECT count(*) INTO dup_legacy
    FROM (SELECT legacy_pid FROM player GROUP BY legacy_pid HAVING count(*) > 1) d;
  IF dup_legacy > 0 THEN
    RAISE EXCEPTION 'cutover: % duplicate legacy_pid value(s)', dup_legacy;
  END IF;

  SELECT count(*) INTO bad_order FROM player_pair_correlations WHERE (pid_a)::text >= (pid_b)::text;
  IF bad_order > 0 THEN
    RAISE EXCEPTION 'cutover: % player_pair_correlations row(s) violate pid_a < pid_b', bad_order;
  END IF;

  RAISE NOTICE 'pid-rekey cutover OK: key swapped, % players, legacy_pid retained + unique, pair-correlations reoriented', now_count;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Drop the prep-02 sentinel (transient migration scaffolding). Inside the same
--    transaction: dropped only if every post-condition above passed. Leaves a clean end
--    state -- the sentinel exists solely to bridge prep-02's live verify to the swap.
-- ---------------------------------------------------------------------------
DROP TABLE _pid_rekey_prep_sentinel;
