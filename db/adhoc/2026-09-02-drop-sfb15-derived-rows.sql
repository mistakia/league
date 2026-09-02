-- STATUS: APPLIED 2026-09-02 against league_production
--
-- Drop the derived rows of the two retired Scott Fish Bowl 15 formats, and
-- KEEP their definitions.
--
-- 9d71d0ba8 (2026-08-28) retired sfb15_mfl and sfb15_sleeper from the code
-- catalog -- "SFB15 is last season's contest and is no longer supported; SFB16
-- replaces it" -- but left every database row in place. Nothing has regenerated
-- them since, so what remains is a partial snapshot frozen at the moment
-- support ended: 187,546 gamelog rows per format against an expectation of
-- 248,967. Partial data that still answers queries is worse than absent data,
-- which is what this file removes.
--
-- WHAT IS DELIBERATELY KEPT, and it is the whole point of the scope:
--   league_scoring_formats  the scoring weights for both formats
--   league_formats          the roster/cap definitions for both formats
-- Keeping them leaves SFB15 regenerable from the database alone rather than
-- from git archaeology, at the cost of two catalog rows nothing generates.
-- The two unreferenced UUID duplicates (a6bbae3f-..., c057f2a9-...) are
-- likewise untouched -- they are definition rows and hold no data.
--
-- CONSEQUENCE FOR THE DATA CHECK, stated so the next reader does not misread a
-- red run as this file failing: scoring-format-gamelog-completeness takes its
-- format axis from league_scoring_formats (the CATALOG, deliberately, so a
-- never-generated format cannot pass in silence -- see
-- libs-server/scoring-format-gamelog-completeness.mjs). Because the catalog
-- rows survive, both formats stay graded in all 25 seasons and their rate goes
-- from roughly 0.75 to 0.0. The finding count therefore stays at 100 and signal
-- 127316 keeps re-firing. That is expected and is the accepted cost of keeping
-- the definitions; closing the check needs the catalog rows dropped, which is a
-- separate decision tracked at
-- user:task/league/reconcile-retired-sfb15-scoring-formats.md.
--
-- Measured 2026-09-02, and asserted again below so a drift between measuring
-- and applying aborts rather than deletes something unexamined: no season, no
-- roster holding and no league team seasonlog references either format, so
-- nothing user-facing is attached to any of these rows.
--
-- Expected deletions: 818,379 rows.
--   league_format_player_projection_values_history   296,424
--   league_format_player_projection_values            40,608
--   scoring_format_player_projection_points           64,799
--   scoring_format_player_gamelogs                   375,092
--   scoring_format_player_seasonlogs                  33,990
--   scoring_format_player_careerlogs                   7,466

\set ON_ERROR_STOP on

-- Preconditions. Any of these firing means the format is in use after all and
-- the delete must not proceed; the transaction aborts and nothing is removed.
DO $$
DECLARE
  offending integer;
BEGIN
  SELECT count(*) INTO offending FROM seasons
   WHERE scoring_format_id IN ('sfb15_mfl', 'sfb15_sleeper')
      OR league_format_id  IN ('sfb15_mfl', 'sfb15_sleeper');
  IF offending > 0 THEN
    RAISE EXCEPTION 'REFUSING: % seasons row(s) reference an sfb15 format', offending;
  END IF;

  SELECT count(*) INTO offending FROM roster_asset_holding
   WHERE league_format_id IN ('sfb15_mfl', 'sfb15_sleeper');
  IF offending > 0 THEN
    RAISE EXCEPTION 'REFUSING: % roster_asset_holding row(s) reference an sfb15 format', offending;
  END IF;

  SELECT count(*) INTO offending FROM league_team_player_seasonlogs
   WHERE league_format_id IN ('sfb15_mfl', 'sfb15_sleeper');
  IF offending > 0 THEN
    RAISE EXCEPTION 'REFUSING: % league_team_player_seasonlogs row(s) reference an sfb15 format', offending;
  END IF;
END $$;

-- Derived rows at league_format grain.
DELETE FROM league_format_player_projection_values_history
 WHERE league_format_id IN ('sfb15_mfl', 'sfb15_sleeper');

DELETE FROM league_format_player_projection_values
 WHERE league_format_id IN ('sfb15_mfl', 'sfb15_sleeper');

-- Derived rows at scoring_format grain.
DELETE FROM scoring_format_player_projection_points
 WHERE scoring_format_id IN ('sfb15_mfl', 'sfb15_sleeper');

DELETE FROM scoring_format_player_gamelogs
 WHERE scoring_format_id IN ('sfb15_mfl', 'sfb15_sleeper');

DELETE FROM scoring_format_player_seasonlogs
 WHERE scoring_format_id IN ('sfb15_mfl', 'sfb15_sleeper');

DELETE FROM scoring_format_player_careerlogs
 WHERE scoring_format_id IN ('sfb15_mfl', 'sfb15_sleeper');

-- Postcondition: the derived tiers are empty and BOTH definition rows survive.
-- The second half is as load-bearing as the first -- a cascade or a stray
-- catalog delete is exactly the failure this scope exists to avoid.
DO $$
DECLARE
  remaining integer;
  definitions integer;
BEGIN
  SELECT (SELECT count(*) FROM scoring_format_player_gamelogs
           WHERE scoring_format_id IN ('sfb15_mfl','sfb15_sleeper'))
       + (SELECT count(*) FROM scoring_format_player_seasonlogs
           WHERE scoring_format_id IN ('sfb15_mfl','sfb15_sleeper'))
       + (SELECT count(*) FROM scoring_format_player_careerlogs
           WHERE scoring_format_id IN ('sfb15_mfl','sfb15_sleeper'))
       + (SELECT count(*) FROM scoring_format_player_projection_points
           WHERE scoring_format_id IN ('sfb15_mfl','sfb15_sleeper'))
       + (SELECT count(*) FROM league_format_player_projection_values
           WHERE league_format_id IN ('sfb15_mfl','sfb15_sleeper'))
       + (SELECT count(*) FROM league_format_player_projection_values_history
           WHERE league_format_id IN ('sfb15_mfl','sfb15_sleeper'))
    INTO remaining;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'derived rows survived the delete: %', remaining;
  END IF;

  SELECT (SELECT count(*) FROM league_scoring_formats
           WHERE id IN ('sfb15_mfl','sfb15_sleeper'))
       + (SELECT count(*) FROM league_formats
           WHERE id IN ('sfb15_mfl','sfb15_sleeper'))
    INTO definitions;
  IF definitions <> 4 THEN
    RAISE EXCEPTION 'expected 4 surviving definition rows, found %', definitions;
  END IF;

  RAISE NOTICE 'sfb15 derived rows cleared; 4 definition rows intact';
END $$;
