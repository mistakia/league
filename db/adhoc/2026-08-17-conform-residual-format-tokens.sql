-- STATUS: APPLIED 2026-08-17 against league_production
--
-- Conform the residual format-abbreviation tokens: adp, faab, std, dev.
-- Batch 8 of user:task/league/conform-league-schema-abbreviation-tokens.md.
--
-- All four are ruled EXPAND, and the ruling is confirmed from the ruler rather
-- than from prose: `is_vocabulary_token` rejects each because each abbreviates
-- an ordinary English phrase, which is the stated boundary for the ratified
-- lists (a vendor brand or a published metric name is what passes it).
--
-- 11 columns across 8 tables. Audit 167 -> 156.
--
-- Three targets the token alone does not determine:
--
--   keeptradecut_liquidity.std_liquidity is STANDARDIZED, not standard
--   deviation. It sits beside `raw_liquidity` and both are read from the
--   KeepTradeCut payload as `rawLiquidity` / `stdLiquidity`
--   (libs-server/keeptradecut-liquidity.mjs), so the pair is raw-versus-
--   normalized. The vendor-side RHS keys are NOT renamed.
--
--   player_adp_{history,index}.std_dev IS standard deviation -- it sits beside
--   average_draft_position / min_pick / max_pick / sample_size, which is a
--   dispersion family. Note no importer populates it today
--   (player-adp-column-definitions.mjs records the coverage), so this is a
--   name move over an empty column and not a data change.
--
--   FAAB expands to "free agent acquisition budget", which already contains
--   the word `budget`. So seasons.starting_faab_budget becomes
--   starting_free_agent_acquisition_budget rather than
--   starting_free_agent_acquisition_budget_budget.
--
-- The `adp_format` TABLE keeps its name. Table names are checked for camelCase
-- only and never for shorthand, which is a recorded oracle gap owned by
-- close-interior-token-shorthand-audit-gap; the campaign's standing precedent
-- is to conform the COLUMN and leave the table (cf. ros_projections.sourceid,
-- which the keys batch renames on a table that keeps its shorthand name).
-- Index and constraint NAMES carrying an old column name are likewise left
-- alone, matching every prior batch in this campaign
-- (adp_format_num_qb_check still names num_qb over number_quarterback).
--
-- No PL/pgSQL function body names any of these columns (checked against the
-- schema dump's plpgsql bodies), and percentiles.field holds none of them as
-- data, so nothing outside the ALTERs needs to move.
--
-- These are all small tables, so no statement_timeout override is needed --
-- but a RENAME is a catalog-only operation regardless of row count, and the
-- lock_timeout is what keeps a queued ACCESS EXCLUSIVE from stalling readers.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- adp -> average_draft_position
ALTER TABLE public.composite_market_value_blend_weights
  RENAME COLUMN adp_weight TO average_draft_position_weight;

ALTER TABLE public.composite_market_value_daily
  RENAME COLUMN adp_value TO average_draft_position_value;

ALTER TABLE public.format_category_signal_mapping
  RENAME COLUMN adp_format_id TO average_draft_position_format_id;

ALTER TABLE public.player_adp_history
  RENAME COLUMN adp_format_id TO average_draft_position_format_id;

ALTER TABLE public.player_adp_index
  RENAME COLUMN adp_format_id TO average_draft_position_format_id;

-- faab -> free_agent_acquisition_budget
ALTER TABLE public.external_league_trade_legs
  RENAME COLUMN faab_amount TO free_agent_acquisition_budget_amount;

ALTER TABLE public.seasons
  RENAME COLUMN starting_faab_budget TO starting_free_agent_acquisition_budget;

ALTER TABLE public.teams
  RENAME COLUMN faab_balance TO free_agent_acquisition_budget_balance;

-- std -> standardized (KeepTradeCut's normalized liquidity)
ALTER TABLE public.keeptradecut_liquidity
  RENAME COLUMN std_liquidity TO standardized_liquidity;

-- std_dev -> standard_deviation (ADP dispersion)
ALTER TABLE public.player_adp_history
  RENAME COLUMN std_dev TO standard_deviation;

ALTER TABLE public.player_adp_index
  RENAME COLUMN std_dev TO standard_deviation;
