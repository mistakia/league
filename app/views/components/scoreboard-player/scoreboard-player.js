import React from 'react'

import { constants } from '@common'
import { Player, connect } from '@components/player'
import PlayerNameExpanded from '@components/player-name-expanded'
import ScoreboardPlayerGameStatus from '@components/scoreboard-player-game-status'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { player, stats, week } = this.props

    const classNames = ['scoreboard__player']
    if (!stats) classNames.push('projection')

    const points = stats
      ? (stats.points.total || 0).toFixed(1)
      : player.getIn(['points', `${constants.season.week}`, 'total'], 0).toFixed(1)

    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__player-body'>
          <PlayerNameExpanded playerId={player.player} week={week} hideActions />
          <ScoreboardPlayerGameStatus playerId={player.player} week={week} />
        </div>
        <div className='scoreboard__player-score metric'>
          {points}
        </div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
