import React from 'react'
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
  'pa',
  'py',
  'tdp',
  'ints',
  'ra',
  'ry',
  'tdr',
  'fuml',
  'trg',
  'rec',
  'recy',
  'tdrec'
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

export default class PlayerSelectedRow extends React.Component {
  render = () => {
    const {
      title,
      stats,
      action,
      className,
      games,
      lead,
      pos,
      percentiles = {},
      header,
      fixed = 0
    } = this.props
    const classNames = ['player__selected-row']
    if (className) classNames.push(className)
    if (header) classNames.push('header')
    const fields = getStatFields(pos)
    const items = []
    fields.forEach((field, index) => {
      items.push(
        <PercentileMetric
          value={stats[field]}
          percentile={percentiles[field]}
          fixed={fixed}
        />
      )
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
}

PlayerSelectedRow.propTypes = {
  title: PropTypes.node,
  stats: PropTypes.object,
  action: PropTypes.element,
  className: PropTypes.string,
  games: PropTypes.number,
  lead: PropTypes.element,
  pos: PropTypes.string,
  percentiles: PropTypes.object,
  header: PropTypes.bool,
  fixed: PropTypes.number
}
