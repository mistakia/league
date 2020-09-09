import React from 'react'

import { constants } from '@common'
import { Player, connect } from '@components/player'
import PlayerNameExpanded from '@components/player-name-expanded'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { player } = this.props

    return (
      <div className='scoreboard__player'>
        <div className='scoreboard__player-body'>
          <PlayerNameExpanded playerId={player.player} hideActions />
          <div className='scoreboard__player-game-info' />
          <div className='scoreboard__player-game-stats' />
          <div className='scoreboard__player-drive-info' />
        </div>
        <div className='scoreboard__player-score metric projection'>
          {player.getIn(['points', `${constants.season.week}`, 'total'], 0).toFixed(1)}
        </div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
