-- Migrate league formats to stable opaque IDs.
--
-- Task: user:task/league/migrate-league-formats-to-stable-ids.md
-- Replaces content-derived scoring_format_hash / league_format_hash with stable
-- opaque IDs: snake_case slugs for the named catalog (9 scoring / 22 league),
-- gen_random_uuid() for the user-created long tail (56 + 836).
--
-- Single transaction. The yarn db:exec wrapper also sets ON_ERROR_STOP=1
-- and wraps in BEGIN/COMMIT; the explicit \set and BEGIN/COMMIT in this
-- file are defense-in-depth for manual psql -f invocation. All worker
-- processes and the process-projections cron MUST be stopped before this
-- runs (see task plan, "Pre-cutover: stop worker processes"). Pre-cutover
-- backup: postgres-backup.sh -c -p -n pre-format-id-migration.
--
-- Wall-time note: each ALTER COLUMN ... SET NOT NULL in step 8 triggers a
-- full sequential scan to verify, even though the preceding DO block has
-- already asserted zero NULLs. The NOT VALID + VALIDATE CONSTRAINT pattern
-- that skips this scan only pays off outside a single-transaction context
-- (VALIDATE itself scans within a transaction). Accepted as-is; downtime is
-- acceptable per plan and the simpler SET NOT NULL form audits better.
--
-- Notes on the table set actually touched (verified via schema-scan at
-- authoring time; plan step 8 enumeration corrected):
--   - leagues table has NO format-hash column. Excluded.
--   - league_player_projection_values has NO format-hash column (keyed by
--     pid, lid, week, year and joins to seasons for the format). Excluded.
--   - Tables with scoring_format_hash: league_formats, league_scoring_formats
--     (target), player_variance (composite PK), seasons,
--     scoring_format_player_{careerlogs,gamelogs,projection_points,seasonlogs}.
--   - Tables with league_format_hash: league_formats (target),
--     league_team_player_seasonlogs (composite PK),
--     league_format_{draft_pick_value,player_careerlogs,player_gamelogs,
--                    player_projection_values,player_seasonlogs},
--     roster_asset_holding, seasons.
--
-- Scoring-format catalog collapses 10 source keys to 9 DB rows because
-- scoring_formats.draftkings and scoring_formats.ppr_lower_turnover share
-- byte-identical configs (hash ad64bf40...). Canonical slug: draftkings.
-- See task observation [plan-revised].
--
-- Rollback (if the deploy goes bad post-commit): drop the affected tables
-- and pg_restore from the pre-format-id-migration backup
-- (cache-tables subset for league_*_formats + projection/log family;
-- projections subset for projections / projections_index).

\set ON_ERROR_STOP on

BEGIN;

-- =====================================================================
-- Step 1: pgcrypto for gen_random_uuid()
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- Step 2: Drop player_variance FK to league_scoring_formats(scoring_format_hash)
-- =====================================================================

ALTER TABLE public.player_variance
  DROP CONSTRAINT IF EXISTS player_variance_scoring_format_fkey;

-- =====================================================================
-- Step 3: Drop trg_cmv_classify_league_format trigger and the function
--         (recreated in step 10 with scoring_format_id)
-- =====================================================================

DROP TRIGGER IF EXISTS trg_cmv_classify_league_format ON public.league_formats;
DROP FUNCTION IF EXISTS public.cmv_classify_league_format();

-- =====================================================================
-- Step 4: Backfill NULLs to defaults on every column in the upcoming
--         unique-constraint tuples, then SET NOT NULL where missing.
--         (Most config cols are already NOT NULL in the schema; this
--         covers the known offenders.)
-- =====================================================================

-- league_scoring_formats.fum_ret_td: numeric DEFAULT 0, NO NOT NULL.
UPDATE public.league_scoring_formats SET fum_ret_td = 0 WHERE fum_ret_td IS NULL;
ALTER TABLE public.league_scoring_formats ALTER COLUMN fum_ret_td SET NOT NULL;

-- league_formats.min_bid: smallint DEFAULT '0'::smallint, NO NOT NULL.
UPDATE public.league_formats SET min_bid = 0 WHERE min_bid IS NULL;
ALTER TABLE public.league_formats ALTER COLUMN min_bid SET NOT NULL;

-- =====================================================================
-- Step 5: league_scoring_formats — add id, backfill, swap PK
-- =====================================================================

