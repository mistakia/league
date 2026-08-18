-- STATUS: PENDING
-- Separate the auction economy from league format identity.
--
-- `league_formats` answers two questions with one row: what game is played, and
-- which analysis board applies. The cap sitting inside the identity tuple is
-- what fuses them -- two leagues differing only in a $1 minimum bid get two
-- format ids and two boards holding IDENTICAL points and different dollars.
--
-- Three columns, three different answers:
--
--   pricing_model  -- who determines dollar value, us or an external source.
--                     Stays in the identity: a DFS contest really is a
--                     different format, and stating it costs an external
--                     league nothing, since 'auction' is the default and
--                     asserts no number.
--   salary_cap / min_bid AS THE UNIT the format's published analysis is priced
--                     in -- stays on the table, LEAVES the identity, renamed
--                     valuation_*. It stays because a dollar-denominated
--                     analysis surface needs a unit and has no league to get
--                     one from: an anonymous data view renders earned_salary
--                     against DEFAULT_LEAGUE_FORMAT_ID with no user, no league
--                     and no season. Refusing to store the unit would not
--                     remove it, only make it implicit.
--   salary_cap / min_bid AS WHAT THIS LEAGUE RUNS THIS SEASON -- new columns on
--                     `seasons`, beside the settings of exactly that grain
--                     already there (starting_free_agent_acquisition_budget,
--                     the franchise tag salaries, season_due_amount).
--
-- The point of the change is the unique INDEX, not the columns' location. A row
-- may carry a valuation unit without that unit being part of the lookup key,
-- which is what lets an external-platform league resolve an honest
-- league_format_id from roster construction and scoring alone.
--
-- WHY THE ANALYSIS ROWS ARE DELETED RATHER THAN REMAPPED. Once the two columns
-- leave the tuple, 9 format rows become duplicates of 8 survivors. Their
-- analysis rows cannot be remapped: measured 2026-08-17, all 16,907 of
-- 776e3d91's league_format_player_seasonlogs share a (pid, season_year) with a
-- row the survivor f663e70c already holds, so a remap collides on every row.
-- The survivor's board is kept and the retired board is dropped. Nothing is
-- lost that the surviving row does not already state in its own unit, and the
-- pipeline regenerates under the survivor id on its next run.
--
-- ACCEPTED CONSEQUENCE, stated on the task: 25 league-seasons currently on
-- 776e3d91 (min_bid 1) will read their board dollars restated at the survivor's
-- min_bid 0 -- roughly a 10 percent shift in earned_salary and market_salary.
-- Their own live economy is unaffected; it lands on `seasons` intact below.
--
-- Survivor rule, applied in order: prefer the row carrying analysis data (so
-- the large tables need no remap); else the row a `seasons` row references;
-- else the table-wide modal economy (200, 0, auction); else the lowest id. All
-- 8 groups resolve under it with no manual exception. The map below is
-- hardcoded for auditability and then ASSERTED against the rule's own
-- end-state condition, so a data change since measurement fails the apply
-- rather than silently mis-applying.
--
-- The seasons ALTER is trivial (122 rows). The gamelogs delete is not -- it
-- clears roughly 184,000 rows -- so the timeouts below are raised for the file.
-- 30s to ACQUIRE and unbounded to execute is the asymmetry we want: once queued
-- for a lock the statement blocks every new reader behind it, so an unbounded
-- wait to acquire is strictly worse than failing.

SET lock_timeout = '30s';
SET statement_timeout = 0;

-- ---------------------------------------------------------------------------
-- 1. The league-season economy.
-- ---------------------------------------------------------------------------

ALTER TABLE public.seasons
  ADD COLUMN salary_cap integer,
  ADD COLUMN min_bid smallint;

UPDATE public.seasons s
   SET salary_cap = lf.salary_cap,
       min_bid = lf.min_bid
  FROM public.league_formats lf
 WHERE lf.id = s.league_format_id;

DO $$
DECLARE unfilled integer;
BEGIN
  SELECT count(*) INTO unfilled
    FROM public.seasons
   WHERE salary_cap IS NULL OR min_bid IS NULL;
  IF unfilled > 0 THEN
    RAISE EXCEPTION
      'seasons economy backfill left % row(s) unfilled', unfilled;
  END IF;
END $$;

ALTER TABLE public.seasons
  ALTER COLUMN salary_cap SET NOT NULL,
  ALTER COLUMN min_bid SET NOT NULL,
  ALTER COLUMN min_bid SET DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Collapse the duplicate identities.
-- ---------------------------------------------------------------------------

CREATE TEMPORARY TABLE format_collapse (retired_id text, surviving_id text);

INSERT INTO format_collapse (retired_id, surviving_id) VALUES
  ('4020b227-7fd9-4776-8f75-c2cd4110654c', '756a06c3-6918-4e41-9a48-52fea20997d0'),
  ('58ccfe48-84db-40a9-8675-b03a389b7d09', '05e25555-7a71-45a8-b57f-e0b8cfe47577'),
  ('b7465ff0-337d-4789-b527-8c58c3d92dd9', 'f7a5fb2b-cbc5-4009-a512-8ba7706832a3'),
  ('92fdbfef-f833-4d09-9ccf-ca9ae96451b9', '6c8b1fad-abca-432e-a028-0584b8500ec0'),
  ('4babe994-115b-46b8-8f5b-3ab0f70fb4a3', '7b626be5-e4e9-4798-9a05-eb02bc742232'),
  ('307f816d-cc2b-4de8-b1ef-7e9fbb4d6206', '314912c0-f766-4c50-abd5-ce84b312f42f'),
  ('776e3d91-122c-4204-b15e-3f48ddf346f8', 'f663e70c-8232-4881-8af6-8ca38379c068'),
  ('1bd7220f-9870-41fd-b57e-21155e448f6d', 'f663e70c-8232-4881-8af6-8ca38379c068'),
  ('dafbaf72-7538-4ccc-9de3-9820b5493339', '74ccd80c-5184-45fc-8803-d9bf3f56a61c');

