import React, { useEffect } from 'react'
import PropTypes from 'prop-types'

import PercentileMetric from '@components/percentile-metric'

const defenseStats = [
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
const kickerStats = ['xpm', 'fgm', 'fg19', 'fg29', 'fg39', 'fg49', 'fg50']
const playerStats = [
  ['pa', 'py', 'tdp', 'ints'],
  ['ra', 'ry', 'tdr', 'fuml'],
  ['trg', 'rec', 'recy', 'tdrec']
]

const getStatFields = (pos) => {
  switch (pos) {
    case 'DST':
      return defenseStats
    case 'K':
      return kickerStats
    default:
      return playerStats
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
  loadPercentiles,
  percentile_key,
  percentiles = {},
  header,
  fixed = 0
}) {
  useEffect(() => {
    if (percentile_key) {
      loadPercentiles(percentile_key)
    }
  }, [])

  const classNames = ['player__selected-row']
  if (className) classNames.push(className)
  if (header) classNames.push('header')
  const fields = getStatFields(pos)
  const items = []
  fields.forEach((field, index) => {
    const is_group = Array.isArray(field)
    if (is_group) {
      const group_items = []
      for (const group_field of field) {
        group_items.push(
          <PercentileMetric
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
    <div className={classNames.join(' ')}>
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
  loadPercentiles: PropTypes.func,
  percentiles: PropTypes.object,
  percentile_key: PropTypes.string,
  header: PropTypes.bool,
  fixed: PropTypes.number
}
