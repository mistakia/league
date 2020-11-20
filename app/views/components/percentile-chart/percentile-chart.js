import React from 'react'

import './percentile-chart.styl'

const toPercent = (v) => `${v * 100}%`

export default class PercentileChart extends React.Component {
  render = () => {
    // TODO - add description
    const { percentiles, type, stats, title } = this.props
    const value = stats[type]
    const percentile = percentiles[type] || {}
    const bars = []
    const norm = (value) => (value - percentile.min) / (percentile.max - percentile.min)
    const addBar = (current, index, array) => {
      const next = array[index + 1]
      let v = next ? norm(percentile[current]) : 1
      const prev = array[index - 1]
      if (prev) v = v - norm(percentile[prev])
      const classNames = ['percentile__chart-bar', current]
      bars.push(
        <div key={current} className={classNames.join(' ')} style={{ width: toPercent(v) }} />
      )
    }
    Object.keys(percentile).filter(p => p.charAt(0) === 'p').forEach(addBar)
    const w = norm(value)
    bars.push(
      <div
        key='player'
        className='percentile__chart-player-bar'
        style={{ width: toPercent(w) }}
      />
    )
    return (
      <div className='percentile__chart'>
        <div className='percentile__chart-title'>{title}</div>
        <div className='percentile__chart-value metric'>{value ? value.toFixed(1) : '-'}</div>
        <div className='percentile__chart-bars'>
          {bars}
        </div>
      </div>
    )
  }
}
