import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

export default function PercentileMetric({
  percentile = {},
  value,
  children,
  className,
  scaled,
  field,
  fixed = 0,
  percentiles,
  percentile_key
}) {
  let color

  if (percentile_key) {
    percentile = percentiles.getIn([percentile_key, field], {})
  }

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

  const body = children || (value ? value.toFixed(fixed) : '-')

  const classNames = ['table__cell', 'metric']
  if (className) classNames.push(className)
  return (
    <div className={classNames.join(' ')} style={{ backgroundColor: color }}>
      {body}
    </div>
  )
}

PercentileMetric.propTypes = {
  value: PropTypes.number,
  children: PropTypes.node,
  field: PropTypes.string,
  percentile: PropTypes.object,
  percentiles: ImmutablePropTypes.map,
  percentile_key: PropTypes.string,
  className: PropTypes.string,
  scaled: PropTypes.bool,
  title: PropTypes.string,
  fixed: PropTypes.number
}
