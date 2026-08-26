-- STATUS: APPLIED 2026-08-26 against league_production
--
-- Close the destructive half of the league_player_projection_values period
-- split: drop the last sentinel rows and narrow week to a real fantasy week.
--
-- The additive half shipped in 0b7a866e0 / e055e1fcc / b1672adf2. It created
-- league_player_season_projection_values and
-- league_player_rest_of_season_projection_values, migrated the week='0' and
-- week='ros' rows into them, and repointed both the writer and get-players.mjs.
-- What it deliberately did NOT do is narrow the week column, because the
-- migration and the retype could not share a transaction with the code deploy.
--
-- Since that deploy the writer has excluded every period key by name
-- (scripts/process-projections.mjs:540-546 skips '0', 'ros', 'ros_net' and the
-- season net key before building valueInserts), so this table has taken no
-- sentinel write in three weeks. The 704 rows this file deletes are what the
-- migration left behind, not live data:
--
--   lid=0, season_year=2023, week='ros', 704 rows
--
-- All 704 are unreachable by every consumer:
--
--   lid=0 is the no-league prewarm pseudo-league.
--   2023 has no season row, and get-players.mjs:409-413 filters the read to
--   { lid: leagueId, season_year: current_season.year }, so a 2023 row cannot
--   be selected at any league.
--   make_league_player_projection_source pins week to String(week) from
--   get_default_params, which is always numeric, so the data-view path cannot
--   reach 'ros' either.
--   The writer deletes by lid alone (.del().where({ lid })), so these rows
--   survive only because lid=0 has not been processed since the 2023 run.
--
-- The corresponding 'ros' values for every live league already live in
-- league_player_rest_of_season_projection_values, which is what feeds the
-- payload's 'ros' key today. Nothing is lost.
--
-- With the sentinels gone the column can say what it means. week becomes
-- smallint NOT NULL with a 1..18 CHECK, so a future writer cannot reintroduce
-- a period sentinel here by accident -- neither the string 'ros' (rejected by
-- the type) nor a bare 0 standing in for the season snapshot (rejected by the
-- constraint). This is the narrower half of the standing rule that week=0
-- means the fantasy offseason and never a season aggregate.
--
-- The table is ~33,000 rows and 6 MB, so the rewrite needs no
-- statement_timeout override.
--
-- The unique index idx_24665_player_value (pid, lid, week, season_year) and
-- idx_league_player_projection_values_pid are both rebuilt by Postgres as part
-- of the retype; neither needs restating here.
--
-- No companion code change ships with this file. The writer already emits only
-- numeric weeks and the readers already index the payload map by string key,
-- which is unaffected by the column changing from varchar to smallint --
-- JavaScript object keys are strings either way.

DELETE FROM public.league_player_projection_values
WHERE week = 'ros';

-- Refuse to retype if anything non-numeric survived the delete. The USING cast
-- below would fail too, but on an opaque 22P02 that names no row.
DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.league_player_projection_values
  WHERE week !~ '^[0-9]+$';

  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow league_player_projection_values.week: % rows carry a non-numeric week (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

-- Same check for the values that are numeric but outside a real fantasy week,
-- which the CHECK constraint below would otherwise reject with no row context.
DO $$
DECLARE
  offending_count bigint;
  offending_sample text;
BEGIN
  SELECT count(*), string_agg(DISTINCT week, ', ')
  INTO offending_count, offending_sample
  FROM public.league_player_projection_values
  WHERE week::int NOT BETWEEN 1 AND 18;

  IF offending_count > 0 THEN
    RAISE EXCEPTION
      'refusing to narrow league_player_projection_values.week: % rows carry a week outside 1..18 (%)',
      offending_count, offending_sample;
  END IF;
END
$$;

ALTER TABLE public.league_player_projection_values
  ALTER COLUMN week TYPE smallint USING week::smallint,
  ALTER COLUMN week SET NOT NULL;

ALTER TABLE public.league_player_projection_values
  ADD CONSTRAINT league_player_projection_values_week_is_fantasy_week
  CHECK (week BETWEEN 1 AND 18);
