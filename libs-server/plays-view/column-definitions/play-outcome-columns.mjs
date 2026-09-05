import db from '#db'

export default {
  play_yds_gained: {
    column_name: 'yards_gained',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.yards_gained as play_yds_gained'],
    main_where: () => 'nfl_plays.yards_gained',
    aggregate_select: () =>
      db.raw('SUM(nfl_plays.yards_gained) as play_yds_gained'),
    use_having: true
  },
  play_yds_gained_avg: {
    column_name: 'yards_gained',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.yards_gained as play_yds_gained_avg'],
    main_where: () => 'nfl_plays.yards_gained',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.yards_gained) as play_yds_gained_avg'),
    use_having: true
  },
  play_first_down: {
    column_name: 'is_first_down',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_first_down as play_first_down'],
    main_where: () => 'nfl_plays.is_first_down',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_first_down = true THEN 1 ELSE 0 END) as play_first_down'
      ),
    use_having: true
  },
  play_td: {
    column_name: 'is_touchdown',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_touchdown as play_td'],
    main_where: () => 'nfl_plays.is_touchdown',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_touchdown = true THEN 1 ELSE 0 END) as play_td'
      ),
    use_having: true
  },
  play_int: {
    column_name: 'is_interception',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_interception as play_int'],
    main_where: () => 'nfl_plays.is_interception',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_interception = true THEN 1 ELSE 0 END) as play_int'
      ),
    use_having: true
  },
  play_penalty: {
    column_name: 'is_penalty',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_penalty as play_penalty'],
    main_where: () => 'nfl_plays.is_penalty',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_penalty = true THEN 1 ELSE 0 END) as play_penalty'
      ),
    use_having: true
  },
  // Free text rather than a SELECT: the vocabulary is the league's own penalty
  // names and it is open, so an enumerated filter would be a list that goes
  // stale silently. Filter it with LIKE.
  play_penalty_type: {
    column_name: 'penalty_type',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.penalty_type as play_penalty_type'],
    main_where: () => 'nfl_plays.penalty_type'
  },
  play_successful: {
    column_name: 'is_successful_play',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_successful_play as play_successful'],
    main_where: () => 'nfl_plays.is_successful_play',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_successful_play = true THEN 1 ELSE 0 END) as play_successful'
      ),
    use_having: true
  },
  play_epa: {
    column_name: 'epa',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.epa as play_epa'],
    main_where: () => 'nfl_plays.epa',
    aggregate_select: () => db.raw('AVG(nfl_plays.epa) as play_epa'),
    use_having: true
  },
  play_epa_total: {
    column_name: 'epa',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.epa as play_epa_total'],
    main_where: () => 'nfl_plays.epa',
    aggregate_select: () => db.raw('SUM(nfl_plays.epa) as play_epa_total'),
    use_having: true
  },
  play_wpa: {
    column_name: 'win_probability_added',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.win_probability_added as play_wpa'],
    main_where: () => 'nfl_plays.win_probability_added',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.win_probability_added) as play_wpa'),
    use_having: true
  },
  play_ep: {
    column_name: 'expected_points',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.expected_points as play_ep'],
    main_where: () => 'nfl_plays.expected_points'
  },
  play_wp: {
    column_name: 'win_probability',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.win_probability as play_wp'],
    main_where: () => 'nfl_plays.win_probability'
  },
  play_cpoe: {
    column_name: 'completion_percentage_over_expected',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.completion_percentage_over_expected as play_cpoe'
    ],
    main_where: () => 'nfl_plays.completion_percentage_over_expected',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.completion_percentage_over_expected) as play_cpoe'),
    use_having: true
  },
  play_xpass_prob: {
    column_name: 'expected_pass_probability',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.expected_pass_probability as play_xpass_prob'
    ],
    main_where: () => 'nfl_plays.expected_pass_probability',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.expected_pass_probability) as play_xpass_prob'),
    use_having: true
  },
  play_pass_oe: {
    column_name: 'pass_over_expected',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.pass_over_expected as play_pass_oe'],
    main_where: () => 'nfl_plays.pass_over_expected',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.pass_over_expected) as play_pass_oe'),
    use_having: true
  }
}
