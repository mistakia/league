import React from 'react'
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
const passing_rushing_stats = [
  ['pa', 'py', 'tdp', 'ints'],
  ['ra', 'ry', 'tdr', 'fuml']
]
const rushing_receiving_stats = [
  ['ra', 'ry', 'tdr', 'fuml'],
  ['trg', 'rec', 'recy', 'tdrec']
]
const receiving_rushing_stats = [
  ['trg', 'rec', 'recy', 'tdrec'],
  ['ra', 'ry', 'tdr', 'fuml']
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
