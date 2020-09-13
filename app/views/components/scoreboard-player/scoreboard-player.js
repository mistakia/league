import React from 'react'

import { constants } from '@common'
import { Player, connect } from '@components/player'
import PlayerNameExpanded from '@components/player-name-expanded'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { player, scoreboard } = this.props

    const classNames = ['scoreboard__player']
    if (!scoreboard) classNames.push('projection')

    const points = scoreboard
      ? (scoreboard.points.total || 0).toFixed(1)
      : player.getIn(['points', `${constants.season.week}`, 'total'], 0).toFixed(1)

    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__player-body'>
          <PlayerNameExpanded playerId={player.player} hideActions />
          <div className='scoreboard__player-game-info' />
          <div className='scoreboard__player-game-stats' />
          <div className='scoreboard__player-drive-info' />
        </div>
        <div className='scoreboard__player-score metric'>
          {points}
        </div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
