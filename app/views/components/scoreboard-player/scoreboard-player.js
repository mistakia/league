import React from 'react'

import { Player, connect } from '@components/player'
import PlayerNameExpanded from '@components/player-name-expanded'
import ScoreboardPlayerGameStatus from '@components/scoreboard-player-game-status'

import './scoreboard-player.styl'

class ScoreboardPlayer extends Player {
  render = () => {
    const { player_map, gamelog, week, live_projection } = this.props

    const classNames = ['scoreboard__player']

    // Determine points to display based on game state
    let main_points
    let secondary_points = null

    if (live_projection) {
      const { game_state, projected_total, accumulated_points } =
        live_projection

      if (game_state === 'completed') {
        // Completed game - show actual points only
        main_points = (gamelog?.total || projected_total || 0).toFixed(1)
      } else if (game_state === 'live') {
        // Live game - show accumulated as main, projected total as secondary
        classNames.push('live')
        main_points = (accumulated_points || 0).toFixed(1)
        secondary_points = (projected_total || 0).toFixed(1)
      } else {
        // Pending game - show full projection
        classNames.push('projection')
        main_points = (projected_total || 0).toFixed(1)
      }
    } else {
      // Fallback to original behavior
      if (!gamelog) classNames.push('projection')
      main_points = gamelog
        ? (gamelog.total || 0).toFixed(1)
        : player_map.getIn(['points', `${week}`, 'total'], 0).toFixed(1)
    }

    const pid = player_map.get('pid')
    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__player-body'>
          <PlayerNameExpanded pid={pid} week={week} hideActions minimize />
          <ScoreboardPlayerGameStatus pid={pid} week={week} />
        </div>
        <div className='scoreboard__player-score metric'>
          {main_points}
          {secondary_points !== null && (
            <span className='scoreboard__player-projected'>
              {secondary_points}
            </span>
          )}
        </div>
      </div>
    )
  }
}

export default connect(ScoreboardPlayer)
