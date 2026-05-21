-- Composite market-value index: daily-grain (format_category, asset, date)
-- fusing KTC, ADP, expert rankings, and betting markets into a unified
-- KTC-unit value across six format categories.
--
-- Natural key shorthand (format_category, asset_type, asset_id, date) is
-- abstract; actual columns are player_id (asset_type=1) OR pick triple
-- (asset_type=2). Enforced via partial unique indexes per asset_type so the
-- NULL-permissive UNIQUE trap from roster_asset_holding (Plan A) does not
-- recur.
--
-- format_category enum:
--   1=single_qb_standard   2=single_qb_half_ppr   3=single_qb_full_ppr
--   4=superflex_standard   5=superflex_half_ppr   6=superflex_full_ppr
--
-- Source enum (for composite_market_value_calibration):
--   1=ktc 2=adp 3=rankings 4=props 5=draft_pick_model
--
-- Runs in a single transaction via yarn db:exec (ON_ERROR_STOP=1).

-- ============================================================================
-- composite_market_value_daily
-- ============================================================================

CREATE TABLE composite_market_value_daily (
  cmv_row_id bigserial PRIMARY KEY,
  format_category smallint NOT NULL,
  asset_type smallint NOT NULL,
  player_id varchar(25),
  pick_year smallint,
  pick_round smallint,
  pick_original_owner_tid integer,
  date date NOT NULL,
  ktc_value numeric(8,1),
  adp_value numeric(8,1),
  rankings_value numeric(8,1),
  props_value numeric(8,1),
  draft_pick_model_value numeric(8,1),
  composite_value numeric(8,1) NOT NULL,
  composite_coverage_score numeric(3,2) NOT NULL,
  blend_weights_version_id integer NOT NULL,
  CONSTRAINT cmv_asset_keys_chk CHECK (
    (asset_type = 1 AND player_id IS NOT NULL AND pick_year IS NULL AND pick_round IS NULL AND pick_original_owner_tid IS NULL)
    OR
    (asset_type = 2 AND player_id IS NULL AND pick_year IS NOT NULL AND pick_round IS NOT NULL AND pick_original_owner_tid IS NOT NULL)
  )
);

CREATE UNIQUE INDEX cmv_player_unique_idx
  ON composite_market_value_daily (format_category, player_id, date)
  WHERE asset_type = 1;

CREATE UNIQUE INDEX cmv_pick_unique_idx
  ON composite_market_value_daily (format_category, pick_year, pick_round, pick_original_owner_tid, date)
  WHERE asset_type = 2;

CREATE INDEX cmv_date_category_type_idx
  ON composite_market_value_daily (date, format_category, asset_type);

CREATE INDEX cmv_player_date_idx
  ON composite_market_value_daily (player_id, date)
  WHERE asset_type = 1;

CREATE INDEX cmv_pick_date_idx
  ON composite_market_value_daily (pick_year, pick_round, pick_original_owner_tid, date)
  WHERE asset_type = 2;

COMMENT ON TABLE composite_market_value_daily IS
  'Daily-grain composite market-value index. One row per (format_category, asset, date). Per-source columns (ktc/adp/rankings/props/draft_pick_model) are KTC-calibrated; composite_value is the weighted average over present sources. composite_coverage_score is the share of intended-source weight that was present in-window for this row.';

COMMENT ON COLUMN composite_market_value_daily.format_category IS
  'Enum: 1=single_qb_standard, 2=single_qb_half_ppr, 3=single_qb_full_ppr, 4=superflex_standard, 5=superflex_half_ppr, 6=superflex_full_ppr.';

COMMENT ON COLUMN composite_market_value_daily.asset_type IS
  'Enum: 1=player, 2=pick. Natural key columns enforced via CHECK + partial unique indexes.';

-- ============================================================================
-- format_category_signal_mapping
-- ============================================================================

CREATE TABLE format_category_signal_mapping (
  format_category smallint PRIMARY KEY,
  ktc_qb_axis smallint NOT NULL,
  adp_type text NOT NULL,
  ranking_type text NOT NULL,
  props_scoring_formula_template text
);

COMMENT ON TABLE format_category_signal_mapping IS
  'Static 6-row mapping from format_category to per-source axis: ktc qb=1|2, Sleeper adp_type, FantasyPros ranking_type, props scoring template. Runtime joins look this up to select the right source rows per format category.';

INSERT INTO format_category_signal_mapping (format_category, ktc_qb_axis, adp_type, ranking_type, props_scoring_formula_template) VALUES
  (1, 1, 'STANDARD_DYNASTY',          'STANDARD_DYNASTY',          'standard'),
  (2, 1, 'HALF_PPR_DYNASTY',          'HALF_PPR_DYNASTY',          'half_ppr'),
  (3, 1, 'PPR_DYNASTY',               'PPR_DYNASTY',               'ppr'),
  (4, 2, 'STANDARD_SUPERFLEX_DYNASTY','STANDARD_SUPERFLEX_DYNASTY','standard'),
  (5, 2, 'HALF_PPR_SUPERFLEX_DYNASTY','HALF_PPR_SUPERFLEX_DYNASTY','half_ppr'),
  (6, 2, 'PPR_SUPERFLEX_DYNASTY',     'PPR_SUPERFLEX_DYNASTY',     'ppr');