ALTER TABLE public.league_scoring_formats ADD COLUMN id text;

-- Named-catalog slugs (9 distinct hashes -> 9 distinct canonical slugs).
-- draftkings and ppr_lower_turnover share hash ad64bf40...; canonical is draftkings.
UPDATE public.league_scoring_formats SET id = 'draftkings'
  WHERE scoring_format_hash = 'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e';
UPDATE public.league_scoring_formats SET id = 'fanduel'
  WHERE scoring_format_hash = '04fe44246221c6ee47cba713ac4aad95f4b1f28e50078e7f12ecfb0fed257933';
UPDATE public.league_scoring_formats SET id = 'genesis'
  WHERE scoring_format_hash = 'e984217bc49da7f112d0fdbbb371a32666b0fb336383fe42da8ab19357eacd51';
UPDATE public.league_scoring_formats SET id = 'half_ppr'
  WHERE scoring_format_hash = '2aeca584a5d1f3e48a68f9ba35ab5660c7ffce5e107a8025a346948840e74ff0';
UPDATE public.league_scoring_formats SET id = 'half_ppr_lower_turnover'
  WHERE scoring_format_hash = '8d25e53c0df6b8b02fa02fa14309ae6b4250a5a92812e2bb376222dddec6554a';
UPDATE public.league_scoring_formats SET id = 'ppr'
  WHERE scoring_format_hash = 'dcfbfc93fb203e7ea66b25927805f076a102e31d8830af03e7b9754a19be5e63';
UPDATE public.league_scoring_formats SET id = 'sfb15_mfl'
  WHERE scoring_format_hash = '88b18fa96c0033c7811fc7163d8ad4556fdd51d53c44a2b71dace326312f1719';
UPDATE public.league_scoring_formats SET id = 'sfb15_sleeper'
  WHERE scoring_format_hash = 'ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286';
UPDATE public.league_scoring_formats SET id = 'standard'
  WHERE scoring_format_hash = 'b45d8818039422afa250f09bc4dd373edda837f8ed9f63386988b40294e010f3';

-- Assert all 9 expected named slugs were matched (no missing prod rows).
DO $$
DECLARE
  expected_slugs text[] := ARRAY['draftkings','fanduel','genesis','half_ppr','half_ppr_lower_turnover','ppr','sfb15_mfl','sfb15_sleeper','standard'];
  s text;
BEGIN
  FOREACH s IN ARRAY expected_slugs LOOP
    IF NOT EXISTS (SELECT 1 FROM public.league_scoring_formats WHERE id = s) THEN
      RAISE EXCEPTION 'expected named scoring slug % missing from league_scoring_formats post-backfill', s;
    END IF;
  END LOOP;
END $$;

-- User-created long tail gets gen_random_uuid().
UPDATE public.league_scoring_formats SET id = gen_random_uuid()::text WHERE id IS NULL;

ALTER TABLE public.league_scoring_formats ALTER COLUMN id SET NOT NULL;
DROP INDEX public.idx_24671_scoring_format_hash;
ALTER TABLE public.league_scoring_formats ADD CONSTRAINT league_scoring_formats_pkey PRIMARY KEY (id);
ALTER TABLE public.league_scoring_formats ADD CONSTRAINT league_scoring_formats_config_unique
  UNIQUE (pa, pc, py, ints, tdp, ra, ry, tdr, rec, rbrec, wrrec, terec, recy, twoptc, tdrec,
          fuml, prtd, krtd, fum_ret_td, trg, rush_first_down, rec_first_down, exclude_qb_kneels);

