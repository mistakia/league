import React from 'react'

import Icon from '@components/icon'
import SelectedPlayerSeasonStats from '@components/selected-player-season-stats'
import SelectedPlayerSeasonProjections from '@components/selected-player-season-projections'
import SelectedPlayerTeamStats from '@components/selected-player-team-stats'
import SelectedPlayerTeamSituationSplits from '@components/selected-player-team-situation-splits'
import SelectedPlayerTeamPositionSplits from '@components/selected-player-team-position-splits'
import SelectedPlayerEfficiencyStats from '@components/selected-player-efficiency-stats'

import './selected-player.styl'

export default class SelectedPlayer extends React.Component {
  handleDeselectClick = () => {
    this.props.deselect()
  }

  render = () => {
    const { player } = this.props

    if (!player.player) return null

    return (
      <div className='selected__player'>
        <div className='selected__player-action' onClick={this.handleDeselectClick}>
          <Icon name='clear' />
        </div>
        <div className='selected__player-body'>
          <SelectedPlayerSeasonProjections />
          <SelectedPlayerSeasonStats />
          <SelectedPlayerEfficiencyStats />
          <SelectedPlayerTeamStats />
          <SelectedPlayerTeamSituationSplits />
          <SelectedPlayerTeamPositionSplits />
        </div>
      </div>
    )
  }
}
