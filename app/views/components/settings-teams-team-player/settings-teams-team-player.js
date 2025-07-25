import React from 'react'
import PropTypes from 'prop-types'
import IconButton from '@mui/material/IconButton'
import DeleteIcon from '@mui/icons-material/Delete'

import PlayerName from '@components/player-name'

import './settings-teams-team-player.styl'

export default class SettingsTeamsTeamPlayer extends React.Component {
  handleRemove = () => {
    this.props.showConfirmation({
      title: 'Remove player',
      description:
        'Player will be removed from roster and any related transactions',
      on_confirm_func: () =>
        this.props.remove({
          pid: this.props.pid,
          teamId: this.props.teamId
        })
    })
  }

  render = () => {
    // TODO edit value
    return (
      <div className='settings__teams-team-player'>
        <div className='settings__teams-team-player-value'>
          ${this.props.value}
        </div>
        <PlayerName pid={this.props.pid} />
        <div>
          <IconButton onClick={this.handleRemove}>
            <DeleteIcon fontSize='small' />
          </IconButton>
        </div>
      </div>
    )
  }
}

SettingsTeamsTeamPlayer.propTypes = {
  remove: PropTypes.func,
  showConfirmation: PropTypes.func,
  pid: PropTypes.string,
  teamId: PropTypes.number,
  value: PropTypes.number
}
