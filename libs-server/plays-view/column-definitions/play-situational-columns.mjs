import db from '#db'

export default {
  play_is_play_action: {
    column_name: 'play_action',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.play_action as play_is_play_action'],
    main_where: () => 'nfl_plays.play_action',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.play_action = true THEN 1 ELSE 0 END) as play_is_play_action'
      ),
    use_having: true
  },
  play_is_no_huddle: {
    column_name: 'no_huddle',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.no_huddle as play_is_no_huddle'],
    main_where: () => 'nfl_plays.no_huddle',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.no_huddle = true THEN 1 ELSE 0 END) as play_is_no_huddle'
      ),
    use_having: true
  },
  play_is_screen: {
    column_name: 'screen_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.screen_pass as play_is_screen'],
    main_where: () => 'nfl_plays.screen_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.screen_pass = true THEN 1 ELSE 0 END) as play_is_screen'
      ),
    use_having: true
  },
  play_is_qb_scramble: {
    column_name: 'qb_scramble',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.qb_scramble as play_is_qb_scramble'],
    main_where: () => 'nfl_plays.qb_scramble',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.qb_scramble = true THEN 1 ELSE 0 END) as play_is_qb_scramble'
      ),
    use_having: true
  },
  play_is_qb_rush: {
    column_name: 'qb_rush',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.qb_rush as play_is_qb_rush'],
    main_where: () => 'nfl_plays.qb_rush',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.qb_rush = true THEN 1 ELSE 0 END) as play_is_qb_rush'
      ),
    use_having: true
  },
  play_is_blitz: {
    column_name: 'blitz',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.blitz as play_is_blitz'],
    main_where: () => 'nfl_plays.blitz',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.blitz = true THEN 1 ELSE 0 END) as play_is_blitz'
      ),
    use_having: true
  },
  play_is_zero_blitz: {
    column_name: 'zero_blitz',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.zero_blitz as play_is_zero_blitz'],
    main_where: () => 'nfl_plays.zero_blitz',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.zero_blitz = true THEN 1 ELSE 0 END) as play_is_zero_blitz'
      ),
    use_having: true
  },
  play_is_motion: {
    column_name: 'motion',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.motion as play_is_motion'],
    main_where: () => 'nfl_plays.motion',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.motion = true THEN 1 ELSE 0 END) as play_is_motion'
      ),
    use_having: true
  },
  play_is_trick_play: {
    column_name: 'trick_play',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.trick_play as play_is_trick_play'],
    main_where: () => 'nfl_plays.trick_play',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.trick_play = true THEN 1 ELSE 0 END) as play_is_trick_play'
      ),
    use_having: true
  },
  play_is_out_of_pocket: {
    column_name: 'out_of_pocket_pass',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.out_of_pocket_pass as play_is_out_of_pocket'
    ],
    main_where: () => 'nfl_plays.out_of_pocket_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.out_of_pocket_pass = true THEN 1 ELSE 0 END) as play_is_out_of_pocket'
      ),
    use_having: true
  }
}
