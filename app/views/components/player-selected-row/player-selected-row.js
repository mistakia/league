import React, { useEffect } from 'react'
import PropTypes from 'prop-types'

import PercentileMetric from '@components/percentile-metric'

// Stat field groupings by category
const FANTASY_STATS = [
  'points',
  'points_pos_rnk',
  'points_per_game',
  'points_per_game_pos_rnk',
  'points_added',
  'points_added_rnk',
  'points_added_pos_rnk',
  'points_added_per_game',
  'points_added_per_game_rnk',
  'points_added_per_game_pos_rnk'
]

const DEFENSE_STATS = [
  'dpa',
  'dya',
  'dsk',
  'dint',
  'dff',
  'drf',
  'dtno',
  'dfds',
  'dblk',
  'dsf',
  'dtpr',
  'dtd',
  'prtd',
  'krtd'
]

const KICKER_STATS = ['xpm', 'fgm', 'fg19', 'fg29', 'fg39', 'fg49', 'fg50']

const PASSING_PRODUCTION = [
  'pa',
  'py',
  'tdp',
  'ints',
  'dropbacks',
  'pass_completed_air_yards',
  'pass_yards_after_catch'
]

const PASSING_EFFICIENCY = [
  'pass_rating',
  'pass_yards_per_attempt',
  'pass_comp_pct',
  'expected_pass_comp',
  'cpoe',
  'pass_epa_per_db'
]

const PASSING_USAGE = [
  'avg_time_to_throw',
  'avg_time_to_pressure',
  'avg_time_to_sack',
  'pressures_against',
  'pressure_rate_against',
  'blitz_rate',
  'pass_drops',
  'drop_rate',
  'air_yards_per_pass_att',
  'avg_target_separation',
  'deep_pass_att_pct',
  'tight_window_pct',
  'play_action_pct'
]

const RUSHING_PRODUCTION = ['ra', 'ry', 'tdr', 'fuml', 'rush_epa']

const RUSHING_OPPORTUNITIES = [
  'expected_rush_yards',
  'rush_share',
  'weighted_opportunity'
]

const RUSHING_EFFICIENCY = [
  'rush_yards_over_expected',
  'rush_yards_over_expected_per_attempt',
  'rush_yards_after_contact_per_attempt',
  'rush_success_rate',
  'rush_yards_per_attempt'
]

const RUSHING_EXPLOSIVENESS = [
  'longest_rush',
  'rush_attempts_yards_10_plus',
  'rush_attempts_speed_15_plus_mph',
  'rush_attempts_speed_20_plus_mph'
]

const RUSHING_REDZONE = ['rush_attempts_redzone', 'rush_attempts_goaline']

const RECEIVING_PRODUCTION = ['trg', 'rec', 'recy', 'tdrec', 'recv_epa']

const RECEIVING_EFFICIENCY = [
  'receiving_passer_rating',
  'catch_rate',
  'expected_catch_rate',
  'catch_rate_over_expected',
  'recv_yards_per_reception',
  'recv_yards_per_route',
  'recv_epa_per_target',
  'recv_epa_per_route',
  'recv_yards_after_catch_over_expected'
]

const RECEIVING_EXPLOSIVENESS = [
  'longest_reception',
  'recv_yards_15_plus_count'
]

const RECEIVING_OPPORTUNITIES = [
  'routes',
  'route_share',
  'team_target_share',
  'team_air_yard_share',
  'weighted_opportunity_rating'
]

const RECEIVING_USAGE = [
  'recv_air_yards',
  'recv_air_yards_per_target',
  'avg_route_depth',
  'recv_deep_target_pct',
  'recv_tight_window_pct'
]

const RECEIVING_REDZONE = ['redzone_targets', 'endzone_targets']

// Field configuration
const POSITION_RANK_FIELDS = [
  'points_pos_rnk',
  'points_per_game_pos_rnk',
  'points_added_pos_rnk',
  'points_added_per_game_pos_rnk'
]

