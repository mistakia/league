import React from 'react'
import PropTypes from 'prop-types'

import PercentileMetric from '@components/percentile-metric'

const defenseStats = (stats, percentiles = {}) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <PercentileMetric stats={stats} percentiles={percentiles} type='dpa' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dya' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dsk' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dint' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dff' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='drf' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dtno' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dfds' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dblk' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dsf' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dtpr' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='dtd' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='prtd' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='krtd' />
    </div>
  </div>
)

const kickerStats = (stats, percentiles = {}) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <PercentileMetric stats={stats} percentiles={percentiles} type='xpm' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fgm' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fg19' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fg29' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fg39' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fg49' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fg50' />
    </div>
  </div>
)

const playerStats = (stats, percentiles = {}) => [
  <div className='row__group' key={0}>
    <div className='row__group-body'>
      <PercentileMetric stats={stats} percentiles={percentiles} type='py' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='tdp' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='ints' />
    </div>
  </div>,
  <div className='row__group' key={1}>
    <div className='row__group-body'>
      <PercentileMetric stats={stats} percentiles={percentiles} type='ra' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='ry' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='tdr' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='fuml' />
    </div>
  </div>,
  <div className='row__group' key={2}>
    <div className='row__group-body'>
      <PercentileMetric stats={stats} percentiles={percentiles} type='trg' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='rec' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='recy' />
      <PercentileMetric stats={stats} percentiles={percentiles} type='tdrec' />
    </div>
  </div>
]

const getStatRows = (pos, stats, percentiles) => {
  switch (pos) {
    case 'DST':
      return defenseStats(stats, percentiles)
    case 'K':
      return kickerStats(stats, percentiles)
    default:
      return playerStats(stats, percentiles)
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
      percentiles
    } = this.props
    const classNames = ['player__selected-row']
    if (className) classNames.push(className)
    const rows = getStatRows(pos, stats, percentiles)
    return (
      <div className={classNames.join(' ')}>
        {lead || <div className='row__name'>{title}</div>}
        {games && <div className='row__single-metric'>{games}</div>}
        {rows}
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
  percentiles: PropTypes.object
}