-- =====================================================================
-- Step 6: league_formats — add id, backfill, swap PK (unique constraint
--         deferred to step 11 because it references scoring_format_id which
--         doesn't exist on this table until step 8).
-- =====================================================================

ALTER TABLE public.league_formats ADD COLUMN id text;

UPDATE public.league_formats SET id = 'draftkings_classic'
  WHERE league_format_hash = '52dff178c05048af9f38e4f4b5c2372623619476333b0cb20b6783f6d9513e34';
UPDATE public.league_formats SET id = 'genesis_10_team'
  WHERE league_format_hash = 'a54416be9596b2a3dbdac2c5fd40d0bea908cd74b84e16416713bbaf45c6bfc5';
UPDATE public.league_formats SET id = 'half_ppr_10_team'
  WHERE league_format_hash = '4589ff38eb918e2eebe4857a3cbacf5d6ce462519489712314fdba6751ac7fad';
UPDATE public.league_formats SET id = 'half_ppr_10_team_superflex'
  WHERE league_format_hash = '9bc7e990b650116fbb99a31868651072bde52fb1f124ca54e6dbc27af4df9a5c';
UPDATE public.league_formats SET id = 'half_ppr_12_team'
  WHERE league_format_hash = '05e1ca2b3be59d771a2faf07429f6ed08ee746e93f86078bf8970dc34ce73cc0';
UPDATE public.league_formats SET id = 'half_ppr_12_team_superflex'
  WHERE league_format_hash = 'd7b368c3da7d431b59f87ef1b34b6792ca71e586a2303e0a8d508b77327b85ff';
UPDATE public.league_formats SET id = 'half_ppr_lower_turnover_10_team'
  WHERE league_format_hash = 'aac3deee2f4350ad9dd1c641bd0e8abb16a511c1e8e5bf8dfbc050a7e78381fe';
UPDATE public.league_formats SET id = 'half_ppr_lower_turnover_10_team_superflex'
  WHERE league_format_hash = '06c0a9c8f5ed702c119119bd29bd65e85e41bfdd9f2cdc2f2bc3e8662f484ff3';
UPDATE public.league_formats SET id = 'half_ppr_lower_turnover_12_team'
  WHERE league_format_hash = '00d919efb84e55e7a06a9e7adbe6fc3bcbe464ab57f3d5a03097f740d66812e9';
UPDATE public.league_formats SET id = 'half_ppr_lower_turnover_12_team_superflex'
  WHERE league_format_hash = '9826b6010f7c678b002e16e856f87df2fb584918a63875482a86b7c765fa0fdf';
UPDATE public.league_formats SET id = 'ppr_10_team'
  WHERE league_format_hash = '8b57e86cda433bfb910f82628d84371f10d0ea604e5de0d9636d5418f86f78b9';
UPDATE public.league_formats SET id = 'ppr_10_team_superflex'
  WHERE league_format_hash = '125a362993074cb696f8f2254e11da33b6366b65f1f957dfd3a60f4bfe8b6140';
UPDATE public.league_formats SET id = 'ppr_12_team'
  WHERE league_format_hash = 'd8178f372cc25c7b38577d849bfde25b66833ac351fca0eb9ea2b07de03c2ccd';
UPDATE public.league_formats SET id = 'ppr_12_team_superflex'
  WHERE league_format_hash = '7c94c1aa1d7addd37a9b4f0825e06af1a147276f74a2e76c995d2a5d3c84ca83';
UPDATE public.league_formats SET id = 'ppr_lower_turnover_10_team'
  WHERE league_format_hash = '77ac5bb9b36b35ff77aaf308ace390a13ca5493706131f94ffc4374995d61a1d';
UPDATE public.league_formats SET id = 'ppr_lower_turnover_10_team_superflex'
  WHERE league_format_hash = '8f73f29d9bdd2174995a287de7b297a29c3f86f063f09fca63f598f5c2a2f78a';
UPDATE public.league_formats SET id = 'ppr_lower_turnover_12_team'
  WHERE league_format_hash = '51624cbf8f71b7a3f4c542c591e57f40e92a52809973498f0dea3eb8400f6806';
UPDATE public.league_formats SET id = 'ppr_lower_turnover_12_team_superflex'
  WHERE league_format_hash = '560dba8a15d7af913b13fb390b3302414ba4efe63822e6258e88c9b1f6eb272a';
UPDATE public.league_formats SET id = 'sfb15_mfl'
  WHERE league_format_hash = '5cbab5e165751c56e52f51b8360e95580e744842ce8080d268a4a8441340bcb9';
UPDATE public.league_formats SET id = 'sfb15_sleeper'
  WHERE league_format_hash = 'ea8e0f39a320a6fdf5cf4dda3d1cd139bc4427defd9178c6a75341b255e5e2cd';
UPDATE public.league_formats SET id = 'standard_10_team'
  WHERE league_format_hash = 'ac4bd2c40b5b69c071935850c433997ca9cb144337f0aa73e84f10322a5d68fb';
UPDATE public.league_formats SET id = 'standard_12_team'
  WHERE league_format_hash = '5e54d0dce15b5377d934ce3324f8a754854e77237120f17bfb89aba8b5dc5e09';

DO $$
DECLARE
  expected_slugs text[] := ARRAY['draftkings_classic','genesis_10_team','half_ppr_10_team','half_ppr_10_team_superflex',
    'half_ppr_12_team','half_ppr_12_team_superflex','half_ppr_lower_turnover_10_team',
    'half_ppr_lower_turnover_10_team_superflex','half_ppr_lower_turnover_12_team',
    'half_ppr_lower_turnover_12_team_superflex','ppr_10_team','ppr_10_team_superflex','ppr_12_team',
    'ppr_12_team_superflex','ppr_lower_turnover_10_team','ppr_lower_turnover_10_team_superflex',
    'ppr_lower_turnover_12_team','ppr_lower_turnover_12_team_superflex','sfb15_mfl','sfb15_sleeper',
    'standard_10_team','standard_12_team'];
  s text;
BEGIN
  FOREACH s IN ARRAY expected_slugs LOOP
    IF NOT EXISTS (SELECT 1 FROM public.league_formats WHERE id = s) THEN
      RAISE EXCEPTION 'expected named league slug % missing from league_formats post-backfill', s;
    END IF;
  END LOOP;
END $$;

UPDATE public.league_formats SET id = gen_random_uuid()::text WHERE id IS NULL;

ALTER TABLE public.league_formats ALTER COLUMN id SET NOT NULL;
DROP INDEX public.idx_24647_league_format_hash;
ALTER TABLE public.league_formats ADD CONSTRAINT league_formats_pkey PRIMARY KEY (id);

-- =====================================================================
-- Step 7: league_formats.pricing_model
-- =====================================================================

ALTER TABLE public.league_formats
  ADD COLUMN pricing_model text NOT NULL DEFAULT 'auction';
UPDATE public.league_formats SET pricing_model = 'dfs_fixed' WHERE id = 'draftkings_classic';
ALTER TABLE public.league_formats
  ADD CONSTRAINT league_formats_pricing_model_check CHECK (pricing_model IN ('auction', 'dfs_fixed'));

-- =====================================================================
-- Step 8: Referencing tables — add new id column, backfill via join,
--         drop old PKs/indexes/columns, add FKs, recreate indexes.
--
-- Substep ordering (per plan):
--   (a) all tables: add new column nullable
--   (b) all tables: backfill via join to parent (parent still has old hash)
--                   + zero-NULL assertion
--   (c) composite-PK tables: DROP PK
--   (d) non-PK tables: SET NOT NULL → drop old indexes → drop old col
--                      → add FK → recreate indexes
--   (e) composite-PK tables: drop old col → SET NOT NULL → add new PK
--                            → add FK → recreate indexes
-- =====================================================================

-- ----- (a0) Tier-1 cleanup: drop orphan (lid, year) data -----
--
-- 127 seasons rows reference league_format_hashes that no longer exist in
-- league_formats (residue from a past league_formats cleanup that didn't
-- cascade-nullify back-references). Investigation: zero downstream/computed
-- rows are tagged with any of the 11 orphan hashes (league_format_player_*,
-- league_team_player_seasonlogs, league_format_draft_pick_value all empty);
-- the only collateral is the rosters/rosters_players/transactions belonging
-- to those exact (lid, year) pairs (all 2021-2022, ~884 rows total). All 115
-- affected lids are dormant since 2022 except lid 4 (last visit 2025-06-12)
-- which keeps its non-orphan years.
--
-- See user:task/league/migrate-league-formats-to-stable-ids.md for the
-- decision rationale.

DO $$
DECLARE
  r record;
  orphan_pairs_count integer;
  rp_deleted integer;
  tx_deleted integer;
  r_deleted integer;
  s_deleted integer;
BEGIN
  CREATE TEMP TABLE orphan_pairs ON COMMIT DROP AS
    SELECT s.lid, s.year, s.league_format_hash
    FROM public.seasons s
    LEFT JOIN public.league_formats lf
      ON lf.league_format_hash = s.league_format_hash
    WHERE s.league_format_hash IS NOT NULL
      AND lf.league_format_hash IS NULL;

  SELECT COUNT(*) INTO orphan_pairs_count FROM orphan_pairs;
  RAISE NOTICE 'orphan (lid, year) pairs to clean: %', orphan_pairs_count;

  FOR r IN SELECT lid, year, league_format_hash FROM orphan_pairs ORDER BY lid, year LOOP
    RAISE NOTICE '  lid=% year=% hash=%', r.lid, r.year, r.league_format_hash;
  END LOOP;

  DELETE FROM public.rosters_players rp
    USING orphan_pairs o
    WHERE rp.lid = o.lid AND rp.year = o.year;
  GET DIAGNOSTICS rp_deleted = ROW_COUNT;

  DELETE FROM public.transactions t
    USING orphan_pairs o
    WHERE t.lid = o.lid AND t.year = o.year;
  GET DIAGNOSTICS tx_deleted = ROW_COUNT;

  DELETE FROM public.rosters rs
    USING orphan_pairs o
    WHERE rs.lid = o.lid AND rs.year = o.year;
  GET DIAGNOSTICS r_deleted = ROW_COUNT;

  DELETE FROM public.seasons s
    USING orphan_pairs o
    WHERE s.lid = o.lid AND s.year = o.year;
  GET DIAGNOSTICS s_deleted = ROW_COUNT;

  RAISE NOTICE 'tier-1 cleanup: deleted rosters_players=%, transactions=%, rosters=%, seasons=%',
    rp_deleted, tx_deleted, r_deleted, s_deleted;
END $$;

-- ----- (a1) Tier-1 cleanup: drop orphan precomputed format-keyed analytics -----
--
-- league_format_player_projection_values and league_format_draft_pick_value
-- carry rows tagged with league_format_hashes that no longer exist in
-- league_formats (same residue class as the seasons orphans but in computed
-- tables rather than user data). These are precomputed by scripts/process-
-- projections.mjs and scripts/calculate-draft-pick-value.mjs respectively
-- and are inert without a parent format. Survey at authoring time:
--   league_format_player_projection_values: 1,262,708 rows / 21 hashes (2021-2025)
--   league_format_draft_pick_value:         87 rows / 1 hash

DO $$
DECLARE
  ppv_deleted bigint;
  dpv_deleted bigint;
BEGIN
  DELETE FROM public.league_format_player_projection_values t
    WHERE t.league_format_hash IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.league_formats lf
        WHERE lf.league_format_hash = t.league_format_hash
      );
  GET DIAGNOSTICS ppv_deleted = ROW_COUNT;

  DELETE FROM public.league_format_draft_pick_value t
    WHERE t.league_format_hash IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.league_formats lf
        WHERE lf.league_format_hash = t.league_format_hash
      );
  GET DIAGNOSTICS dpv_deleted = ROW_COUNT;

  RAISE NOTICE 'tier-1 cleanup (computed): deleted league_format_player_projection_values=%, league_format_draft_pick_value=%',
    ppv_deleted, dpv_deleted;