const PERCENTAGE_FIELDS = [
  'expected_catch_rate',
  'catch_rate',
  'rush_share',
  'rush_success_rate',
  'team_target_share',
  'team_air_yard_share',
  'catch_rate_over_expected',
  'pass_comp_pct',
  'expected_pass_comp',
  'cpoe',
  'pressure_rate_against',
  'blitz_rate',
  'drop_rate',
  'pass_yards_after_catch_pct',
  'deep_pass_att_pct',
  'tight_window_pct',
  'play_action_pct',
  'recv_deep_target_pct',
  'recv_tight_window_pct'
]

const FIELD_FIXED_VALUES = {
  points: 1,
  points_per_game: 1,
  points_added: 1,
  points_added_per_game: 1,
  pass_epa_per_db: 2,
  pass_rating: 1,
  pass_yards_per_attempt: 1,
  cpoe: 1,
  avg_time_to_throw: 2,
  avg_time_to_pressure: 2,
  avg_time_to_sack: 2,
  air_yards_per_pass_att: 1,
  avg_target_separation: 1,
  rush_epa: 1,
  rush_yards_over_expected: 1,
  rush_yards_over_expected_per_attempt: 2,
  rush_yards_after_contact_per_attempt: 2,
  rush_success_rate: 3,
  rush_yards_per_attempt: 1,
  recv_epa: 1,
  wopr: 2,
  catch_rate: 2,
  expected_catch_rate: 2,
  catch_rate_over_expected: 2,
  recv_yards_per_reception: 2,
  recv_yards_per_route: 2,
  recv_epa_per_target: 2,
  recv_epa_per_route: 2,
  recv_yards_after_catch_over_expected: 2,
  weighted_opportunity_rating: 2,
  recv_deep_target_pct: 2,
  recv_tight_window_pct: 2
}

// Position-based stat field configuration
const get_stat_fields = (pos) => {
  const position_configs = {
    DST: [FANTASY_STATS, DEFENSE_STATS],
    K: [FANTASY_STATS, KICKER_STATS],
    QB: [
      FANTASY_STATS,
      PASSING_PRODUCTION,
      PASSING_EFFICIENCY,
      PASSING_USAGE,
      RUSHING_PRODUCTION,
      RUSHING_EFFICIENCY,
      RUSHING_EXPLOSIVENESS,
      RUSHING_REDZONE
    ],
    RB: [
      FANTASY_STATS,
      RUSHING_PRODUCTION,
      RUSHING_OPPORTUNITIES,
      RUSHING_EFFICIENCY,
      RUSHING_EXPLOSIVENESS,
      RUSHING_REDZONE,
      RECEIVING_PRODUCTION,
      RECEIVING_OPPORTUNITIES,
      RECEIVING_EFFICIENCY,
      RECEIVING_EXPLOSIVENESS,
      RECEIVING_REDZONE
    ],
    WR: [
      FANTASY_STATS,
      RECEIVING_PRODUCTION,
      RECEIVING_OPPORTUNITIES,
      RECEIVING_EFFICIENCY,
      RECEIVING_EXPLOSIVENESS,
      RECEIVING_USAGE,
      RECEIVING_REDZONE
    ],
    TE: [
      FANTASY_STATS,
      RECEIVING_PRODUCTION,
      RECEIVING_OPPORTUNITIES,
      RECEIVING_EFFICIENCY,
      RECEIVING_EXPLOSIVENESS,
      RECEIVING_USAGE,
      RECEIVING_REDZONE
    ]
  }

  return position_configs[pos] || []
}

const get_snaps_fields = (pos) => {
  const snaps_configs = {
    DST: ['snaps_def', 'snaps_st'],
    K: ['snaps_def', 'snaps_st'],
    QB: ['snaps_off', 'snaps_pass', 'snaps_rush'],
    RB: ['snaps_off', 'snaps_pass', 'snaps_rush', 'snaps_st'],
    WR: ['snaps_off', 'snaps_pass', 'snaps_rush', 'snaps_st'],
    TE: ['snaps_off', 'snaps_pass', 'snaps_rush', 'snaps_st']
  }

  return snaps_configs[pos] || []
}

