import db from '#db'

export default {
  play_off_formation: {
    column_name: 'off_formation',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.off_formation as play_off_formation'],
    main_where: () => 'nfl_plays.off_formation'
  },
  play_off_personnel: {
    column_name: 'off_personnel',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.off_personnel as play_off_personnel'],
    main_where: () => 'nfl_plays.off_personnel'
  },
  play_def_personnel: {
    column_name: 'def_personnel',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.def_personnel as play_def_personnel'],
    main_where: () => 'nfl_plays.def_personnel'
  },
  play_box_defenders: {
    column_name: 'box_defenders',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.box_defenders as play_box_defenders'],
    main_where: () => 'nfl_plays.box_defenders',
    aggregate_select: () => db.raw('AVG(nfl_plays.box_defenders) as play_box_defenders'),
    use_having: true
  },
  play_pass_rushers: {
    column_name: 'pass_rushers',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.pass_rushers as play_pass_rushers'],
    main_where: () => 'nfl_plays.pass_rushers',
    aggregate_select: () => db.raw('AVG(nfl_plays.pass_rushers) as play_pass_rushers'),
    use_having: true
  },
  play_blitzers: {
    column_name: 'blitzers',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.blitzers as play_blitzers'],
    main_where: () => 'nfl_plays.blitzers',
    aggregate_select: () => db.raw('AVG(nfl_plays.blitzers) as play_blitzers'),
    use_having: true
  }
}
