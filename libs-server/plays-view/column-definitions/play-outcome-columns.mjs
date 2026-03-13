import db from '#db'

export default {
  play_yds_gained: {
    column_name: 'yds_gained',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.yds_gained as play_yds_gained'],
    main_where: () => 'nfl_plays.yds_gained',
    aggregate_select: () => db.raw('SUM(nfl_plays.yds_gained) as play_yds_gained'),
    use_having: true
  },
  play_yds_gained_avg: {
    column_name: 'yds_gained',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.yds_gained as play_yds_gained_avg'],
    main_where: () => 'nfl_plays.yds_gained',
    aggregate_select: () => db.raw('AVG(nfl_plays.yds_gained) as play_yds_gained_avg'),
    use_having: true
  },
  play_first_down: {
    column_name: 'first_down',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.first_down as play_first_down'],
    main_where: () => 'nfl_plays.first_down',
    aggregate_select: () => db.raw('SUM(CASE WHEN nfl_plays.first_down = true THEN 1 ELSE 0 END) as play_first_down'),
    use_having: true
  },
  play_td: {
    column_name: 'td',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.td as play_td'],
    main_where: () => 'nfl_plays.td',
    aggregate_select: () => db.raw('SUM(CASE WHEN nfl_plays.td = true THEN 1 ELSE 0 END) as play_td'),
    use_having: true
  },
  play_successful: {
    column_name: 'successful_play',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.successful_play as play_successful'],
    main_where: () => 'nfl_plays.successful_play',
    aggregate_select: () => db.raw('SUM(CASE WHEN nfl_plays.successful_play = true THEN 1 ELSE 0 END) as play_successful'),
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
    column_name: 'wpa',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.wpa as play_wpa'],
    main_where: () => 'nfl_plays.wpa',
    aggregate_select: () => db.raw('AVG(nfl_plays.wpa) as play_wpa'),
    use_having: true
  },
  play_ep: {
    column_name: 'ep',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.ep as play_ep'],
    main_where: () => 'nfl_plays.ep'
  },
  play_wp: {
    column_name: 'wp',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.wp as play_wp'],
    main_where: () => 'nfl_plays.wp'
  },
  play_cpoe: {
    column_name: 'cpoe',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.cpoe as play_cpoe'],
    main_where: () => 'nfl_plays.cpoe',
    aggregate_select: () => db.raw('AVG(nfl_plays.cpoe) as play_cpoe'),
    use_having: true
  },
  play_xpass_prob: {
    column_name: 'xpass_prob',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.xpass_prob as play_xpass_prob'],
    main_where: () => 'nfl_plays.xpass_prob',
    aggregate_select: () => db.raw('AVG(nfl_plays.xpass_prob) as play_xpass_prob'),
    use_having: true
  },
  play_pass_oe: {
    column_name: 'pass_oe',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.pass_oe as play_pass_oe'],
    main_where: () => 'nfl_plays.pass_oe',
    aggregate_select: () => db.raw('AVG(nfl_plays.pass_oe) as play_pass_oe'),
    use_having: true
  }
}
