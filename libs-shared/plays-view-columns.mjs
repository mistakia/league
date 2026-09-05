// The single declaration every plays-view column is built from.
//
// One entry per column, consumed three ways: the server derives its SQL from
// `table` plus `column`, the client builds its field from `kind` and the
// display attributes, and the column's tooltip reads `description`. Until
// 2026-09 these were three hand-maintained registries with a parity test
// standing in for a single source.
//
// A column id is PERMANENT: ids are persisted in immutable short URLs, so
// renaming a key here silently breaks a saved link. See docs/guides/data.md.
//
// Fields:
//   table, column        physical source; omitted when the column is derived
//   sql_override         the server owns this column's SQL (a CASE, a join,
//                        a concatenation) rather than deriving it
//   kind                 number | text | boolean -- sets data_type and size
//   aggregate            avg | sum | bool_count | passthrough; omit for none.
//                        Any of the first three also makes the column filter
//                        through HAVING in aggregate mode.

export default {
  play_film_url: {
    sql_override: true,
    kind: 'text',
    group: 'CORE',
    header_label: 'FILM',
    size: 50,
    cell: 'PlayFilmLinkCell',
    description:
      'Link to the coaches film for this play on NFL Pro (requires an NFL Pro subscription). Empty for plays before the 2022 season, which predate film coverage, and for rows that are not a play that was run, such as timeouts and injury updates.'
  },
  play_esbid: {
    table: 'nfl_plays',
    column: 'esbid',
    kind: 'number',
    group: 'CORE',
    header_label: 'ESBID',
    size: 90,
    disable_percentiles: true,
    description: 'The ESPN game identifier (ESBID)'
  },
  play_timestamp: {
    table: 'nfl_plays',
    column: 'play_time_of_day',
    sql_override: true,
    kind: 'text',
    group: 'CORE',
    header_label: 'TIME',
    size: 70,
    description: 'The wall-clock time the play occurred (HH:MM:SS)'
  },
  play_game_timestamp: {
    table: 'nfl_games',
    column: 'kickoff_at',
    sql_override: true,
    kind: 'number',
    data_type: 'DATE',
    group: 'CORE',
    header_label: 'GTIME',
    size: 90,
    join: true,
    description: 'The game kickoff time'
  },
  play_desc: {
    table: 'nfl_plays',
    column: 'play_description',
    kind: 'text',
    group: 'CORE',
    header_label: 'DESC',
    size: 300,
    description: 'The text description of the play'
  },
  play_type: {
    table: 'nfl_plays',
    column: 'play_type',
    kind: 'text',
    data_type: 'SELECT',
    column_values: [
      { value: 'PASS', label: 'PASS', group: 'Pass' },
      { value: 'RUSH', label: 'RUSH', group: 'Run' },
      { value: 'PUNT', label: 'PUNT', group: 'Special' },
      { value: 'KICK', label: 'KICK', group: 'Special' },
      { value: 'FGXP', label: 'FGXP', group: 'Special' },
      { value: 'NOPL', label: 'NOPL', group: 'Special' },
      { value: 'KOFF', label: 'KOFF', group: 'Special' },
      { value: 'ONSD', label: 'ONSD', group: 'Special' },
      { value: 'CONV', label: 'CONV', group: 'Special' }
    ],
    group: 'CORE',
    header_label: 'TYPE',
    size: 60,
    aggregate: 'passthrough',
    description: 'The type of play (PASS, RUSH, etc.)'
  },
  play_off_team: {
    table: 'nfl_plays',
    column: 'possession_nfl_team',
    kind: 'text',
    group: 'CORE',
    header_label: 'OFF',
    size: 60,
    cell: 'TeamCodeColumn',
    description: 'The offensive team on the play'
  },
  play_def_team: {
    table: 'nfl_plays',
    column: 'defense_nfl_team',
    kind: 'text',
    group: 'CORE',
    header_label: 'DEF',
    size: 60,
    cell: 'TeamCodeColumn',
    description: 'The defensive team on the play'
  },
  play_down: {
    table: 'nfl_plays',
    column: 'down_number',
    kind: 'number',
    group: 'CORE',
    header_label: 'DWN',
    size: 40,
    disable_percentiles: true,
    description: 'The down number (1-4)'
  },
  play_yards_to_go: {
    table: 'nfl_plays',
    column: 'yards_to_go',
    kind: 'number',
    group: 'CORE',
    header_label: 'YTG',
    size: 40,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'Yards needed for a first down'
  },
  play_ydl_100: {
    table: 'nfl_plays',
    column: 'yard_line_100',
    kind: 'number',
    group: 'CORE',
    header_label: 'YDL',
    size: 40,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'Yard line normalized to 0-100 (distance from end zone)'
  },
  play_quarter: {
    table: 'nfl_plays',
    column: 'quarter',
    kind: 'number',
    group: 'CORE',
    header_label: 'QTR',
    size: 40,
    disable_percentiles: true,
    description: 'The quarter of the game'
  },
  play_game_clock: {
    table: 'nfl_plays',
    column: 'game_clock_start',
    kind: 'text',
    group: 'CORE',
    header_label: 'CLOCK',
    size: 60,
    description: 'The game clock at the start of the play'
  },
  play_sequence: {
    table: 'nfl_plays',
    column: 'sequence',
    kind: 'number',
    group: 'CORE',
    header_label: 'SEQ',
    size: 50,
    disable_percentiles: true,
    description: 'The sequence number of the play in the game'
  },
  play_year: {
    table: 'nfl_plays',
    column: 'season_year',
    kind: 'number',
    group: 'CORE',
    header_label: 'YEAR',
    size: 60,
    disable_percentiles: true,
    description: 'The NFL season year'
  },
  play_seas_type: {
    table: 'nfl_plays',
    column: 'season_type',
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['PRE', 'REG', 'POST'],
    group: 'CORE',
    header_label: 'TYPE',
    size: 60,
    description:
      'The season type — PRE, REG or POST. Filter on it whenever the view sets its own years, since a year filter turns off the regular-season default.'
  },
  play_week: {
    table: 'nfl_plays',
    column: 'week',
    kind: 'number',
    group: 'CORE',
    header_label: 'WK',
    size: 40,
    disable_percentiles: true,
    description: 'The NFL week number'
  },
  play_game_id: {
    table: 'nfl_plays',
    column: 'esbid',
    kind: 'text',
    group: 'CORE',
    header_label: 'GID',
    size: 80,
    description: 'The unique game identifier (ESBID)'
  },
  play_yds_gained: {
    table: 'nfl_plays',
    column: 'yards_gained',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'YDS',
    aggregate: 'sum',
    description: 'Total yards gained on the play'
  },
  play_yds_gained_avg: {
    table: 'nfl_plays',
    column: 'yards_gained',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'AVG',
    fixed: 1,
    aggregate: 'avg',
    description: 'Average yards gained per play'
  },
  play_first_down: {
    table: 'nfl_plays',
    column: 'is_first_down',
    kind: 'boolean',
    group: 'OUTCOME',
    header_label: '1D',
    aggregate: 'bool_count',
    description: 'Whether the play resulted in a first down'
  },
  play_td: {
    table: 'nfl_plays',
    column: 'is_touchdown',
    kind: 'boolean',
    group: 'OUTCOME',
    header_label: 'TD',
    aggregate: 'bool_count',
    description: 'Whether the play resulted in a touchdown'
  },
  play_int: {
    table: 'nfl_plays',
    column: 'is_interception',
    kind: 'boolean',
    group: 'OUTCOME',
    header_label: 'INT',
    aggregate: 'bool_count',
    description: 'Whether the pass was intercepted'
  },
  play_penalty: {
    table: 'nfl_plays',
    column: 'is_penalty',
    kind: 'boolean',
    group: 'OUTCOME',
    header_label: 'PEN',
    aggregate: 'bool_count',
    description: 'Whether a penalty was called on the play'
  },
  play_penalty_type: {
    table: 'nfl_plays',
    column: 'penalty_type',
    kind: 'text',
    group: 'OUTCOME',
    header_label: 'PENTYPE',
    size: 180,
    description: 'The penalty called, when there was one'
  },
  play_successful: {
    table: 'nfl_plays',
    column: 'is_successful_play',
    kind: 'boolean',
    group: 'OUTCOME',
    header_label: 'SUCC',
    aggregate: 'bool_count',
    description:
      'Whether the play was successful (gained expected yards based on down and distance)'
  },
  play_epa: {
    table: 'nfl_plays',
    column: 'epa',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'EPA',
    fixed: 2,
    aggregate: 'avg',
    description: 'Expected Points Added - average EPA per play'
  },
  play_epa_total: {
    table: 'nfl_plays',
    column: 'epa',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'EPA TOT',
    size: 80,
    fixed: 1,
    aggregate: 'sum',
    description: 'Expected Points Added - total EPA'
  },
  play_wpa: {
    table: 'nfl_plays',
    column: 'win_probability_added',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'WPA',
    fixed: 3,
    aggregate: 'avg',
    description: 'Win Probability Added per play'
  },
  play_ep: {
    table: 'nfl_plays',
    column: 'expected_points',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'EP',
    fixed: 2,
    disable_percentiles: true,
    description: 'Expected Points before the play'
  },
  play_wp: {
    table: 'nfl_plays',
    column: 'win_probability',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'WP',
    fixed: 3,
    disable_percentiles: true,
    description: 'Win Probability before the play'
  },
  play_cpoe: {
    table: 'nfl_plays',
    column: 'completion_percentage_over_expected',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'CPOE',
    fixed: 1,
    aggregate: 'avg',
    description: 'Completion Probability Over Expected'
  },
  play_xpass_prob: {
    table: 'nfl_plays',
    column: 'expected_pass_probability',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'XPASS',
    size: 60,
    fixed: 2,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'Expected pass probability based on game situation'
  },
  play_pass_oe: {
    table: 'nfl_plays',
    column: 'pass_over_expected',
    kind: 'number',
    group: 'OUTCOME',
    header_label: 'POE',
    fixed: 2,
    aggregate: 'avg',
    description: 'Pass rate over expected'
  },
  play_passer: {
    table: 'nfl_plays',
    column: 'passer_pid',
    sql_override: true,
    kind: 'text',
    group: 'PASSING',
    header_label: 'PASSER',
    size: 120,
    aggregate: 'override',
    join: true,
    description: 'The name of the quarterback/passer'
  },
  play_passer_pid: {
    table: 'nfl_plays',
    column: 'passer_pid',
    kind: 'text',
    group: 'PASSING',
    header_label: 'PSR PID',
    size: 80,
    description: 'The player ID of the passer'
  },
  play_pass_yds: {
    table: 'nfl_plays',
    column: 'pass_yards',
    kind: 'number',
    group: 'PASSING',
    header_label: 'PYD',
    aggregate: 'sum',
    description: 'Passing yards on the play'
  },
  play_air_yards: {
    table: 'nfl_plays',
    column: 'air_yards',
    kind: 'number',
    group: 'PASSING',
    header_label: 'AY',
    aggregate: 'avg',
    description: 'Air yards (distance ball traveled past line of scrimmage)'
  },
  play_true_air_yards: {
    table: 'nfl_plays',
    column: 'true_air_yards',
    kind: 'number',
    group: 'PASSING',
    header_label: 'TAY',
    aggregate: 'avg',
    description: 'True air yards accounting for depth of target'
  },
  play_comp: {
    table: 'nfl_plays',
    column: 'is_completion',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'CMP',
    aggregate: 'bool_count',
    description: 'Whether the pass was completed'
  },
  play_time_to_throw: {
    table: 'nfl_plays',
    column: 'time_to_throw',
    kind: 'number',
    group: 'PASSING',
    header_label: 'TTT',
    fixed: 2,
    aggregate: 'avg',
    description: 'Time from snap to throw in seconds'
  },
  play_dot: {
    table: 'nfl_plays',
    column: 'depth_of_target',
    kind: 'number',
    group: 'PASSING',
    header_label: 'DOT',
    fixed: 1,
    aggregate: 'avg',
    description: 'Depth of target in yards'
  },
  play_highlight_pass: {
    table: 'nfl_plays',
    column: 'is_highlight_pass',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'BT',
    aggregate: 'bool_count',
    description: 'Whether the pass was a highlight/big-time throw'
  },
  play_int_worthy: {
    table: 'nfl_plays',
    column: 'is_interception_worthy',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'IW',
    aggregate: 'bool_count',
    description: 'Whether the pass was interception-worthy'
  },
  play_dropped_pass: {
    table: 'nfl_plays',
    column: 'is_dropped_pass',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'DRP',
    aggregate: 'bool_count',
    description: 'Whether the pass was dropped by the receiver'
  },
  play_qb_pressure: {
    table: 'nfl_plays',
    column: 'is_qb_pressure',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'PRSS',
    aggregate: 'bool_count',
    description: 'Whether the quarterback was pressured'
  },
  play_qb_hit: {
    table: 'nfl_plays',
    column: 'is_qb_hit',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'HIT',
    aggregate: 'bool_count',
    description: 'Whether the quarterback was hit'
  },
  play_sk: {
    table: 'nfl_plays',
    column: 'is_sack',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'SK',
    aggregate: 'bool_count',
    description: 'Whether the play resulted in a sack'
  },
  play_qb_hurry: {
    table: 'nfl_plays',
    column: 'is_qb_hurry',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'HRY',
    aggregate: 'bool_count',
    description: 'Whether the quarterback was hurried'
  },
  play_pocket_time: {
    table: 'nfl_plays',
    column: 'pocket_time',
    kind: 'number',
    group: 'PASSING',
    header_label: 'PCKT',
    fixed: 2,
    aggregate: 'avg',
    description: 'Seconds the quarterback had in the pocket'
  },
  play_dropback_depth: {
    table: 'nfl_plays',
    column: 'dropback_depth',
    kind: 'number',
    group: 'PASSING',
    header_label: 'DEPTH',
    fixed: 1,
    aggregate: 'avg',
    description: 'How deep the quarterback dropped, in yards'
  },
  play_throw_away: {
    table: 'nfl_plays',
    column: 'is_throw_away',
    kind: 'boolean',
    group: 'PASSING',
    header_label: 'TAWAY',
    aggregate: 'bool_count',
    description: 'Whether the quarterback threw the ball away'
  },
  play_pass_location: {
    table: 'nfl_plays',
    column: 'pass_location',
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['LEFT', 'MIDDLE', 'RIGHT'],
    group: 'PASSING',
    header_label: 'LOC',
    size: 80,
    description: 'Where the pass went — LEFT, MIDDLE or RIGHT'
  },
  play_read_thrown: {
    table: 'nfl_plays',
    column: 'read_thrown',
    kind: 'text',
    data_type: 'SELECT',
    column_values: [
      'FIRST',
      'SECOND',
      'CHECKDOWN',
      'DESIGNED',
      'SCRAMBLE_DRILL'
    ],
    group: 'PASSING',
    header_label: 'READ',
    size: 120,
    description:
      'Which read the quarterback threw — FIRST, SECOND, CHECKDOWN, DESIGNED or SCRAMBLE_DRILL'
  },
  play_qb_alignment: {
    table: 'nfl_plays',
    column: 'quarterback_position',
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['SHOTGUN', 'UNDER_CENTER', 'PISTOL'],
    group: 'PASSING',
    header_label: 'QBALN',
    size: 120,
    description:
      'How the quarterback lined up — SHOTGUN, UNDER_CENTER or PISTOL'
  },
  play_rusher: {
    table: 'nfl_plays',
    column: 'ball_carrier_pid',
    sql_override: true,
    kind: 'text',
    group: 'RUSHING',
    header_label: 'RUSHER',
    size: 120,
    aggregate: 'override',
    join: true,
    description: 'The name of the ball carrier/rusher'
  },
  play_rusher_pid: {
    table: 'nfl_plays',
    column: 'ball_carrier_pid',
    kind: 'text',
    group: 'RUSHING',
    header_label: 'RB PID',
    size: 80,
    description: 'The player ID of the rusher'
  },
  play_rush_yds: {
    table: 'nfl_plays',
    column: 'rush_yards',
    kind: 'number',
    group: 'RUSHING',
    header_label: 'RYD',
    aggregate: 'sum',
    description: 'Rushing yards on the play'
  },
  play_yards_after_contact: {
    table: 'nfl_plays',
    column: 'yards_after_any_contact',
    kind: 'number',
    group: 'RUSHING',
    header_label: 'YAC',
    fixed: 1,
    aggregate: 'avg',
    description: 'Yards gained after initial contact'
  },
  play_broken_tackles: {
    table: 'nfl_plays',
    column: 'broken_tackles_rush',
    kind: 'number',
    group: 'RUSHING',
    header_label: 'BT',
    aggregate: 'sum',
    description: 'Number of broken tackles on the rush'
  },
  play_run_location: {
    table: 'nfl_plays',
    column: 'run_location',
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['left', 'middle', 'right'],
    group: 'RUSHING',
    header_label: 'LOC',
    size: 70,
    description: 'Location of the run (left, middle, right)'
  },
  play_run_gap: {
    table: 'nfl_plays',
    column: 'run_gap',
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['guard', 'tackle', 'end'],
    group: 'RUSHING',
    header_label: 'GAP',
    size: 70,
    description: 'The gap targeted on the run play'
  },
  play_target: {
    table: 'nfl_plays',
    column: 'target_pid',
    sql_override: true,
    kind: 'text',
    group: 'RECEIVING',
    header_label: 'TARGET',
    size: 120,
    aggregate: 'override',
    join: true,
    description: 'The name of the targeted receiver'
  },
  play_target_pid: {
    table: 'nfl_plays',
    column: 'target_pid',
    kind: 'text',
    group: 'RECEIVING',
    header_label: 'TGT PID',
    size: 80,
    description: 'The player ID of the target'
  },
  play_recv_yds: {
    table: 'nfl_plays',
    column: 'receiving_yards',
    kind: 'number',
    group: 'RECEIVING',
    header_label: 'RECY',
    aggregate: 'sum',
    description: 'Receiving yards on the play'
  },
  play_yards_after_catch: {
    table: 'nfl_plays',
    column: 'yards_after_catch',
    kind: 'number',
    group: 'RECEIVING',
    header_label: 'YAC',
    fixed: 1,
    aggregate: 'avg',
    description: 'Yards gained after the catch'
  },
  play_route: {
    table: 'nfl_plays',
    column: 'charted_route',
    kind: 'text',
    group: 'RECEIVING',
    header_label: 'ROUTE',
    size: 80,
    description: 'The route run by the receiver'
  },
  play_receiver_separation: {
    table: 'nfl_plays',
    column: 'targeted_receiver_separation',
    kind: 'text',
    data_type: 'SELECT',
    column_values: [
      'WIDE_OPEN',
      'OPEN',
      'ONE_STEP_OPEN',
      'CLOSING_COVERAGE',
      'TIGHT_COVERAGE'
    ],
    group: 'RECEIVING',
    header_label: 'SEP',
    size: 130,
    description:
      'How open the targeted receiver was — WIDE_OPEN, OPEN, ONE_STEP_OPEN, CLOSING_COVERAGE or TIGHT_COVERAGE'
  },
  play_pass_breakup: {
    table: 'nfl_plays',
    column: 'is_pass_breakup',
    kind: 'boolean',
    group: 'RECEIVING',
    header_label: 'PBU',
    aggregate: 'bool_count',
    description: 'Whether a defender broke up the pass'
  },
  play_contested_ball: {
    table: 'nfl_plays',
    column: 'is_contested_ball',
    kind: 'boolean',
    group: 'RECEIVING',
    header_label: 'CNTST',
    aggregate: 'bool_count',
    description: 'Whether the catch was contested'
  },
  play_catchable_ball: {
    table: 'nfl_plays',
    column: 'is_catchable_ball',
    kind: 'boolean',
    group: 'RECEIVING',
    header_label: 'CTCH',
    aggregate: 'bool_count',
    description: 'Whether the pass was catchable'
  },
  play_endzone_target: {
    table: 'nfl_plays',
    column: 'is_endzone_target',
    kind: 'boolean',
    group: 'RECEIVING',
    header_label: 'EZ',
    aggregate: 'bool_count',
    description: 'Whether the target was in the end zone'
  },
  play_score_diff: {
    table: 'nfl_plays',
    column: 'score_difference',
    kind: 'number',
    group: 'CONTEXT',
    header_label: 'SDIFF',
    disable_percentiles: true,
    description:
      'Score differential from the perspective of the possession team'
  },
  play_home_score: {
    table: 'nfl_plays',
    column: 'home_score',
    kind: 'number',
    group: 'CONTEXT',
    header_label: 'HSCR',
    disable_percentiles: true,
    description: 'Home team score at the time of the play'
  },
  play_away_score: {
    table: 'nfl_plays',
    column: 'away_score',
    kind: 'number',
    group: 'CONTEXT',
    header_label: 'ASCR',
    disable_percentiles: true,
    description: 'Away team score at the time of the play'
  },
  play_sec_rem_half: {
    table: 'nfl_plays',
    column: 'seconds_remaining_half',
    kind: 'number',
    group: 'CONTEXT',
    header_label: 'SRH',
    size: 60,
    disable_percentiles: true,
    description: 'Seconds remaining in the half'
  },
  play_sec_rem_gm: {
    table: 'nfl_plays',
    column: 'seconds_remaining_game',
    kind: 'number',
    group: 'CONTEXT',
    header_label: 'SRG',
    size: 60,
    disable_percentiles: true,
    description: 'Seconds remaining in the game'
  },
  play_home_team: {
    table: 'nfl_games',
    column: 'home_nfl_team',
    kind: 'text',
    group: 'CONTEXT',
    header_label: 'HOME',
    size: 60,
    cell: 'TeamCodeColumn',
    join: true,
    description: 'The home team'
  },
  play_away_team: {
    table: 'nfl_games',
    column: 'away_nfl_team',
    kind: 'text',
    group: 'CONTEXT',
    header_label: 'AWAY',
    size: 60,
    cell: 'TeamCodeColumn',
    join: true,
    description: 'The away team'
  },
  play_goal_to_go: {
    table: 'nfl_plays',
    column: 'is_goal_to_go',
    kind: 'boolean',
    group: 'CONTEXT',
    header_label: 'GTG',
    description: 'Whether it is a goal-to-go situation'
  },
  play_off_formation: {
    table: 'nfl_plays',
    column: 'offense_formation',
    kind: 'text',
    data_type: 'SELECT',
    column_values: [
      'SHOTGUN',
      'UNDER_CENTER',
      'PISTOL',
      'EMPTY',
      'WILDCAT',
      'JUMBO',
      'I_FORM',
      'SINGLEBACK'
    ],
    group: 'PERSONNEL',
    header_label: 'FORM',
    size: 130,
    description: 'The offensive formation'
  },
  play_off_personnel: {
    table: 'nfl_plays',
    column: 'offense_personnel',
    kind: 'text',
    group: 'PERSONNEL',
    header_label: 'O PERS',
    description: 'The offensive personnel grouping'
  },
  play_def_personnel: {
    table: 'nfl_plays',
    column: 'defense_personnel',
    kind: 'text',
    group: 'PERSONNEL',
    header_label: 'D PERS',
    description: 'The defensive personnel grouping'
  },
  play_box_defenders: {
    table: 'nfl_plays',
    column: 'box_defenders',
    kind: 'number',
    group: 'PERSONNEL',
    header_label: 'BOX',
    fixed: 1,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'Number of defenders in the box'
  },
  play_pass_rushers: {
    table: 'nfl_plays',
    column: 'pass_rushers',
    kind: 'number',
    group: 'PERSONNEL',
    header_label: 'RUSH',
    fixed: 1,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'Number of pass rushers'
  },
  play_blitzers: {
    table: 'nfl_plays',
    column: 'blitzers',
    kind: 'number',
    group: 'PERSONNEL',
    header_label: 'BLTZ',
    fixed: 1,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'Number of blitzers'
  },
  play_is_play_action: {
    table: 'nfl_plays',
    column: 'is_play_action',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'PA',
    aggregate: 'bool_count',
    description: 'Whether play action was used'
  },
  play_is_no_huddle: {
    table: 'nfl_plays',
    column: 'is_no_huddle',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'NHUD',
    aggregate: 'bool_count',
    description: 'Whether the offense used no-huddle'
  },
  play_is_screen: {
    table: 'nfl_plays',
    column: 'is_screen_pass',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'SCRN',
    aggregate: 'bool_count',
    description: 'Whether the play was a screen pass'
  },
  play_is_qb_scramble: {
    table: 'nfl_plays',
    column: 'is_qb_scramble',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'SCMB',
    aggregate: 'bool_count',
    description: 'Whether the quarterback scrambled'
  },
  play_is_qb_rush: {
    table: 'nfl_plays',
    column: 'is_qb_rush',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'QBR',
    aggregate: 'bool_count',
    description: 'Whether it was a designed quarterback run'
  },
  play_is_qb_dropback: {
    table: 'nfl_plays',
    column: 'is_qb_dropback',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'DRPB',
    aggregate: 'bool_count',
    description:
      'Whether the quarterback dropped back — a pass attempt, a sack, or a scramble'
  },
  play_coverage_type: {
    table: 'nfl_plays',
    column: 'coverage_type',
    sql_override: true,
    kind: 'text',
    data_type: 'SELECT',
    column_values: [
      'COVER_0',
      'COVER_1',
      'COVER_2',
      'COVER_2_MAN',
      'COVER_3',
      'COVER_4',
      'COVER_5',
      'COVER_6',
      'COVER_9',
      'COMBINATION',
      'PREVENT'
    ],
    group: 'SITUATIONAL',
    header_label: 'COV',
    size: 110,
    description:
      'The coverage shell (COVER_0 through COVER_9, COVER_2_MAN, COMBINATION, PREVENT). Our own charting where it exists, from 2023, and the Next Gen Stats classification otherwise, back to 2018. The two disagree on about 38 percent of the plays both classify, so pair this with the coverage source column before comparing across 2023.'
  },
  play_coverage_source: {
    table: 'nfl_plays',
    column: 'coverage_type',
    sql_override: true,
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['charted', 'next_gen_stats'],
    group: 'SITUATIONAL',
    header_label: 'COVSRC',
    size: 110,
    description:
      'Which feed supplied the coverage shell on this play — charted (ours, 2023 onward) or next_gen_stats (2018 onward). Filter on it to hold one classifier constant across a multi-season view.'
  },
  play_man_zone: {
    table: 'nfl_plays',
    column: 'man_zone',
    sql_override: true,
    kind: 'text',
    data_type: 'SELECT',
    column_values: ['MAN_COVERAGE', 'ZONE_COVERAGE', 'SITUATIONAL', 'MISC'],
    group: 'SITUATIONAL',
    header_label: 'MN/ZN',
    size: 120,
    description:
      'Whether the coverage was man or zone (MAN_COVERAGE, ZONE_COVERAGE, SITUATIONAL, MISC). The two feeds spell this differently and both are live in 2025, so the raw MAN/ZONE spellings are normalized to the long ones here.'
  },
  play_is_blitz: {
    table: 'nfl_plays',
    column: 'is_blitz',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'BLZ',
    aggregate: 'bool_count',
    description: 'Whether the defense blitzed'
  },
  play_is_zero_blitz: {
    table: 'nfl_plays',
    column: 'is_zero_blitz',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: '0BLZ',
    aggregate: 'bool_count',
    description: 'Whether the defense ran a zero blitz'
  },
  play_is_stunt: {
    table: 'nfl_plays',
    column: 'is_stunt',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'STNT',
    aggregate: 'bool_count',
    description: 'Whether the pass rush ran a stunt'
  },
  play_coverage_defenders: {
    table: 'nfl_plays',
    column: 'coverage_defenders',
    kind: 'number',
    group: 'SITUATIONAL',
    header_label: 'COVDEF',
    fixed: 1,
    disable_percentiles: true,
    aggregate: 'avg',
    description: 'How many defenders dropped into coverage'
  },
  play_is_motion: {
    table: 'nfl_plays',
    column: 'is_motion',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'MOT',
    aggregate: 'bool_count',
    description: 'Whether pre-snap motion was used'
  },
  play_is_trick_play: {
    table: 'nfl_plays',
    column: 'is_trick_play',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'TRCK',
    aggregate: 'bool_count',
    description: 'Whether the play was a trick play'
  },
  play_is_out_of_pocket: {
    table: 'nfl_plays',
    column: 'is_out_of_pocket_pass',
    kind: 'boolean',
    group: 'SITUATIONAL',
    header_label: 'OOP',
    aggregate: 'bool_count',
    description: 'Whether the pass was thrown out of the pocket'
  }
}
