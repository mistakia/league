import React from 'react'
import moment from 'moment-timezone'

import { Player, connect } from '@components/player'
import Position from '@components/position'
import Tooltip from '@material-ui/core/Tooltip'
import Team from '@components/team'
import { constants, nth } from '@common'
import IconButton from '@components/icon-button'
import PlayerLabel from '@components/player-label'

import './player-name-expanded.styl'

const getPlayerTagLabel = (tag) => {
  switch (tag) {
    case 2:
      return (<PlayerLabel label='F' type='tag' description='Franchise Tag' />)
    case 3:
      return (<PlayerLabel label='R' type='tag' description='Rookie Tag' />)
    case 4:
      return (<PlayerLabel label='RFA' type='tag' description='Restricted Free Agent' />)
  }
}

function getClock ({ playDescription, clockTime, quarter }) {
  switch (playDescription) {
    case 'END QUARTER 1':
      return 'End of 1st'

    case 'END QUARTER 2':
      return 'Half'

    case 'END QUARTER 3':
      return 'End of 3rd'

    case 'END GAME':
      return 'Final'

    default:
      return quarter ? `${clockTime} ${quarter}${nth(quarter)}` : '-'
  }
}

function GameStatus ({ status, player }) {
  if (!constants.season.isRegularSeason) {
    return null
  }

  if (!player || !player.player) {
    return null
  }

  if (!status || !status.game) {
    return (
      <div className='player__name-expanded-game bye'>
        BYE
      </div>
    )
  }

  const opponent = player.team === status.game.h ? `v${status.game.v}` : `@${status.game.h}`

  if (!status.lastPlay) {
    const gameTime = moment.tz(status.game.date, 'M/D/YYYY H:m', 'America/New_York')
      .local()
      .format('ddd, h:mmA')

    return (
      <div className='player__name-expanded-game'>
        {gameTime} {opponent}
      </div>
    )
  }

  const clock = getClock(status.lastPlay)

  return (
    <div className='player__name-expanded-game'>
      {opponent} <span className='clock'>{clock}</span>
    </div>
  )
}

class PlayerNameExpanded extends Player {
  render = () => {
    const { player, isHosted, hideActions, status } = this.props

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
            {(constants.season.year === player.draft_year) && <PlayerLabel label='R' type='rookie' description='Rookie' />}
            {(player.slot === constants.slots.PSP) && <PlayerLabel label='P' description='Protected Practice Squad' />}
            {(player.tag > 1) && getPlayerTagLabel(player.tag)}
          </div>
          <div className='player__name-expanded-row'>
            <Position pos={player.pos} />
            <Team team={player.team} />
            <GameStatus status={status} player={player} />
            {!!(constants.status[player.status] || player.gamestatus) &&
              <PlayerLabel type='game' label={constants.status[player.status] || constants.status[player.gamestatus]} description={constants.status[player.status] ? player.status : player.gamestatus} />}
          </div>
        </div>
      </div>
    )
  }
}

export default connect(PlayerNameExpanded)
