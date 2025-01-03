import React, { useEffect } from 'react'
import PropTypes from 'prop-types'

import PercentileMetric from '@components/percentile-metric'

const defense_stats = [
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
const kicker_stats = ['xpm', 'fgm', 'fg19', 'fg29', 'fg39', 'fg49', 'fg50']
const passing_production = [
  'pa',
  'py',
  'tdp',
  'ints',
  'dropbacks',
  'pass_completed_air_yards',
  'pass_yards_after_catch'
]
const passing_efficiency = [
  'pass_rating',
  'pass_yards_per_attempt',
  'pass_comp_pct',
  'expected_pass_comp',
  'cpoe',
  'pass_epa_per_db'
]
const passing_usage = [
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
const rushing_production = ['ra', 'ry', 'tdr', 'fuml', 'rush_epa']
const rushing_opportunities = [
  'expected_rush_yards',
  'rush_share',
  'weighted_opportunity'
]
const rushing_efficiency = [
  'rush_yards_over_expected',
  'rush_yards_over_expected_per_attempt',
  'rush_yards_after_contact_per_attempt',
  'rush_success_rate',
  'rush_yards_per_attempt'
]
const rushing_explosiveness = [
  'longest_rush',
  'rush_attempts_yards_10_plus',
  'rush_attempts_speed_15_plus_mph',
  'rush_attempts_speed_20_plus_mph'
]
const rushing_redzone = ['rush_attempts_redzone', 'rush_attempts_goaline']
const receiving_production = ['trg', 'rec', 'recy', 'tdrec', 'recv_epa']
const receiving_efficiency = [
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
const receiving_explosiveness = [
  'longest_reception',
  'recv_yards_15_plus_count'
]
const receiving_opportunities = [
  'routes',
  'route_share',
  'team_target_share',
  'team_air_yard_share',
  'weighted_opportunity_rating'
]
const receiving_usage = [
  'recv_air_yards',
  'recv_air_yards_per_target',
  'avg_route_depth',
  'recv_deep_target_pct',
  'recv_tight_window_pct'
]
const receiving_redzone = ['redzone_targets', 'endzone_targets']

const percentage_fields = [
  'expected_catch_rate',
  'catch_rate',
  'rush_share',
  'rush_success_rate',
  'team_target_share',
  'team_air_yard_share'
]

const get_stat_fields = (pos) => {
  switch (pos) {
    case 'DST':
      return defense_stats
    case 'K':
      return kicker_stats
    case 'QB':
      return [
        passing_production,
        passing_efficiency,
        passing_usage,
        rushing_production,
        rushing_efficiency,
        rushing_explosiveness,
        rushing_redzone
      ]
    case 'RB':
      return [
        rushing_production,
        rushing_opportunities,
        rushing_efficiency,
        rushing_explosiveness,
        rushing_redzone,
        receiving_production,
        receiving_opportunities,
        receiving_efficiency,
        receiving_explosiveness,
        receiving_redzone
      ]
    case 'WR':
    case 'TE':
      return [
        receiving_production,
        receiving_opportunities,
        receiving_efficiency,
        receiving_explosiveness,
        receiving_usage,
        receiving_redzone
      ]
    default:
      return []
  }
}

const get_snaps_fields = (pos) => {
  switch (pos) {
    case 'DST':
    case 'K':
      return ['snaps_def', 'snaps_st']
    case 'QB':
      return ['snaps_off', 'snaps_pass', 'snaps_rush']
    case 'RB':
    case 'WR':
    case 'TE':
      return ['snaps_off', 'snaps_pass', 'snaps_rush', 'snaps_st']
    default:
      return []
  }
}

const field_fixed_values = {
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
    if (percentile_key) {
      load_percentiles(percentile_key)
    }
  }, [percentile_key, load_percentiles])

  const class_names = ['player__selected-row']
  if (className) class_names.push(className)
  if (header) class_names.push('header')
  const fields = get_stat_fields(pos)
  const items = []

  fields.forEach((field, index) => {
    const is_group = Array.isArray(field)
    if (is_group) {
      const group_items = []
      for (const group_field of field) {
        group_items.push(
          <PercentileMetric
            key={group_field}
            percentile_key={percentile_key}
            value={stats[group_field]}
            percentile={percentiles[group_field]}
            fixed={
              field_fixed_values[group_field] !== undefined
                ? field_fixed_values[group_field]
                : fixed
            }
            field={group_field}
            is_percentage={percentage_fields.includes(group_field)}
          />
        )
      }

      items.push(
        <div className='row__group' key={index}>
          <div className='row__group-body'>{group_items}</div>
        </div>
      )
    } else {
      items.push(
        <PercentileMetric
          key={field}
          percentile_key={percentile_key}
          value={stats[field]}
          percentile={percentiles[field]}
          fixed={
            field_fixed_values[field] !== undefined
              ? field_fixed_values[field]
              : fixed
          }
          field={field}
          is_percentage={percentage_fields.includes(field)}
        />
      )
    }
  })

  const snaps_items = []
  if (snaps) {
    const snaps_fields = get_snaps_fields(pos)
    snaps_fields.forEach((field) => {
      snaps_items.push(
        <div key={field} className='table__cell metric'>
          {stats[field]}
        </div>
      )
    })
  }

  return (
    <div className={class_names.join(' ')}>
      {lead || <div className='table__cell text'>{title}</div>}
      {games && <div className='table__cell metric'>{games}</div>}
      {items}
      {snaps && (
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
