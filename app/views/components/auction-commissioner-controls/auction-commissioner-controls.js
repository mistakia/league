import React from 'react'
import PropTypes from 'prop-types'
import Backdrop from '@mui/material/Backdrop'
import SpeedDial from '@mui/material/SpeedDial'
import SpeedDialIcon from '@mui/material/SpeedDialIcon'
import SpeedDialAction from '@mui/material/SpeedDialAction'
import SafetyCheckIcon from '@mui/icons-material/SafetyCheck'
import RemoveModeratorIcon from '@mui/icons-material/RemoveModerator'

import Icon from '@components/icon'

import './auction-commissioner-controls.styl'

export default class AuctionCommissionerControls extends React.Component {
  constructor(props) {
    super(props)

    this.state = { open: false }
  }

  handleOpen = () => {
    this.setState({ open: true })
  }

  handleClose = () => {
    this.setState({ open: false })
  }

  handlePause = () => {
    this.props.pause()
  }

  handleResume = () => {
    this.props.resume()
  }

  handleRewind = () => {}

  render = () => {
    const { open } = this.state
    const { isPaused, pause_on_team_disconnect } = this.props
    let action
    if (isPaused) {
      action = (
        <SpeedDialAction
          icon={<Icon name='play' />}
          tooltipTitle='Resume'
          tooltipOpen
          onClick={this.handleResume}
        />
      )
    } else {
      action = (
        <SpeedDialAction
          icon={<Icon name='pause' />}
          tooltipTitle='Pause'
          tooltipOpen
          onClick={this.handlePause}
        />
      )
    }
    return (
      <div className='auction__commissioner-controls'>
        <Backdrop open={open} />
        <SpeedDial
          ariaLabel='auction-commissioner-controls'
          icon={<SpeedDialIcon />}
          onClose={this.handleClose}
          onOpen={this.handleOpen}
          open={open}
        >
          {action}
          <SpeedDialAction
            icon={
              pause_on_team_disconnect ? (
                <RemoveModeratorIcon />
              ) : (
                <SafetyCheckIcon />
              )
            }
            tooltipTitle={
              pause_on_team_disconnect
                ? 'Disable Auto-Pause'
                : 'Enable Auto-Pause'
            }
            tooltipOpen
            onClick={this.props.toggle_pause_on_team_disconnect}
            classes={{
              staticTooltipLabel: 'tooltip-label-pause-on-disconnect'
            }}
          />
          {/* <SpeedDialAction
              icon={<Icon name='previous' />}
              tooltipTitle='Rewind'
              tooltipOpen
              onClick={this.handleRewind}
              /> */}
        </SpeedDial>
      </div>
    )
  }
}

AuctionCommissionerControls.propTypes = {
  pause: PropTypes.func,
  resume: PropTypes.func,
  isPaused: PropTypes.bool,
  toggle_pause_on_team_disconnect: PropTypes.func,
  pause_on_team_disconnect: PropTypes.bool
}
