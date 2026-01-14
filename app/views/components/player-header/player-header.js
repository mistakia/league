import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@mui/material/Tooltip'

import Icon from '@components/icon'

import './player-header.styl'

export default function PlayerHeader({
  toggle_players_page_order,
  value,
  label,
  className,
  order,
  orderBy,
  description
}) {
  const handleClick = () => {
    toggle_players_page_order(value)
  }

  const isSelected = orderBy === value
  const classNames = ['player__header']
  if (className) classNames.push(className)
  if (isSelected) {
    classNames.push('selected')
    classNames.push(order)
  }

  const header_content = (
    <div className={classNames.join(' ')} onClick={handleClick}>
      <Icon name='down' />
      {label}
    </div>
  )

  if (description) {
    return (
      <Tooltip title={description} placement='bottom'>
        {header_content}
      </Tooltip>
    )
  }

  return header_content
}

PlayerHeader.propTypes = {
  toggle_players_page_order: PropTypes.func,
  value: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
  order: PropTypes.string,
  orderBy: PropTypes.string,
  description: PropTypes.string
}
