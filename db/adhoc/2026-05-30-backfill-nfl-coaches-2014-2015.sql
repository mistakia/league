-- One-shot backfill of unresolved play-caller cells for 2014-2015.
--
-- After the 2026-05-30 samhoppen backfill, scripts/import-nfl-coaches.mjs
-- left 48 nfl_game_coaches cells NULL across these two seasons. All 48
-- collapse to two (coach, team, season, role) triples that the resolver
-- could not match against yearly_coaching_history.csv:
--
--   1. Greg Olson  -- JAX 2014 OC, 16 games. samhoppen history
--      mis-attributes him to "Las Vegas Raiders" in 2014, so the
--      (name, team_abbrev, season) key missed. PFR id OlsoGr0 is
--      already in nfl_coaches from his other team-year rows.
--
--   2. Bill Davis  -- PHI 2014 + 2015 DC, 32 games. samhoppen
--      all_playcallers.csv spells him "Billy Davis" but PFR (and
--      samhoppen yearly_coaching_history when present elsewhere)
--      uses "Bill Davis". Name-string alias. PFR id DaviBi0 is
--      already in nfl_coaches.
--
-- Both root causes are upstream/resolver weaknesses to address in a
-- later importer pass; this adhoc just clears the existing NULLs.
--
-- Head-coach attribution for 2014-2015 is unaffected (already 100%).
-- Re-runs the nfl_games denormalization for JAX 2014 games only --
-- the PHI fixes touch def_play_caller, which is not denormalized to
-- nfl_games.{home,away}_play_caller.

BEGIN;

-- Sanity: both target coach rows exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM nfl_coaches WHERE pfr_coach_id = 'OlsoGr0') THEN
    RAISE EXCEPTION 'OlsoGr0 missing from nfl_coaches';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nfl_coaches WHERE pfr_coach_id = 'DaviBi0') THEN
    RAISE EXCEPTION 'DaviBi0 missing from nfl_coaches';
  END IF;
END $$;

-- JAX 2014 OC -> Greg Olson
UPDATE nfl_game_coaches gc
   SET off_play_caller_pfr_id = 'OlsoGr0'
  FROM nfl_games g
 WHERE g.nflverse_game_id = gc.nflverse_game_id
   AND gc.team = 'JAX'
   AND g.year = 2014
   AND gc.off_play_caller_pfr_id IS NULL;

-- PHI 2014 + 2015 DC -> Bill Davis
UPDATE nfl_game_coaches gc
   SET def_play_caller_pfr_id = 'DaviBi0'
  FROM nfl_games g
 WHERE g.nflverse_game_id = gc.nflverse_game_id
   AND gc.team = 'PHI'
   AND g.year BETWEEN 2014 AND 2015
   AND gc.def_play_caller_pfr_id IS NULL;

-- Re-denormalize home_play_caller / away_play_caller for the JAX 2014
-- games. Mirrors scripts/import-nfl-coaches.mjs process_week() logic.
UPDATE nfl_games AS g
   SET home_play_caller = c.full_name
  FROM nfl_game_coaches gc
  JOIN nfl_coaches c ON c.pfr_coach_id = gc.off_play_caller_pfr_id
 WHERE gc.nflverse_game_id = g.nflverse_game_id
   AND gc.team = g.h
   AND g.year = 2014
   AND gc.team = 'JAX';

UPDATE nfl_games AS g
   SET away_play_caller = c.full_name
  FROM nfl_game_coaches gc
  JOIN nfl_coaches c ON c.pfr_coach_id = gc.off_play_caller_pfr_id
 WHERE gc.nflverse_game_id = g.nflverse_game_id
   AND gc.team = g.v
   AND g.year = 2014
   AND gc.team = 'JAX';

-- Post-conditions: verify the targeted NULL cells are now zero.
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
    FROM nfl_game_coaches gc
    JOIN nfl_games g ON g.nflverse_game_id = gc.nflverse_game_id
   WHERE g.year BETWEEN 2014 AND 2015
     AND (
       (gc.team = 'JAX' AND g.year = 2014 AND gc.off_play_caller_pfr_id IS NULL)
       OR (gc.team = 'PHI' AND g.year BETWEEN 2014 AND 2015 AND gc.def_play_caller_pfr_id IS NULL)
     );
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'backfill incomplete: % targeted cells still NULL', remaining;
  END IF;
END $$;

COMMIT;