END $$;

-- ----- (a) Add new id columns on every referencing table -----

-- league_formats also has a scoring_format_hash referencing column.
ALTER TABLE public.league_formats ADD COLUMN scoring_format_id text;

ALTER TABLE public.seasons ADD COLUMN scoring_format_id text;
ALTER TABLE public.seasons ADD COLUMN league_format_id text;

ALTER TABLE public.player_variance ADD COLUMN scoring_format_id text;
ALTER TABLE public.scoring_format_player_careerlogs ADD COLUMN scoring_format_id text;
ALTER TABLE public.scoring_format_player_gamelogs ADD COLUMN scoring_format_id text;
ALTER TABLE public.scoring_format_player_projection_points ADD COLUMN scoring_format_id text;
ALTER TABLE public.scoring_format_player_seasonlogs ADD COLUMN scoring_format_id text;

ALTER TABLE public.league_team_player_seasonlogs ADD COLUMN league_format_id text;
ALTER TABLE public.league_format_draft_pick_value ADD COLUMN league_format_id text;
ALTER TABLE public.league_format_player_careerlogs ADD COLUMN league_format_id text;
ALTER TABLE public.league_format_player_gamelogs ADD COLUMN league_format_id text;
ALTER TABLE public.league_format_player_projection_values ADD COLUMN league_format_id text;
ALTER TABLE public.league_format_player_seasonlogs ADD COLUMN league_format_id text;
ALTER TABLE public.roster_asset_holding ADD COLUMN league_format_id text;

