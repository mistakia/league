import React from 'react'

import { constants } from '@common'
import { Player, connect } from '@components/player'
import PlayerNameExpanded from '@components/player-name-expanded'
import ScoreboardPlayerGameStatus from '@components/scoreboard-player-game-status'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { playerMap, gamelog, week } = this.props

    const classNames = ['scoreboard__player']
    if (!gamelog) classNames.push('projection')

    const points = gamelog
      ? (gamelog.total || 0).toFixed(1)
      : playerMap
          .getIn(['points', `${constants.season.week}`, 'total'], 0)
          .toFixed(1)

    // TODO pid
    const pid = playerMap.get('player')
    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__player-body'>
          <PlayerNameExpanded playerId={pid} week={week} hideActions minimize />
          <ScoreboardPlayerGameStatus playerId={pid} week={week} />
        </div>
        <div className='scoreboard__player-score metric'>{points}</div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
