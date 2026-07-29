-- STATUS: APPLIED 2026-07-29 against league_production
--
-- Partition `projections_history` by `season_year` (RANGE), matching the shape
-- `projections_index` already has: one partition per season y2020..y2026 plus a
-- `_default`.
--
-- 9,506,764 rows / 2381 MB at time of writing, spanning exactly 2020-2026 --
-- the same span `projections_index` is partitioned over, so the two tables end
-- up with identical partition sets.
--
-- WHY
--
-- The table is unpartitioned and unbounded, and 13 importers append to it. It is
-- also the table season-level retention has to act on, and partitioning is the
-- mechanism that makes that cheap: detaching a completed season becomes a
-- metadata-only DETACH instead of a multi-million-row copy-and-delete. That is
-- precisely why `scripts/archive-projections.mjs` was DELETED rather than
-- rewritten -- two-table archival was a workaround for MySQL's lack of
-- declarative partitioning, and rewriting it would have rebuilt the inferior
-- mechanism. This file is the other half of that decision.
--
-- METHOD
--
-- Partitioning an existing table requires a rewrite: there is no way to convert
-- in place. Create the partitioned table, copy, swap. The whole file runs in one
-- transaction (`yarn db:exec` wraps it), so a failure anywhere leaves the
-- original table untouched.
--
-- The `LOCK TABLE ... ACCESS EXCLUSIVE` is load-bearing and NOT redundant.
-- Without it, an importer committing during the copy writes rows into the old
-- table AFTER this transaction's snapshot was taken, and the swap would silently
-- discard them. Taking the lock up front makes concurrent writers wait rather
-- than lose data. It does mean the importers block for the duration of the copy,
-- which is why this is applied outside the importer windows (weekly importers
-- 01:00-02:30 UTC in months 1,2,9-12; season importers 00:00 UTC in months 6-8;
-- `process-projections.mjs` hourly at :30).
--
-- `nfl_week_id` is a GENERATED column, so it must not be written to. The copy
-- builds its column list from the catalog filtering on `attgenerated = ''`,
-- which excludes it by construction rather than by a hand-maintained list that
-- would rot the next time a column is added.
--
-- `season_year` is NULLABLE. For RANGE partitioning a NULL key routes to the
-- DEFAULT partition, which is the reason `_default` exists here and in
-- `projections_index` -- a row with a NULL or out-of-range `season_year` must
-- land somewhere rather than raise on insert.
--
-- All 15 `.insert()` call sites keep working unchanged: partition routing on
-- `season_year` is transparent to the client, and the natural-key ON CONFLICT
-- target is preserved because `season_year` is already part of that key (the
-- partition key must be a member of any unique index on a partitioned table,
-- and it is).

-- `yarn db:exec` already wraps this file in a single transaction with
-- ON_ERROR_STOP=1, so no explicit BEGIN/COMMIT here.

-- The 40s statement_timeout from the server config would cancel the copy
-- mid-flight and roll the whole thing back.
SET LOCAL statement_timeout = 0;

-- Guard: refuse to run twice.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'projections_history' AND relkind = 'p'
  ) THEN
    RAISE EXCEPTION 'projections_history is already partitioned; nothing to do';
  END IF;
END $$;

-- Block concurrent writers for the duration; see METHOD above.
LOCK TABLE public.projections_history IN ACCESS EXCLUSIVE MODE;

CREATE TABLE public.projections_history_new (
  LIKE public.projections_history
    INCLUDING DEFAULTS
    INCLUDING GENERATED
    INCLUDING CONSTRAINTS
    INCLUDING COMMENTS
) PARTITION BY RANGE (season_year);

CREATE TABLE public.projections_history_y2020
  PARTITION OF public.projections_history_new FOR VALUES FROM (2020) TO (2021);
CREATE TABLE public.projections_history_y2021
  PARTITION OF public.projections_history_new FOR VALUES FROM (2021) TO (2022);
CREATE TABLE public.projections_history_y2022
  PARTITION OF public.projections_history_new FOR VALUES FROM (2022) TO (2023);
