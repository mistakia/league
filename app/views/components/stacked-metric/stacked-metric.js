import React from 'react'
import PropTypes from 'prop-types'

import './stacked-metric.styl'

const calculate_color = ({ value, percentile, invert_order = false }) => {
  if (!percentile || value === null || value === undefined) {
    return undefined
  }

  const blue_color = 'rgba(46, 163, 221,'
  const red_color = 'rgba(253, 162, 145,'

  if (value < percentile.p25) {
    const max_percent =
      (percentile.p25 - value) / (percentile.p25 - percentile.min) / 1.5 || 0
    return invert_order
      ? `${blue_color}${max_percent})`
      : `${red_color}${max_percent})`
  } else {
    const percent =
      (value - percentile.p25) / (percentile.max - percentile.p25) || 0
    return invert_order ? `${red_color}${percent})` : `${blue_color}${percent})`
  }
}

// Calculate color based on position rank when percentile data isn't available
// Assumes ~32 relevant players per position for fantasy purposes
const calculate_rank_color = ({ position_rank, position }) => {
  if (!position_rank || !position) {
    return undefined
  }

  // Approximate number of fantasy-relevant players by position
  const position_depths = {
    QB: 32,
    RB: 50,
    WR: 60,
    TE: 32,
    K: 32,
    DST: 32
  }

  const depth = position_depths[position] || 40
  const rank = Number(position_rank)
  if (isNaN(rank) || rank <= 0) return undefined

  // Calculate percentile (1 = best, depth = worst)
  const percentile = 1 - (rank - 1) / depth

  const blue_color = 'rgba(46, 163, 221,'
  const red_color = 'rgba(253, 162, 145,'

  if (percentile >= 0.5) {
    // Top half - blue shading
    const intensity = (percentile - 0.5) * 1.2
    return `${blue_color}${Math.min(intensity, 0.6)})`
  } else {
    // Bottom half - red shading
    const intensity = (0.5 - percentile) * 1.2
    return `${red_color}${Math.min(intensity, 0.6)})`
  }
}

const format_value = ({ value, fixed = 1 }) => {
  if (value === null || value === undefined) {
    return '-'
  }

  const numeric_value = Number(value)
  if (isNaN(numeric_value)) {
    return '-'
  }

  return numeric_value.toFixed(fixed)
}

export default function StackedMetric({
  value,
  position_rank,
  position,
  percentile,
  fixed = 1,
  className,
  use_rank_color = false
}) {
  // Use percentile-based color if available, otherwise fall back to rank-based color
  const background_color =
    calculate_color({ value, percentile }) ||
    (use_rank_color
      ? calculate_rank_color({ position_rank, position })
      : undefined)

  const formatted_value = format_value({ value, fixed })

  // Show position rank only (e.g., "QB12") - simpler and more relevant for fantasy
  const has_position_rank =
    position_rank !== null && position_rank !== undefined && position

  let ranks_text = null
  if (has_position_rank) {
    ranks_text = `${position}${position_rank}`
  }

  const classNames = ['stacked-metric', 'table__cell', 'metric']
  if (className) classNames.push(className)

  return (
    <div
      className={classNames.join(' ')}
      style={{ backgroundColor: background_color }}
    >
      <div className='stacked-metric__value'>{formatted_value}</div>
      {ranks_text && <div className='stacked-metric__ranks'>{ranks_text}</div>}
    </div>
  )
}

StackedMetric.propTypes = {
  value: PropTypes.number,
  position_rank: PropTypes.number,
  position: PropTypes.string,
  percentile: PropTypes.object,
  fixed: PropTypes.number,
  className: PropTypes.string,
  use_rank_color: PropTypes.bool
}
