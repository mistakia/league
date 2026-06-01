-- nfl_coaches own-id migration -- post-Phase-2 DET 2020 role fix.
--
-- Task: user:task/league/migrate-nfl-coaches-to-own-id.md
--
-- The original Phase 1 adhoc assigned DET 2020 interim coordinators with
-- swapped roles (DC -> Sean Ryan, OC -> Evan Rothstein). Cross-checking
-- against samhoppen's all_playcallers.csv reveals the correct attribution:
--
--   Week 16: off=Bevell, DC=Evan Rothstein, head=Bevell
--   Week 17: OC=Sean Ryan,  def=Cory Undlin, head=Bevell
--
-- This adhoc:
--   1. Re-inserts Sean Ryan into nfl_coaches (dropped from Phase 1 seeds
--      and from the importer's INTERIM_COORDINATOR_SEEDS prior to running
--      the dry-run that surfaced the swap).
--   2. Retargets DET 2020 week 16 def_play_caller_id from UNDL-CORY to
--      ROTH-EVAN (correct, per samhoppen).
--   3. Retargets DET 2020 week 17 off_play_caller_id from ROTH-EVAN to
--      RYAN-SEAN (correct, per samhoppen).

BEGIN;

INSERT INTO nfl_coaches (pfr_coach_id, full_name, dob, coach_id, updated_at)
VALUES
  (NULL, 'Sean Ryan', '1972-05-01', 'RYAN-SEAN-1972-05-01', now())
ON CONFLICT (coach_id) DO NOTHING;

-- DET 2020 week 16 DC: Cory Undlin -> Evan Rothstein.
UPDATE nfl_game_coaches b
SET def_play_caller_id = 'ROTH-EVAN-0000-00-00'
FROM nfl_games g
WHERE g.nflverse_game_id = b.nflverse_game_id
  AND g.year = 2020 AND b.team = 'DET' AND g.week = 16
  AND b.def_play_caller_id = 'UNDL-CORY-1971-06-29';

-- DET 2020 week 17 OC: Evan Rothstein -> Sean Ryan.
UPDATE nfl_game_coaches b
SET off_play_caller_id = 'RYAN-SEAN-1972-05-01'
FROM nfl_games g
WHERE g.nflverse_game_id = b.nflverse_game_id
  AND g.year = 2020 AND b.team = 'DET' AND g.week = 17
  AND b.off_play_caller_id = 'ROTH-EVAN-0000-00-00';

DO $$
DECLARE
  w16_dc text;
  w17_oc text;
BEGIN
  SELECT b.def_play_caller_id INTO w16_dc
  FROM nfl_game_coaches b JOIN nfl_games g ON g.nflverse_game_id = b.nflverse_game_id
  WHERE g.year=2020 AND b.team='DET' AND g.week=16;
  SELECT b.off_play_caller_id INTO w17_oc
  FROM nfl_game_coaches b JOIN nfl_games g ON g.nflverse_game_id = b.nflverse_game_id
  WHERE g.year=2020 AND b.team='DET' AND g.week=17;
  IF w16_dc <> 'ROTH-EVAN-0000-00-00' THEN
    RAISE EXCEPTION 'post-condition FAILED: DET 2020 wk16 DC=%, expected ROTH-EVAN-0000-00-00', w16_dc;
  END IF;
  IF w17_oc <> 'RYAN-SEAN-1972-05-01' THEN
    RAISE EXCEPTION 'post-condition FAILED: DET 2020 wk17 OC=%, expected RYAN-SEAN-1972-05-01', w17_oc;
  END IF;
  RAISE NOTICE 'post-condition OK: DET 2020 wk16 DC + wk17 OC corrected';
END $$;

COMMIT;
