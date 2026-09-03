import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@components/tooltip'

export default function PlayerRosterHeader(props) {
  return (
    <Tooltip title={props.tooltip} placement='bottom'>
      <span>{props.title}</span>
    </Tooltip>
  )
}

PlayerRosterHeader.propTypes = {
  tooltip: PropTypes.string,
  title: PropTypes.string
}