-- ----- (b) Backfill from parent (parent.id is populated; parent.scoring_format_hash still exists) -----

-- league_formats.scoring_format_id (the referencing column on this table)
UPDATE public.league_formats lf SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE lf.scoring_format_hash = sf.scoring_format_hash;

UPDATE public.seasons s SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE s.scoring_format_hash = sf.scoring_format_hash;
UPDATE public.seasons s SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE s.league_format_hash = lf.league_format_hash;

UPDATE public.player_variance pv SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE pv.scoring_format_hash = sf.scoring_format_hash;

UPDATE public.scoring_format_player_careerlogs t SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE t.scoring_format_hash = sf.scoring_format_hash;
UPDATE public.scoring_format_player_gamelogs t SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE t.scoring_format_hash = sf.scoring_format_hash;
UPDATE public.scoring_format_player_projection_points t SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE t.scoring_format_hash = sf.scoring_format_hash;
UPDATE public.scoring_format_player_seasonlogs t SET scoring_format_id = sf.id
  FROM public.league_scoring_formats sf
  WHERE t.scoring_format_hash = sf.scoring_format_hash;

UPDATE public.league_team_player_seasonlogs t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;
UPDATE public.league_format_draft_pick_value t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;
UPDATE public.league_format_player_careerlogs t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;
UPDATE public.league_format_player_gamelogs t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;
UPDATE public.league_format_player_projection_values t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;
UPDATE public.league_format_player_seasonlogs t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;
UPDATE public.roster_asset_holding t SET league_format_id = lf.id
  FROM public.league_formats lf
  WHERE t.league_format_hash = lf.league_format_hash;

