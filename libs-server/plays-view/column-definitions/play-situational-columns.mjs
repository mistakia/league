import db from '#db'

export default {
  play_is_play_action: {
    column_name: 'is_play_action',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_play_action as play_is_play_action'],
    main_where: () => 'nfl_plays.is_play_action',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_play_action = true THEN 1 ELSE 0 END) as play_is_play_action'
      ),
    use_having: true
  },
  play_is_no_huddle: {
    column_name: 'is_no_huddle',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_no_huddle as play_is_no_huddle'],
    main_where: () => 'nfl_plays.is_no_huddle',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_no_huddle = true THEN 1 ELSE 0 END) as play_is_no_huddle'
      ),
    use_having: true
  },
  play_is_screen: {
    column_name: 'is_screen_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_screen_pass as play_is_screen'],
    main_where: () => 'nfl_plays.is_screen_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_screen_pass = true THEN 1 ELSE 0 END) as play_is_screen'
      ),
    use_having: true
  },
  play_is_qb_scramble: {
    column_name: 'is_qb_scramble',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_scramble as play_is_qb_scramble'],
    main_where: () => 'nfl_plays.is_qb_scramble',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_scramble = true THEN 1 ELSE 0 END) as play_is_qb_scramble'
      ),
    use_having: true
  },
  play_is_qb_rush: {
    column_name: 'is_qb_rush',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_rush as play_is_qb_rush'],
    main_where: () => 'nfl_plays.is_qb_rush',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_rush = true THEN 1 ELSE 0 END) as play_is_qb_rush'
      ),
    use_having: true
  },
  play_is_blitz: {
    column_name: 'is_blitz',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_blitz as play_is_blitz'],
    main_where: () => 'nfl_plays.is_blitz',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_blitz = true THEN 1 ELSE 0 END) as play_is_blitz'
      ),
    use_having: true
  },
  play_is_zero_blitz: {
    column_name: 'is_zero_blitz',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_zero_blitz as play_is_zero_blitz'],
    main_where: () => 'nfl_plays.is_zero_blitz',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_zero_blitz = true THEN 1 ELSE 0 END) as play_is_zero_blitz'
      ),
    use_having: true
  },
  play_is_motion: {
    column_name: 'is_motion',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_motion as play_is_motion'],
    main_where: () => 'nfl_plays.is_motion',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_motion = true THEN 1 ELSE 0 END) as play_is_motion'
      ),
    use_having: true
  },
  play_is_trick_play: {
    column_name: 'is_trick_play',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_trick_play as play_is_trick_play'],
    main_where: () => 'nfl_plays.is_trick_play',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_trick_play = true THEN 1 ELSE 0 END) as play_is_trick_play'
      ),
    use_having: true
  },
  play_is_out_of_pocket: {
    column_name: 'is_out_of_pocket_pass',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.is_out_of_pocket_pass as play_is_out_of_pocket'
    ],
    main_where: () => 'nfl_plays.is_out_of_pocket_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_out_of_pocket_pass = true THEN 1 ELSE 0 END) as play_is_out_of_pocket'
      ),
    use_having: true
  }
}
