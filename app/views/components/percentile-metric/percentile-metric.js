import React from 'react'

export default class PercentileMetric extends React.Component {
  render = () => {
    const { percentiles, type, stats, className } = this.props
    const value = stats[type]
    const percentile = percentiles[type] || {}
    let color
    if (value < percentile.p25) {
      const maxPercent = ((percentile.p25 - value) / (percentile.p25 - percentile.min) / 1.5)
      color = `rgba(255, 126, 119, ${maxPercent}`
    } else {
      const maxPercent = ((value - percentile.p75) / (percentile.max - percentile.p75) / 1.5)
      color = `rgba(46, 163, 221, ${maxPercent}`
    }
    const classNames = ['table__cell', 'metric']
    if (className) classNames.push(className)
    return (
      <div className={classNames.join(' ')} style={{ backgroundColor: color }}>
        {value ? value.toFixed(1) : '-'}
      </div>
    )
  }
}
