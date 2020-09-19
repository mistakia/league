import React from 'react'
import moment from 'moment-timezone'

import { Player, connect } from '@components/player'
import Position from '@components/position'
import Tooltip from '@material-ui/core/Tooltip'
import Team from '@components/team'
import { constants } from '@common'
import IconButton from '@components/icon-button'

import './player-name-expanded.styl'

class PlayerNameExpanded extends Player {
  render = () => {
    const { player, isHosted, hideActions, game } = this.props
    const hasGame = !!game

    const gameTime = hasGame
      ? moment.tz(game.date, 'M/D/YYYY H:m', 'America/New_York').local().format('ddd, h:mmA')
      : null

    const opponent = hasGame
      ? (player.team === game.h ? `v${game.v}` : `@${game.h}`)
      : null

    return (
      <div className='player__name-expanded'>
        {!!(isHosted && player.player && !hideActions) &&
          <div className='player__name-expanded-action'>
            <IconButton small text onClick={this.handleContextClick} icon='more' />
          </div>}
        <div className='player__name-expanded-main'>
          <div
            className='player__name-expanded-row player__name-expanded-name cursor'
            onClick={this.handleClick}
          >
            <div className='player__name-expanded-full-name'>{player.fname} {player.lname}</div>
            {(constants.season.year === player.draft_year) &&
              <sup className='player__label-rookie'>
                R
              </sup>}
          </div>
          <div className='player__name-expanded-row'>
            <Position pos={player.pos1} />
            <Team team={player.team} />
            {hasGame &&
              <div className='player__name-expanded-game'>
                {gameTime} {opponent}
              </div>}
            {!!(constants.status[player.status] || player.gamestatus) &&
              <Tooltip title={constants.status[player.status] ? player.status : player.gamestatus} placement='bottom'>
                <span className='player__label-status'>
                  {constants.status[player.status] || constants.status[player.gamestatus]}
                </span>
              </Tooltip>}
          </div>
        </div>
      </div>
    )
  }
}

export default connect(PlayerNameExpanded)
