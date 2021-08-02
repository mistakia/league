import React from 'react'
import PropTypes from 'prop-types'

import './percentile-chart.styl'

const toPercent = (v) => `${v * 100}%`

export default class PercentileChart extends React.Component {
  render = () => {
    // TODO - add description
    const { percentiles, type, stats, title } = this.props
    const value = stats[type]
    const percentile = percentiles[type] || {}
    const norm = (value) =>
      (value - percentile.min) / (percentile.max - percentile.min)
    const w = norm(value)
    const color = (value) => {
      if (value <= percentile.p25) {
        return 'rgba(255,0,0,0.8)'
      } else if (value <= percentile.p50) {
        return 'rgba(255,0,0,0.4)'
      } else if (value >= percentile.p99) {
        return 'rgba(29,165,97,1)'
      } else if (value >= percentile.p98) {
        return 'rgba(29,165,97,0.9)'
      } else if (value >= percentile.p95) {
        return 'rgba(29,165,97,0.7)'
      } else if (value >= percentile.p90) {
        return 'rgba(29,165,97,0.5)'
      } else {
        return 'rgba(150,150,150,1)'
      }
    }
    return (
      <div className='percentile__chart'>
        <div className='percentile__chart-title'>{title}</div>
        <div className='percentile__chart-value metric'>
          {value ? value.toFixed(1) : '-'}
        </div>
        <div className='percentile__chart-bars'>
          <div
            className='percentile__chart-player-bar'
            style={{ width: toPercent(w), backgroundColor: color(value) }}
          />
        </div>
      </div>
    )
  }
}

PercentileChart.propTypes = {
  percentiles: PropTypes.object,
  type: PropTypes.string,
  stats: PropTypes.object,
  title: PropTypes.string
}
