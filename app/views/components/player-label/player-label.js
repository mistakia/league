import React from 'react'
import Tooltip from '@material-ui/core/Tooltip'

import './player-label.styl'

export default function PlayerLabel ({ label, type, description }) {
  const classNames = ['player__label']
  if (type) {
    classNames.push(`player__label-${type}`)
  }

  return (
    <Tooltip title={description}>
      <div className={classNames.join(' ')}>
        {label}
      </div>
    </Tooltip>
  )
}
