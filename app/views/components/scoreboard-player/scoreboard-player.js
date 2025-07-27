import React from 'react'

import { Player, connect } from '@components/player'
import PlayerNameExpanded from '@components/player-name-expanded'
import ScoreboardPlayerGameStatus from '@components/scoreboard-player-game-status'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { player_map, gamelog, week } = this.props

    const classNames = ['scoreboard__player']
    if (!gamelog) classNames.push('projection')

    const points = gamelog
      ? (gamelog.total || 0).toFixed(1)
      : player_map.getIn(['points', `${week}`, 'total'], 0).toFixed(1)

    const pid = player_map.get('pid')
    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__player-body'>
          <PlayerNameExpanded pid={pid} week={week} hideActions minimize />
          <ScoreboardPlayerGameStatus pid={pid} week={week} />
        </div>
        <div className='scoreboard__player-score metric'>{points}</div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
