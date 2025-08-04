import React from 'react'
import PropTypes from 'prop-types'

import CircularProgress from '@mui/material/CircularProgress'

import './button.styl'

function Button({
  children,
  className,
  label,
  onClick,
  count,
  type = 'button',
  disabled = false,
  isLoading,
  is_active,
  small,
  text
}) {
  const classNames = ['button', className]
  const haveCount = typeof count === 'number'

  if (isLoading) disabled = true
  if (small) classNames.push('button__small')
  if (text) classNames.push('button__text')
  if (haveCount) classNames.push('button__count')
  if (is_active) classNames.push('button__active')

  return (
    <button
      aria-label={label}
      className={classNames.join(' ')}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {isLoading ? <CircularProgress /> : children}
      {haveCount && <span className='count'>{count}</span>}
    </button>
  )
}

Button.propTypes = {
  count: PropTypes.number,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  is_active: PropTypes.bool,
  small: PropTypes.bool,
  text: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
  label: PropTypes.string,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'reset', 'submit'])
}

export default Button
