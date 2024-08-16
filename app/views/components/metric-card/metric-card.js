import React from 'react'
import PropTypes from 'prop-types'

import { nth } from '@libs-shared'

import './metric-card.styl'

export default function MetricCard({ label, value, rank }) {
  const is_top = rank && rank <= 3
  const is_bottom = rank && rank >= 8
  const classNames = ['metric-card']
  if (is_top) classNames.push('top')
  if (is_bottom) classNames.push('bottom')

  return (
    <div className={classNames.join(' ')}>
      <label>{label}</label>
      <div className='metric-card__value'>{value}</div>
      {rank && <div className='metric-card__rank'>{`${rank}${nth(rank)}`}</div>}
    </div>
  )
}

MetricCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  rank: PropTypes.number
}
