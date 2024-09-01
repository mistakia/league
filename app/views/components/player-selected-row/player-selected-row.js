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
  fixed = 0
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
          percentile_key={percentile_key}
          value={stats[field]}
          percentile={percentiles[field]}
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
  fixed: PropTypes.number
}
