import React from 'react'
import PropTypes from 'prop-types'

export default class PercentileMetric extends React.Component {
  render = () => {
    const {
      percentiles,
      type,
      stats,
      className,
      scaled,
      fixed = 1
    } = this.props
    const value = stats[type]
    const percentile = percentiles[type] || {}
    let color
    if (value && value < percentile.p25) {
      const maxPercent =
        (percentile.p25 - value) / (percentile.p25 - percentile.min) / 1.5 || 0
      color = `rgba(253, 162, 145, ${maxPercent}`
    } else if (scaled) {
      const percent =
        (value - percentile.p25) / (percentile.max - percentile.p25) || 0
      color = `rgba(46, 163, 221, ${percent}`
    } else {
      const maxPercent =
        (value - percentile.p75) / (percentile.max - percentile.p75) / 1.5 || 0
      color = `rgba(46, 163, 221, ${maxPercent}`
    }
    const classNames = ['table__cell', 'metric']
    if (className) classNames.push(className)
    return (
      <div className={classNames.join(' ')} style={{ backgroundColor: color }}>
        {value ? value.toFixed(fixed) : '-'}
      </div>
    )
  }
}

PercentileMetric.propTypes = {
  percentiles: PropTypes.object,
  className: PropTypes.string,
  type: PropTypes.string,
  stats: PropTypes.object,
  scaled: PropTypes.bool,
  title: PropTypes.string,
  fixed: PropTypes.number
}
