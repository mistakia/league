import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@mui/material/Tooltip'

import './player-label.styl'

export default function PlayerLabel({ label, type, description }) {
  const classNames = ['player__label']
  if (type) {
    classNames.push(`player__label-${type}`)
  }

  return (
    <Tooltip title={description}>
      <div className={classNames.join(' ')}>{label}</div>
    </Tooltip>
  )
}

PlayerLabel.propTypes = {
  label: PropTypes.node,
  type: PropTypes.string,
  description: PropTypes.string
}