-- ============================================================================
-- composite_market_value_blend_weights
-- ============================================================================

CREATE TABLE composite_market_value_blend_weights (
  version_id serial PRIMARY KEY,
  format_category smallint,
  effective_from date NOT NULL,
  ktc_weight numeric(4,3) NOT NULL,
  adp_weight numeric(4,3) NOT NULL,
  rankings_weight numeric(4,3) NOT NULL,
  props_weight numeric(4,3) NOT NULL,
  draft_pick_model_weight numeric(4,3) NOT NULL,
  notes text,
  CONSTRAINT cmv_weights_sum_one CHECK (
    ABS(ktc_weight + adp_weight + rankings_weight + props_weight + draft_pick_model_weight - 1.000) < 0.005
  )
);

CREATE UNIQUE INDEX cmv_blend_weights_category_effective_idx
  ON composite_market_value_blend_weights (COALESCE(format_category, -1), effective_from);

COMMENT ON TABLE composite_market_value_blend_weights IS
  'Versioned blend weights per (format_category, effective_from). format_category=NULL means default weights (used when no format-specific override exists for a given format category on the blend date). Weights sum to 1.000.';

INSERT INTO composite_market_value_blend_weights (format_category, effective_from, ktc_weight, adp_weight, rankings_weight, props_weight, draft_pick_model_weight, notes) VALUES
  (NULL, '2020-01-01', 0.450, 0.225, 0.175, 0.100, 0.050, 'v1 default: KTC-anchored with props deprioritized due to sparse single-book coverage; draft_pick_model only meaningful for picks');

-- ============================================================================
-- composite_market_value_calibration
-- ============================================================================

CREATE TABLE composite_market_value_calibration (
  source smallint NOT NULL,
  format_category smallint NOT NULL,
  date date NOT NULL,
  scale_factor numeric(8,4) NOT NULL,
  intercept numeric(10,3) NOT NULL,
  overlap_sample_size smallint NOT NULL,
  r_squared numeric(4,3),
  fallback_reason text,
  PRIMARY KEY (source, format_category, date)
);

COMMENT ON TABLE composite_market_value_calibration IS
  'Per-(source, format_category, date) linear calibration of native-unit source values onto the KTC axis. Persisted for reproducibility. fallback_reason is set when overlap_sample_size<30 (calibration_undersized) or r_squared<0.5 (calibration_low_r_squared); in those cases scale_factor=1, intercept=0.';

COMMENT ON COLUMN composite_market_value_calibration.source IS
  'Enum: 1=ktc, 2=adp, 3=rankings, 4=props, 5=draft_pick_model.';

-- ============================================================================
-- league_formats.format_category
-- ============================================================================

ALTER TABLE league_formats ADD COLUMN format_category smallint;

COMMENT ON COLUMN league_formats.format_category IS
  'Denormalized resolution of (superflex × scoring axis) into the 6-bucket format_category enum. Populated by the cmv_classify_league_format trigger on insert/update; one-time backfill ran with the DDL.';

CREATE OR REPLACE FUNCTION cmv_derive_format_category(
  sqb smallint, sqbrbwrte smallint, rec numeric
) RETURNS smallint AS $$
DECLARE
  superflex boolean := (sqb > 1 OR sqbrbwrte > 0);
  scoring_axis smallint;
BEGIN
  IF rec IS NULL OR rec < 0.25 THEN
    scoring_axis := 0;
  ELSIF rec < 0.75 THEN
    scoring_axis := 1;
  ELSE
    scoring_axis := 2;
  END IF;
  IF superflex THEN
    RETURN 4 + scoring_axis;
  ELSE
    RETURN 1 + scoring_axis;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION cmv_classify_league_format() RETURNS trigger AS $$
DECLARE
  rec_val numeric;
BEGIN
  SELECT rec INTO rec_val FROM league_scoring_formats WHERE scoring_format_hash = NEW.scoring_format_hash;
  NEW.format_category := cmv_derive_format_category(NEW.sqb, NEW.sqbrbwrte, rec_val);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cmv_classify_league_format
  BEFORE INSERT OR UPDATE OF sqb, sqbrbwrte, scoring_format_hash ON league_formats
  FOR EACH ROW EXECUTE FUNCTION cmv_classify_league_format();

UPDATE league_formats lf
   SET format_category = cmv_derive_format_category(lf.sqb, lf.sqbrbwrte, sf.rec)
  FROM league_scoring_formats sf
 WHERE lf.scoring_format_hash = sf.scoring_format_hash;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON TABLE composite_market_value_daily TO league_readonly;
GRANT SELECT ON TABLE format_category_signal_mapping TO league_readonly;
GRANT SELECT ON TABLE composite_market_value_blend_weights TO league_readonly;
GRANT SELECT ON TABLE composite_market_value_calibration TO league_readonly;
