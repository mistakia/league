import React from 'react'

import { constants } from '@common'
import { Player, connect } from '@components/player'
import PlayerName from '@components/player-name'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { player, slot } = this.props
    return (
      <div className='scoreboard__player'>
        <div className='scoreboard__player-slot'>{constants.slotName[slot]}</div>
        <div className='scoreboard__player-body'>
          <PlayerName playerId={player.player} />
          <div className='scoreboard__player-game-info' />
          <div className='scoreboard__player-game-stats' />
          <div className='scoreboard__player-drive-info' />
        </div>
        <div className='scoreboard__player-score metric'>0.0</div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
