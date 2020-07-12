import React from 'react'

import './player-row-metric.styl'

export default class PlayerRowMetric extends React.Component {
  render = () => {
    const { overall, type, stats, className } = this.props
    const value = stats[type]
    const metrics = overall[type] || {}
    const maxPercent = ((value - metrics.p75) / (metrics.max - metrics.p75) / 1.5)
    const color = `rgba(46, 163, 221, ${maxPercent}`
    const classNames = ['player__row-metric']
    if (className) classNames.push(className)
    return (
      <div className={classNames.join(' ')} style={{ backgroundColor: color }}>
        {value}
      </div>
    )
  }
}