-- Assert zero NULLs on each newly-populated column (would indicate orphans
-- referencing hashes no longer in the parent — should not happen given the
-- parent UPDATEs in steps 5-6 left every existing parent row addressable).
DO $$
DECLARE
  r record;
  n integer;
  checks text[][] := ARRAY[
    ARRAY['league_formats','scoring_format_id'],
    ARRAY['seasons','scoring_format_id'],
    ARRAY['seasons','league_format_id'],
    ARRAY['player_variance','scoring_format_id'],
    ARRAY['scoring_format_player_careerlogs','scoring_format_id'],
    ARRAY['scoring_format_player_gamelogs','scoring_format_id'],
    ARRAY['scoring_format_player_projection_points','scoring_format_id'],
    ARRAY['scoring_format_player_seasonlogs','scoring_format_id'],
    ARRAY['league_team_player_seasonlogs','league_format_id'],
    ARRAY['league_format_draft_pick_value','league_format_id'],
    ARRAY['league_format_player_careerlogs','league_format_id'],
    ARRAY['league_format_player_gamelogs','league_format_id'],
    ARRAY['league_format_player_projection_values','league_format_id'],
    ARRAY['league_format_player_seasonlogs','league_format_id'],
    ARRAY['roster_asset_holding','league_format_id']
  ];
BEGIN
  FOR i IN 1..array_length(checks, 1) LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE %I IS NULL', checks[i][1], checks[i][2]) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'backfill orphan: %.% has % NULL rows', checks[i][1], checks[i][2], n;
    END IF;
  END LOOP;
END $$;

-- ----- (c) Drop composite PKs that include the hash column -----

ALTER TABLE public.player_variance DROP CONSTRAINT player_variance_pkey;
ALTER TABLE public.league_team_player_seasonlogs DROP CONSTRAINT league_team_player_seasonlogs_pkey;

-- ----- (d) Non-PK tables: SET NOT NULL → drop old indexes → drop old col → add FK → recreate indexes -----