// Helper function to build CSS class names
const build_class_names = (base_class, additional_classes = []) => {
  const classes = [base_class, ...additional_classes.filter(Boolean)]
  return classes.join(' ')
}

// Render a single metric field
const render_metric = ({
  field,
  value,
  pos,
  percentile_key,
  percentiles,
  fixed,
  stats
}) => {
  const is_pos_rank = POSITION_RANK_FIELDS.includes(field)

  if (is_pos_rank) {
    const display_value = value != null ? `${pos}${value}` : '-'
    return (
      <PercentileMetric
        key={field}
        percentile_key={percentile_key}
        value={value}
        percentile={percentiles[field]}
        field={field}
      >
        {display_value}
      </PercentileMetric>
    )
  }

  const fixed_value =
    FIELD_FIXED_VALUES[field] !== undefined ? FIELD_FIXED_VALUES[field] : fixed
  const is_percentage = PERCENTAGE_FIELDS.includes(field)

  return (
    <PercentileMetric
      key={field}
      percentile_key={percentile_key}
      value={value}
      percentile={percentiles[field]}
      fixed={fixed_value}
      field={field}
      is_percentage={is_percentage}
    />
  )
}

// Render a group of stat fields
const render_stat_group = (group_fields, group_index, render_params) => {
  const group_items = group_fields.map((field) =>
    render_metric({
      ...render_params,
      field,
      value: render_params.stats[field]
    })
  )

  return (
    <div className='row__group' key={group_index}>
      <div className='row__group-body'>{group_items}</div>
    </div>
  )
}

// Render all stat fields for a position
const render_stat_fields = (fields, render_params) => {
  return fields.map((field, index) => {
    const is_group = Array.isArray(field)

    if (is_group) {
      return render_stat_group(field, index, render_params)
    }

    return render_metric({
      ...render_params,
      field,
      value: render_params.stats[field]
    })
  })
}

// Render snaps fields
const render_snaps_fields = (snaps_fields, stats) => {
  return snaps_fields.map((field) => (
    <div key={field} className='table__cell metric'>
      {stats[field]}
    </div>
  ))
}

export default function PlayerSelectedRow({
  title,
  stats,
  action,
  className,
  games,
  lead,
  pos,
  load_percentiles,
  percentile_key,
  percentiles = {},
  header,
  fixed = 0,
  snaps
}) {
  useEffect(() => {
    if (percentile_key && load_percentiles) {
      load_percentiles(percentile_key)
    }
  }, [percentile_key, load_percentiles])

  const class_names = build_class_names('player__selected-row', [
    className,
    header && 'header'
  ])

  const stat_fields = get_stat_fields(pos)
  const render_params = {
    pos,
    percentile_key,
    percentiles,
    fixed,
    stats
  }

  const stat_items = render_stat_fields(stat_fields, render_params)

  const snaps_fields = snaps ? get_snaps_fields(pos) : []
  const snaps_items =
    snaps && snaps_fields.length > 0
      ? render_snaps_fields(snaps_fields, stats)
      : null

  return (
    <div className={class_names}>
      {lead || <div className='table__cell text'>{title}</div>}
      {games != null && <div className='table__cell metric'>{games}</div>}
      {stat_items}
      {snaps_items && (
        <div className='row__group'>
          <div className='row__group-body'>{snaps_items}</div>
        </div>
      )}
      {action}
    </div>
  )
}

PlayerSelectedRow.propTypes = {
  title: PropTypes.node,
  stats: PropTypes.object,
  action: PropTypes.element,
  className: PropTypes.string,
  games: PropTypes.number,
  lead: PropTypes.element,
  pos: PropTypes.string,
  load_percentiles: PropTypes.func,
  percentiles: PropTypes.object,
  percentile_key: PropTypes.string,
  header: PropTypes.bool,
  fixed: PropTypes.number,
  snaps: PropTypes.bool
}
