export default {
  // Core play fields
  play_esbid: 'The ESPN game identifier (ESBID)',
  play_timestamp: 'The wall-clock time the play occurred (HH:MM:SS)',
  play_game_timestamp: 'The game start time as a unix timestamp',
  play_desc: 'The text description of the play',
  play_type: 'The type of play (PASS, RUSH, etc.)',
  play_off_team: 'The offensive team on the play',
  play_def_team: 'The defensive team on the play',
  play_down: 'The down number (1-4)',
  play_yards_to_go: 'Yards needed for a first down',
  play_ydl_100: 'Yard line normalized to 0-100 (distance from end zone)',
  play_quarter: 'The quarter of the game',
  play_game_clock: 'The game clock at the start of the play',
  play_sequence: 'The sequence number of the play in the game',
  play_year: 'The NFL season year',
  play_week: 'The NFL week number',
  play_game_id: 'The unique game identifier (ESBID)',

  // Outcome fields
  play_yds_gained: 'Total yards gained on the play',
  play_yds_gained_avg: 'Average yards gained per play',
  play_first_down: 'Whether the play resulted in a first down',
  play_td: 'Whether the play resulted in a touchdown',
  play_successful:
    'Whether the play was successful (gained expected yards based on down and distance)',
  play_epa: 'Expected Points Added - average EPA per play',
  play_epa_total: 'Expected Points Added - total EPA',
  play_wpa: 'Win Probability Added per play',
  play_ep: 'Expected Points before the play',
  play_wp: 'Win Probability before the play',
  play_cpoe: 'Completion Probability Over Expected',
  play_xpass_prob: 'Expected pass probability based on game situation',
  play_pass_oe: 'Pass rate over expected',

  // Passing fields
  play_passer: 'The name of the quarterback/passer',
  play_passer_pid: 'The player ID of the passer',
  play_pass_yds: 'Passing yards on the play',
  play_air_yards: 'Air yards (distance ball traveled past line of scrimmage)',
  play_true_air_yards: 'True air yards accounting for depth of target',
  play_comp: 'Whether the pass was completed',
  play_time_to_throw: 'Time from snap to throw in seconds',
  play_dot: 'Depth of target in yards',
  play_highlight_pass: 'Whether the pass was a highlight/big-time throw',
  play_int_worthy: 'Whether the pass was interception-worthy',
  play_dropped_pass: 'Whether the pass was dropped by the receiver',
  play_qb_pressure: 'Whether the quarterback was pressured',
  play_qb_hit: 'Whether the quarterback was hit',
  play_sk: 'Whether the play resulted in a sack',

  // Rushing fields
  play_rusher: 'The name of the ball carrier/rusher',
  play_rusher_pid: 'The player ID of the rusher',
  play_rush_yds: 'Rushing yards on the play',
  play_yards_after_contact: 'Yards gained after initial contact',
  play_broken_tackles: 'Number of broken tackles on the rush',
  play_run_location: 'Location of the run (left, middle, right)',
  play_run_gap: 'The gap targeted on the run play',

  // Receiving fields
  play_target: 'The name of the targeted receiver',
  play_target_pid: 'The player ID of the target',
  play_recv_yds: 'Receiving yards on the play',
  play_yards_after_catch: 'Yards gained after the catch',
  play_route: 'The route run by the receiver',
  play_contested_ball: 'Whether the catch was contested',
  play_catchable_ball: 'Whether the pass was catchable',
  play_endzone_target: 'Whether the target was in the end zone',

  // Context fields
  play_score_diff:
    'Score differential from the perspective of the possession team',
  play_home_score: 'Home team score at the time of the play',
  play_away_score: 'Away team score at the time of the play',
  play_sec_rem_half: 'Seconds remaining in the half',
  play_sec_rem_gm: 'Seconds remaining in the game',
  play_home_team: 'The home team',
  play_away_team: 'The away team',
  play_goal_to_go: 'Whether it is a goal-to-go situation',

  // Personnel fields
  play_off_formation: 'The offensive formation',
  play_off_personnel: 'The offensive personnel grouping',
  play_def_personnel: 'The defensive personnel grouping',
  play_box_defenders: 'Number of defenders in the box',
  play_pass_rushers: 'Number of pass rushers',
  play_blitzers: 'Number of blitzers',

  // Situational fields
  play_is_play_action: 'Whether play action was used',
  play_is_no_huddle: 'Whether the offense used no-huddle',
  play_is_screen: 'Whether the play was a screen pass',
  play_is_qb_scramble: 'Whether the quarterback scrambled',
  play_is_qb_rush: 'Whether it was a designed quarterback run',
  play_is_blitz: 'Whether the defense blitzed',
  play_is_zero_blitz: 'Whether the defense ran a zero blitz',
  play_is_motion: 'Whether pre-snap motion was used',
  play_is_trick_play: 'Whether the play was a trick play',
  play_is_out_of_pocket: 'Whether the pass was thrown out of the pocket'
}
