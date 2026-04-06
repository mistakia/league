-- Backfill: Fix nflfastR kickoff convention swap for score, EPA/WPA, and probability fields
-- The pos_team/off/def swap was applied for kickoffs, but these derived fields were not adjusted.
-- This script corrects them so all values are from the kicking team (pos_team) perspective.
--
-- Target: all kickoff plays (play_type = 'KOFF'), ~76K rows across all year partitions
-- Safe to run multiple times: swapping/negating is its own inverse, but should only be run ONCE.

BEGIN;

UPDATE nfl_plays
SET
  -- Score pairs: swap pos <-> def
  pos_score = def_score,
  def_score = pos_score,
  pos_score_post = def_score_post,
  def_score_post = pos_score_post,

  -- Score differentials: negate
  score_diff = -score_diff,
  score_diff_post = -score_diff_post,

  -- Timeout pairs: swap pos <-> def
  pos_to_rem = def_to_rem,
  def_to_rem = pos_to_rem,

  -- EPA fields: negate
  epa = -epa,
  ep = -ep,
  qb_epa = -qb_epa,
  air_epa = -air_epa,
  yac_epa = -yac_epa,
  comp_air_epa = -comp_air_epa,
  comp_yac_epa = -comp_yac_epa,
  xyac_epa = -xyac_epa,

  -- Re-derive ep_succ from negated epa (was derived from receiving team perspective)
  ep_succ = CASE WHEN epa IS NOT NULL THEN (-epa > 0) ELSE NULL END,

  -- WPA fields: negate
  wpa = -wpa,
  vegas_wpa = -vegas_wpa,
  air_wpa = -air_wpa,
  yac_wpa = -yac_wpa,
  comp_air_wpa = -comp_air_wpa,
  comp_yac_wpa = -comp_yac_wpa,

  -- Win probability: flip to kicking team perspective
  wp = 1 - wp,
  vegas_wp = 1 - vegas_wp,

  -- Probability pairs: swap own <-> opp
  fg_prob = opp_fg_prob,
  opp_fg_prob = fg_prob,
  td_prob = opp_td_prob,
  opp_td_prob = td_prob,
  safety_prob = opp_safety_prob,
  opp_safety_prob = safety_prob

WHERE play_type = 'KOFF';

COMMIT;
