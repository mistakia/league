-- Immutable player-id (pid) re-key -- ARRAY-column embedded-pid rewrite (post-swap gap fix).
--
-- WHY THIS EXISTS (post-cutover finding, 2026-07-20): the embedded-pid rewrite
-- (scan-embedded-pids.mjs / 2026-07-20-pid-rekey-embedded-rewrite.sql) only covered scalar
-- text/character varying/character/json/jsonb columns. It SKIPPED ARRAY-typed columns. The
-- schema has exactly two array-of-text columns and both embed old pids inside their elements:
--   selection_combination_odds_index.selection_ids  (text[])
--   selection_combination_odds_history.selection_ids (text[])
-- Each element looks like 'ESBID:...|MARKET:...|PID:FNAM-LNAM-YYYY-YYYY-MM-DD|SEL:...|LINE:...'.
-- The coverage oracle's array-blind-spot check flags these as failures, so they must be
-- rewritten to the new pid before the re-key is complete.
--
-- POST-SWAP MAP: the swap already ran, so player.pid is the NEW pid and player.legacy_pid is
-- the OLD pid. Map is legacy_pid (old) -> pid (new). An element whose token has no live player
-- (pre-existing orphan, e.g. a bet on a long-deleted player) is left unchanged -- the coverage
-- oracle treats those as warnings, not failures.
--
-- IDEMPOTENT: only rows whose selection_ids still contain an old-shape token are touched; new
-- pids never match the old shape, so a re-run is a no-op. Each element carries exactly one PID
-- token, so a single regexp_matches (first match) per element suffices. Order is preserved via
-- WITH ORDINALITY. Runs in the downtime window (importers + API paused; the only writer stopped).

SET statement_timeout = 0;

UPDATE selection_combination_odds_index t
SET selection_ids = s.new_arr
FROM (
  SELECT t2.ctid AS cid,
    array_agg(
      CASE WHEN p.pid IS NOT NULL THEN replace(u.elem, m.tok, p.pid) ELSE u.elem END
      ORDER BY u.ord
    ) AS new_arr
  FROM selection_combination_odds_index t2,
       LATERAL unnest(t2.selection_ids) WITH ORDINALITY AS u(elem, ord)
       LEFT JOIN LATERAL (
         SELECT (regexp_matches(u.elem, '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'))[1] AS tok
       ) m ON true
       LEFT JOIN player p ON p.legacy_pid = m.tok
  WHERE t2.selection_ids::text ~ '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'
  GROUP BY t2.ctid
) s
WHERE t.ctid = s.cid;

UPDATE selection_combination_odds_history t
SET selection_ids = s.new_arr
FROM (
  SELECT t2.ctid AS cid,
    array_agg(
      CASE WHEN p.pid IS NOT NULL THEN replace(u.elem, m.tok, p.pid) ELSE u.elem END
      ORDER BY u.ord
    ) AS new_arr
  FROM selection_combination_odds_history t2,
       LATERAL unnest(t2.selection_ids) WITH ORDINALITY AS u(elem, ord)
       LEFT JOIN LATERAL (
         SELECT (regexp_matches(u.elem, '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'))[1] AS tok
       ) m ON true
       LEFT JOIN player p ON p.legacy_pid = m.tok
  WHERE t2.selection_ids::text ~ '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}'
  GROUP BY t2.ctid
) s
WHERE t.ctid = s.cid;

-- Post-condition: zero REAL (mapped) old pids remain in either array column. Orphan tokens
-- (no live player) are allowed and left as-is.
DO $$
DECLARE
  bad integer;
BEGIN
  SELECT count(*) INTO bad FROM (
    SELECT (regexp_matches(u.elem, '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}', 'g'))[1] AS tok
    FROM selection_combination_odds_index, LATERAL unnest(selection_ids) u(elem)
    UNION ALL
    SELECT (regexp_matches(u.elem, '[A-Z]{1,4}-[A-Z]{1,4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}', 'g'))[1]
    FROM selection_combination_odds_history, LATERAL unnest(selection_ids) u(elem)
  ) toks WHERE EXISTS (SELECT 1 FROM player p WHERE p.legacy_pid = toks.tok);
  IF bad > 0 THEN
    RAISE EXCEPTION 'array embedded rewrite: % element(s) still embed a mapped old pid', bad;
  END IF;
  RAISE NOTICE 'array embedded rewrite OK: no real old pid remains in selection_combination_odds_*.selection_ids';
END $$;
