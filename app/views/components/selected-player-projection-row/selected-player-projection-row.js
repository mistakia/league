import React from 'react'
import PropTypes from 'prop-types'

import PercentileMetric from '@components/percentile-metric'

const defense_stats = [
  'defensive_points_against',
  'defensive_yards_against',
  'defensive_sacks',
  'defensive_interceptions',
  'defensive_forced_fumbles',
  'defensive_recovered_fumbles',
  'defensive_three_and_outs',
  'defensive_fourth_down_stops',
  'defensive_blocked_kicks',
  'defensive_safeties',
  'defensive_two_point_returns',
  'defensive_touchdowns',
  'punt_return_touchdowns',
  'kickoff_return_touchdowns'
]
const kicker_stats = [
  'extra_points_made',
  'field_goals_made',
  'field_goals_made_0_19_yards',
  'field_goals_made_20_29_yards',
  'field_goals_made_30_39_yards',
  'field_goals_made_40_49_yards',
  'field_goals_made_50_plus_yards'
]
const passing_rushing_stats = [
  [
    'passing_attempts',
    'passing_yards',
    'passing_touchdowns',
    'passing_interceptions'
  ],
  ['rushing_attempts', 'rushing_yards', 'rushing_touchdowns', 'fumbles_lost']
]
const rushing_receiving_stats = [
  ['rushing_attempts', 'rushing_yards', 'rushing_touchdowns', 'fumbles_lost'],
  ['targets', 'receptions', 'receiving_yards', 'receiving_touchdowns']
]
const receiving_rushing_stats = [
  ['targets', 'receptions', 'receiving_yards', 'receiving_touchdowns'],
  ['rushing_attempts', 'rushing_yards', 'rushing_touchdowns', 'fumbles_lost']
]

const get_stat_fields = (pos) => {
  switch (pos) {
    case 'DST':
      return defense_stats
    case 'K':
      return kicker_stats
    case 'QB':
      return passing_rushing_stats
    case 'RB':
      return rushing_receiving_stats
    case 'WR':
    case 'TE':
      return receiving_rushing_stats
    default:
      return []
  }
}

export default function PlayerSelectedProjectionRow({
  title,
  stats,
  action,
  className,
  games,
  lead,
  pos,
  header,
  fixed = 0
}) {
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
            value={stats[group_field]}
            fixed={fixed}
            field={group_field}
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
          value={stats[field]}
          fixed={fixed}
          field={field}
        />
      )
    }
  })

  return (
    <div className={class_names.join(' ')}>
      {lead || <div className='table__cell text'>{title}</div>}
      {games && <div className='table__cell metric'>{games}</div>}
      {items}
      {action}
    </div>
  )
}

PlayerSelectedProjectionRow.propTypes = {
  title: PropTypes.node,
  stats: PropTypes.object,
  action: PropTypes.element,
  className: PropTypes.string,
  games: PropTypes.number,
  lead: PropTypes.element,
  pos: PropTypes.string,
  header: PropTypes.bool,
  fixed: PropTypes.number
}
