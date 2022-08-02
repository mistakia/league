import React from 'react'
import PropTypes from 'prop-types'

import PercentileMetric from '@components/percentile-metric'

const defenseStats = (stats, percentiles = {}, fixed = 0) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dpa' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dya' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dsk' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dint' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dff' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='drf' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dtno' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dfds' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dblk' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dsf' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dtpr' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='dtd' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='prtd' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='krtd' />
    </div>
  </div>
)

const kickerStats = (stats, percentiles = {}, fixed = 0) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <PercentileMetric {...{ stats, percentiles, fixed }} type='xpm' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fgm' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fg19' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fg29' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fg39' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fg49' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fg50' />
    </div>
  </div>
)

const playerStats = (stats, percentiles = {}, fixed = 0) => [
  <div className='row__group' key={0}>
    <div className='row__group-body'>
      <PercentileMetric {...{ stats, percentiles, fixed }} type='py' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='tdp' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='ints' />
    </div>
  </div>,
  <div className='row__group' key={1}>
    <div className='row__group-body'>
      <PercentileMetric {...{ stats, percentiles, fixed }} type='ra' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='ry' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='tdr' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='fuml' />
    </div>
  </div>,
  <div className='row__group' key={2}>
    <div className='row__group-body'>
      <PercentileMetric {...{ stats, percentiles, fixed }} type='trg' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='rec' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='recy' />
      <PercentileMetric {...{ stats, percentiles, fixed }} type='tdrec' />
    </div>
  </div>
]

const getStatRows = (pos, stats, percentiles, fixed) => {
  switch (pos) {
    case 'DST':
      return defenseStats(stats, percentiles, fixed)
    case 'K':
      return kickerStats(stats, percentiles, fixed)
    default:
      return playerStats(stats, percentiles, fixed)
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
      percentiles,
      header,
      fixed
    } = this.props
    const classNames = ['player__selected-row']
    if (className) classNames.push(className)
    if (header) classNames.push('header')
    const rows = getStatRows(pos, stats, percentiles, fixed)
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
  percentiles: PropTypes.object,
  header: PropTypes.bool,
  fixed: PropTypes.number
}