CREATE TABLE public.projections_history_y2023
  PARTITION OF public.projections_history_new FOR VALUES FROM (2023) TO (2024);
CREATE TABLE public.projections_history_y2024
  PARTITION OF public.projections_history_new FOR VALUES FROM (2024) TO (2025);
CREATE TABLE public.projections_history_y2025
  PARTITION OF public.projections_history_new FOR VALUES FROM (2025) TO (2026);
CREATE TABLE public.projections_history_y2026
  PARTITION OF public.projections_history_new FOR VALUES FROM (2026) TO (2027);
CREATE TABLE public.projections_history_default
  PARTITION OF public.projections_history_new DEFAULT;

-- Copy. Column list comes from the catalog so the GENERATED column is excluded
-- structurally.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.projections_history'::regclass
    AND attnum > 0
    AND NOT attisdropped
    AND attgenerated = '';

  EXECUTE format(
    'INSERT INTO public.projections_history_new (%s) SELECT %s FROM public.projections_history',
    cols, cols
  );
END $$;

-- Guard: the swap below is irreversible within this transaction's intent, so
-- prove the copy is complete before dropping the original.
DO $$
DECLARE old_count bigint; new_count bigint;
BEGIN
  SELECT count(*) INTO old_count FROM public.projections_history;
  SELECT count(*) INTO new_count FROM public.projections_history_new;

  IF old_count <> new_count THEN
    RAISE EXCEPTION
      'copy incomplete: original has % rows, partitioned copy has %',
      old_count, new_count;
  END IF;

  RAISE NOTICE 'copied % rows into partitioned projections_history', new_count;
END $$;

-- `LIKE` does not copy privileges; restore the league_reader grant.
GRANT SELECT ON TABLE public.projections_history_new TO league_reader;

-- Swap. This happens BEFORE index creation, not after: index names are
-- schema-scoped, and the original table still holds
-- `idx_projections_history_natural_key` and friends until it is dropped.
-- Creating the new indexes first collides on those names.
DROP TABLE public.projections_history;
ALTER TABLE public.projections_history_new RENAME TO projections_history;

-- Indexes, built after the copy so the copy is not paying to maintain them.
-- Creating them on the partitioned parent cascades to every partition.
CREATE UNIQUE INDEX idx_projections_history_natural_key
  ON public.projections_history
  USING btree (sourceid, pid, userid, generated_at, week, season_year, season_type);
CREATE INDEX idx_projections_history_nfl_week_id
  ON public.projections_history USING btree (nfl_week_id);
CREATE INDEX idx_projections_history_pid
  ON public.projections_history USING btree (pid);

-- Postgres auto-names cascaded partition indexes after the partition and the
-- indexed columns. Rename them to the `<partition>_<purpose>_idx` convention
-- `projections_index` already uses, so the two tables read the same way.
DO $$
DECLARE rec record; desired text;
BEGIN
  FOR rec IN
    SELECT child.relname AS child_name,
           part.relname  AS part_name,
           CASE parent_idx.relname
             WHEN 'idx_projections_history_natural_key' THEN 'natural_key_idx'
             WHEN 'idx_projections_history_nfl_week_id' THEN 'nfl_week_id_idx'
             WHEN 'idx_projections_history_pid'         THEN 'pid_idx'
           END AS suffix
    FROM pg_inherits inh
    JOIN pg_class child      ON child.oid = inh.inhrelid
    JOIN pg_class parent_idx ON parent_idx.oid = inh.inhparent
    JOIN pg_index ix         ON ix.indexrelid = child.oid
    JOIN pg_class part       ON part.oid = ix.indrelid
    WHERE parent_idx.relname IN (
      'idx_projections_history_natural_key',
      'idx_projections_history_nfl_week_id',
      'idx_projections_history_pid'
    )
  LOOP
    desired := rec.part_name || '_' || rec.suffix;
    IF rec.child_name <> desired THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.child_name, desired);
    END IF;
  END LOOP;
END $$;