-- league_formats (referencing column; the table's own PK was already swapped to id in step 6)
ALTER TABLE public.league_formats ALTER COLUMN scoring_format_id SET NOT NULL;
ALTER TABLE public.league_formats DROP COLUMN scoring_format_hash;
ALTER TABLE public.league_formats
  ADD CONSTRAINT league_formats_scoring_format_id_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;

-- seasons
ALTER TABLE public.seasons ALTER COLUMN scoring_format_id SET NOT NULL;
ALTER TABLE public.seasons ALTER COLUMN league_format_id SET NOT NULL;
ALTER TABLE public.seasons DROP COLUMN scoring_format_hash;
ALTER TABLE public.seasons DROP COLUMN league_format_hash;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_scoring_format_id_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;

-- scoring_format_player_careerlogs
ALTER TABLE public.scoring_format_player_careerlogs ALTER COLUMN scoring_format_id SET NOT NULL;
DROP INDEX public.idx_scoring_format_player_careerlogs_pid_hash;
ALTER TABLE public.scoring_format_player_careerlogs DROP COLUMN scoring_format_hash;
ALTER TABLE public.scoring_format_player_careerlogs
  ADD CONSTRAINT scoring_format_player_careerlogs_scoring_format_id_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_scoring_format_player_careerlogs_pid_id
  ON public.scoring_format_player_careerlogs USING btree (pid, scoring_format_id);

-- scoring_format_player_gamelogs
ALTER TABLE public.scoring_format_player_gamelogs ALTER COLUMN scoring_format_id SET NOT NULL;
DROP INDEX public.idx_scoring_format_player_gamelogs_pid_esbid_hash;
ALTER TABLE public.scoring_format_player_gamelogs DROP COLUMN scoring_format_hash;
ALTER TABLE public.scoring_format_player_gamelogs
  ADD CONSTRAINT scoring_format_player_gamelogs_scoring_format_id_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_scoring_format_player_gamelogs_pid_esbid_id
  ON public.scoring_format_player_gamelogs USING btree (pid, esbid, scoring_format_id);

-- scoring_format_player_projection_points
ALTER TABLE public.scoring_format_player_projection_points ALTER COLUMN scoring_format_id SET NOT NULL;
DROP INDEX public.idx_25009_player_league_points;
ALTER TABLE public.scoring_format_player_projection_points DROP COLUMN scoring_format_hash;
ALTER TABLE public.scoring_format_player_projection_points
  ADD CONSTRAINT scoring_format_player_projection_points_scoring_format_id_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_scoring_format_player_projection_points_pid_id_week_year
  ON public.scoring_format_player_projection_points USING btree (pid, scoring_format_id, week, year);

-- scoring_format_player_seasonlogs
ALTER TABLE public.scoring_format_player_seasonlogs ALTER COLUMN scoring_format_id SET NOT NULL;
DROP INDEX public.idx_scoring_format_player_seasonlogs_pid_year_hash;
ALTER TABLE public.scoring_format_player_seasonlogs DROP COLUMN scoring_format_hash;
ALTER TABLE public.scoring_format_player_seasonlogs
  ADD CONSTRAINT scoring_format_player_seasonlogs_scoring_format_id_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_scoring_format_player_seasonlogs_pid_year_id
  ON public.scoring_format_player_seasonlogs USING btree (pid, year, scoring_format_id);

-- league_format_draft_pick_value
ALTER TABLE public.league_format_draft_pick_value ALTER COLUMN league_format_id SET NOT NULL;
DROP INDEX public.idx_24632_pick;
ALTER TABLE public.league_format_draft_pick_value DROP COLUMN league_format_hash;
ALTER TABLE public.league_format_draft_pick_value
  ADD CONSTRAINT league_format_draft_pick_value_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_league_format_draft_pick_value_rank_id
  ON public.league_format_draft_pick_value USING btree (rank, league_format_id);

-- league_format_player_careerlogs
ALTER TABLE public.league_format_player_careerlogs ALTER COLUMN league_format_id SET NOT NULL;
DROP INDEX public.idx_24635_pid;
ALTER TABLE public.league_format_player_careerlogs DROP COLUMN league_format_hash;
ALTER TABLE public.league_format_player_careerlogs
  ADD CONSTRAINT league_format_player_careerlogs_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_league_format_player_careerlogs_pid_id
  ON public.league_format_player_careerlogs USING btree (pid, league_format_id);

-- league_format_player_gamelogs
ALTER TABLE public.league_format_player_gamelogs ALTER COLUMN league_format_id SET NOT NULL;
DROP INDEX public.idx_24638_pid;
ALTER TABLE public.league_format_player_gamelogs DROP COLUMN league_format_hash;
ALTER TABLE public.league_format_player_gamelogs
  ADD CONSTRAINT league_format_player_gamelogs_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_league_format_player_gamelogs_pid_esbid_id
  ON public.league_format_player_gamelogs USING btree (pid, esbid, league_format_id);

-- league_format_player_projection_values
ALTER TABLE public.league_format_player_projection_values ALTER COLUMN league_format_id SET NOT NULL;
DROP INDEX public.idx_24641_player_value;
ALTER TABLE public.league_format_player_projection_values DROP COLUMN league_format_hash;
ALTER TABLE public.league_format_player_projection_values
  ADD CONSTRAINT league_format_player_projection_values_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_league_format_player_projection_values_pid_id_week_year
  ON public.league_format_player_projection_values USING btree (pid, league_format_id, week, year);

-- league_format_player_seasonlogs
ALTER TABLE public.league_format_player_seasonlogs ALTER COLUMN league_format_id SET NOT NULL;
DROP INDEX public.idx_24644_pid;
ALTER TABLE public.league_format_player_seasonlogs DROP COLUMN league_format_hash;
ALTER TABLE public.league_format_player_seasonlogs
  ADD CONSTRAINT league_format_player_seasonlogs_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;
CREATE UNIQUE INDEX idx_league_format_player_seasonlogs_pid_year_id
  ON public.league_format_player_seasonlogs USING btree (pid, year, league_format_id);

-- roster_asset_holding (no hash-based index today; PK is on holding_id)
ALTER TABLE public.roster_asset_holding ALTER COLUMN league_format_id SET NOT NULL;
ALTER TABLE public.roster_asset_holding DROP COLUMN league_format_hash;
ALTER TABLE public.roster_asset_holding
  ADD CONSTRAINT roster_asset_holding_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;

-- ----- (e) Composite-PK tables: drop old col → SET NOT NULL → add new PK → add FK -----

-- player_variance
ALTER TABLE public.player_variance DROP COLUMN scoring_format_hash;
ALTER TABLE public.player_variance ALTER COLUMN scoring_format_id SET NOT NULL;
ALTER TABLE public.player_variance
  ADD CONSTRAINT player_variance_pkey PRIMARY KEY (pid, year, scoring_format_id);

-- league_team_player_seasonlogs
ALTER TABLE public.league_team_player_seasonlogs DROP COLUMN league_format_hash;
ALTER TABLE public.league_team_player_seasonlogs ALTER COLUMN league_format_id SET NOT NULL;
ALTER TABLE public.league_team_player_seasonlogs
  ADD CONSTRAINT league_team_player_seasonlogs_pkey PRIMARY KEY (lid, tid, pid, year, league_format_id);
ALTER TABLE public.league_team_player_seasonlogs
  ADD CONSTRAINT league_team_player_seasonlogs_league_format_id_fkey
  FOREIGN KEY (league_format_id) REFERENCES public.league_formats(id) ON UPDATE CASCADE;

-- =====================================================================
-- Step 9: Re-add player_variance FK against league_scoring_formats(id)
-- =====================================================================

ALTER TABLE public.player_variance
  ADD CONSTRAINT player_variance_scoring_format_fkey
  FOREIGN KEY (scoring_format_id) REFERENCES public.league_scoring_formats(id) ON UPDATE CASCADE;

-- =====================================================================
-- Step 10: Recreate cmv_classify_league_format function + trigger,
--          then backfill format_category for any rows landed during the
--          trigger-absent window.
-- =====================================================================

CREATE FUNCTION public.cmv_classify_league_format() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  rec_val numeric;
BEGIN
  SELECT rec INTO rec_val FROM league_scoring_formats WHERE id = NEW.scoring_format_id;
  NEW.format_category := cmv_derive_format_category(NEW.sqb, NEW.sqbrbwrte, rec_val);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cmv_classify_league_format
  BEFORE INSERT OR UPDATE OF sqb, sqbrbwrte, scoring_format_id
  ON public.league_formats
  FOR EACH ROW EXECUTE FUNCTION public.cmv_classify_league_format();

UPDATE public.league_formats lf
   SET format_category = public.cmv_derive_format_category(
         lf.sqb,
         lf.sqbrbwrte,
         (SELECT rec FROM public.league_scoring_formats WHERE id = lf.scoring_format_id))
 WHERE format_category IS NULL;

-- =====================================================================
-- Step 11: Add deferred unique constraint on league_formats (now that
--          scoring_format_id exists on this table).
-- =====================================================================

ALTER TABLE public.league_formats
  ADD CONSTRAINT league_formats_config_unique
  UNIQUE (num_teams, sqb, srb, swr, ste, srbwr, srbwrte, sqbrbwrte, swrte, sdst, sk,
          bench, ps, reserve_short_term_limit, cap, min_bid, scoring_format_id, pricing_model);

-- =====================================================================
-- Step 12: Drop old hash columns from the two target tables last.
-- =====================================================================

ALTER TABLE public.league_scoring_formats DROP COLUMN scoring_format_hash;
ALTER TABLE public.league_formats DROP COLUMN league_format_hash;

COMMIT;
