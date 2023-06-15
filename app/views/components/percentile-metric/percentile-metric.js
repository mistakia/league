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
  percentile_key,
  show_positivity,
  prefix = ''
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

  const formatValue = (value) => {
    if (!value) {
      return '-'
    }

    const is_negative = value < 0
    const sign_str = is_negative ? '-' : show_positivity ? '+' : ''
    const val = value.toFixed(fixed)
    const abs_value = Math.abs(val)

    return `${sign_str}${prefix}${abs_value}`
  }

  const body = children || formatValue(value)

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
  show_positivity: PropTypes.bool,
  className: PropTypes.string,
  scaled: PropTypes.bool,
  fixed: PropTypes.number,
  prefix: PropTypes.string
}
