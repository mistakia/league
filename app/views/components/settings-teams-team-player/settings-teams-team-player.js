import React from 'react'
import IconButton from '@material-ui/core/IconButton'
import DeleteIcon from '@material-ui/icons/Delete'

import PlayerName from '@components/player-name'

import './settings-teams-team-player.styl'

export default class SettingsTeamsTeamPlayer extends React.Component {
  handleRemove = () => {
    this.props.showConfirmation({
      title: 'Remove player',
      description:
        'Player will be removed from roster and any related transactions',
      onConfirm: () =>
        this.props.remove({
          player: this.props.playerId,
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
        <PlayerName playerId={this.props.playerId} />
        <div>
          <IconButton onClick={this.handleRemove}>
            <DeleteIcon fontSize='small' />
          </IconButton>
        </div>
      </div>
    )
  }
}
