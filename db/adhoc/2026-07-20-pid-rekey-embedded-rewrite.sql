-- Immutable player-id (pid) re-key -- SERVER-SIDE embedded-pid rewrite (small/standalone leaves).
--
-- WHY THIS EXISTS (apply-time finding, 2026-07-20): scan-embedded-pids.mjs --apply rewrites
-- each embedded-pid column one DISTINCT VALUE at a time from the client (a SELECT DISTINCT +
-- an UPDATE ... WHERE col::text = <value> per value). On production placed_wagers.selections
-- carried 61,663 distinct pid-bearing jsonb values across ~64K rows, so that path is
-- O(distinct x rows) with a network round-trip per value -- hours. This adhoc is the
-- server-side equivalent: ONE UPDATE per candidate column that rewrites every row in place via
-- a per-value token-replace function, O(rows), no client round-trips.
--
-- SCOPE: every text/character varying/character/json/jsonb column (excluding the bare-pid
-- columns pid / %_pid / pid_% and the player_changelog.prev/new audit carve-out) on a
-- NON-PARTITION leaf with pg_class.reltuples <= 100000. This mirrors scan-embedded's
-- --skip-large (giants deferred to the post-cutover coverage oracle) and additionally skips
-- partition children (relispartition): the nfl_plays_* families carry pids only in typed
-- columns (remapped by prep-02) and prose text (desc, etc.) that holds no pid token; the live
-- Phase-A scan already swept them and the coverage oracle re-verifies everything.
--
-- IDEMPOTENT: old and new pid namespaces are disjoint (old ...-YYYY-YYYY-MM-DD, new ...-NNNNNN),
-- so a re-run only re-touches rows still holding a mapped old token. Unmapped pattern-shaped
-- tokens (pre-existing orphans whose player row is gone) are left as-is -- the coverage oracle
-- treats them as warnings, not failures, exactly like scan-embedded's verify.
--
-- PREREQ: prep-01 populated player.new_pid (this runs PRE-swap, so the map is pid -> new_pid).
-- Run in the downtime window, importers paused, before the cutover swap.

SET statement_timeout = 0;

-- Old->new map (pre-swap): pid (old) -> new_pid (new), person rows only (team/unit new_pid=pid
-- are excluded by pid <> new_pid).
CREATE TEMP TABLE _pid_emap AS
  SELECT pid AS old_pid, new_pid FROM player
  WHERE new_pid IS NOT NULL AND pid <> new_pid;
CREATE UNIQUE INDEX _pid_emap_old_idx ON _pid_emap (old_pid);

-- Per-value rewrite: replace every mapped old-pid token inside a text value with its new pid.
-- A token with no map row (orphan) is left untouched. New pids never match the old shape, so a
-- replaced token can never re-match. Tokens are processed LONGEST-FIRST: the letter groups are
-- 1-4 chars (X-padded to 4 in production, so all 25 chars today, but the pattern admits shorter),
-- so a shorter old pid CAN be a suffix-substring of a longer one (e.g. AB-CD-... inside XAB-CD-...).
-- Replacing the longest token first (to a new pid with no old-shape) removes it before any shorter
-- token's global replace() runs, so the shorter replace can never mangle the tail of a longer
-- occurrence. This makes the rewrite substring-safe regardless of letter-group lengths.
CREATE OR REPLACE FUNCTION pg_temp._pid_rw(input text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE
  result text := input;
  tok text;
  np text;
BEGIN
  FOR tok IN
    SELECT t FROM (
      SELECT DISTINCT (regexp_matches(input, '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}', 'g'))[1] AS t
    ) toks
    ORDER BY length(t) DESC
  LOOP
    SELECT new_pid INTO np FROM _pid_emap WHERE old_pid = tok;
    IF np IS NOT NULL THEN
      result := replace(result, tok, np);
    END IF;
  END LOOP;
  RETURN result;
END $f$;

-- Rewrite loop over the in-scope candidate columns.
DO $$
DECLARE
  rec record;
  n bigint;
  cast_suffix text;
BEGIN
  FOR rec IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN pg_namespace ns ON ns.nspname = c.table_schema
    JOIN pg_class pc ON pc.relname = c.table_name AND pc.relnamespace = ns.oid
    WHERE c.table_schema = current_schema()
      AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
      AND c.column_name <> 'pid'
      AND c.column_name NOT LIKE '%\_pid'
      AND c.column_name NOT LIKE 'pid\_%'
      AND pc.relkind = 'r'
      AND NOT pc.relispartition
      AND pc.reltuples <= 100000
      -- Generated columns (e.g. nfl_games.nfl_week_id) cannot be targeted by UPDATE ... SET;
      -- they are derived, never hold a free-text pid, and are recomputed from their inputs.
      AND c.is_generated = 'NEVER'
      AND NOT (c.table_name = 'player_changelog' AND c.column_name IN ('prev', 'new'))
    ORDER BY c.table_name, c.column_name
  LOOP
    cast_suffix := CASE rec.data_type WHEN 'jsonb' THEN '::jsonb' WHEN 'json' THEN '::json' ELSE '' END;
    EXECUTE format(
      'UPDATE %I SET %I = pg_temp._pid_rw(%I::text)%s WHERE %I::text ~ %L',
      rec.table_name, rec.column_name, rec.column_name, cast_suffix, rec.column_name,
      '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'embedded rewrite %.%: % row(s)', rec.table_name, rec.column_name, n;
    END IF;
  END LOOP;
END $$;

DROP FUNCTION pg_temp._pid_rw(text);
