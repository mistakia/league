import React from 'react'

import './player-row-metric.styl'

export default class PlayerRowMetric extends React.Component {
  render = () => {
    const { overall, type, value } = this.props
    const metrics = overall[type]
    const maxPercent = ((value - metrics.p75) / (metrics.max - metrics.p75) / 1.5)
    const color = `rgba(46, 163, 221, ${maxPercent}`
    return (
      <div className='player__row-metric' style={{ backgroundColor: color }}>
        {value}
      </div>
    )
  }
}