-- Every id in the map must exist, and each pair must genuinely share the
-- surviving identity tuple. A pair that does not is a measurement that has gone
-- stale, and collapsing it would merge two different formats.
DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad
    FROM format_collapse c
    LEFT JOIN public.league_formats r ON r.id = c.retired_id
    LEFT JOIN public.league_formats s ON s.id = c.surviving_id
   WHERE r.id IS NULL OR s.id IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'format_collapse names % id(s) that do not exist', bad;
  END IF;

  SELECT count(*) INTO bad
    FROM format_collapse c
    JOIN public.league_formats r ON r.id = c.retired_id
    JOIN public.league_formats s ON s.id = c.surviving_id
   WHERE (r.number_teams, r.starter_slots_quarterback, r.starter_slots_running_back,
          r.starter_slots_wide_receiver, r.starter_slots_tight_end,
          r.starter_slots_running_back_wide_receiver_flex,
          r.starter_slots_running_back_wide_receiver_tight_end_flex,
          r.starter_slots_superflex, r.starter_slots_wide_receiver_tight_end_flex,
          r.starter_slots_defense_special_teams, r.starter_slots_kicker,
          r.bench_slot_count, r.practice_squad_slot_count,
          r.reserve_short_term_limit, r.scoring_format_id, r.pricing_model)
      IS DISTINCT FROM
         (s.number_teams, s.starter_slots_quarterback, s.starter_slots_running_back,
          s.starter_slots_wide_receiver, s.starter_slots_tight_end,
          s.starter_slots_running_back_wide_receiver_flex,
          s.starter_slots_running_back_wide_receiver_tight_end_flex,
          s.starter_slots_superflex, s.starter_slots_wide_receiver_tight_end_flex,
          s.starter_slots_defense_special_teams, s.starter_slots_kicker,
          s.bench_slot_count, s.practice_squad_slot_count,
          s.reserve_short_term_limit, s.scoring_format_id, s.pricing_model);
  IF bad > 0 THEN
    RAISE EXCEPTION
      'format_collapse pairs % row(s) that do not share an identity tuple', bad;
  END IF;
END $$;

-- The league-season economy is already captured above, so a season row can move
-- to the surviving format without losing what its own format said.
UPDATE public.seasons s
   SET league_format_id = c.surviving_id
  FROM format_collapse c
 WHERE s.league_format_id = c.retired_id;

-- Superseded boards. Each survivor already holds a row at the same grain.
DELETE FROM public.league_format_player_projection_values
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.league_format_player_projection_values_history
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.league_format_player_seasonlogs
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.league_format_player_careerlogs
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.league_format_player_gamelogs
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.league_team_player_seasonlogs
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.roster_asset_holding
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

DELETE FROM public.league_format_draft_pick_value
 WHERE league_format_id IN (SELECT retired_id FROM format_collapse);

-- Nothing may still point at a retired id. This enumerates all nine tables
-- carrying league_format_id as of 2026-08-17; a tenth added since would be
-- missed here, so it is checked against the catalog rather than trusted.
DO $$
DECLARE
  referencing_tables integer;
  still_referenced integer;
BEGIN
  SELECT count(*) INTO referencing_tables
    FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'league_format_id';
  IF referencing_tables <> 9 THEN
    RAISE EXCEPTION
      'expected 9 tables carrying league_format_id, found % -- this file enumerates them by hand',
      referencing_tables;
  END IF;

  SELECT
      (SELECT count(*) FROM public.seasons WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_format_player_projection_values WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_format_player_projection_values_history WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_format_player_seasonlogs WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_format_player_careerlogs WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_format_player_gamelogs WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_team_player_seasonlogs WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.roster_asset_holding WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    + (SELECT count(*) FROM public.league_format_draft_pick_value WHERE league_format_id IN (SELECT retired_id FROM format_collapse))
    INTO still_referenced;
  IF still_referenced > 0 THEN
    RAISE EXCEPTION
      '% row(s) still reference a retired league_format_id', still_referenced;
  END IF;
END $$;

DELETE FROM public.league_formats
 WHERE id IN (SELECT retired_id FROM format_collapse);

-- ---------------------------------------------------------------------------
-- 3. Rename the valuation pair and rebuild the identity index.
-- ---------------------------------------------------------------------------

ALTER TABLE public.league_formats
  RENAME COLUMN salary_cap TO valuation_salary_cap;

ALTER TABLE public.league_formats
  RENAME COLUMN min_bid TO valuation_min_bid;

ALTER TABLE public.league_formats
  DROP CONSTRAINT league_formats_config_unique;

ALTER TABLE public.league_formats
  ADD CONSTRAINT league_formats_config_unique UNIQUE (
    number_teams,
    starter_slots_quarterback,
    starter_slots_running_back,
    starter_slots_wide_receiver,
    starter_slots_tight_end,
    starter_slots_running_back_wide_receiver_flex,
    starter_slots_running_back_wide_receiver_tight_end_flex,
    starter_slots_superflex,
    starter_slots_wide_receiver_tight_end_flex,
    starter_slots_defense_special_teams,
    starter_slots_kicker,
    bench_slot_count,
    practice_squad_slot_count,
    reserve_short_term_limit,
    scoring_format_id,
    pricing_model
  );

-- The index above is the end-state assertion: if any duplicate identity
-- survived the collapse it cannot be built, and the whole file rolls back.
