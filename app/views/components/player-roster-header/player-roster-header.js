import React from 'react'
import Tooltip from '@material-ui/core/Tooltip'

export default function PlayerRosterHeader (props) {
  return (
    <Tooltip title={props.tooltip} placement='bottom'>
      <div className='metric'>{props.title}</div>
    </Tooltip>
  )
}
