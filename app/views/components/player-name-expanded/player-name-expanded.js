import React from 'react'

import { Player, connect } from '@components/player'
import Position from '@components/position'
import Tooltip from '@material-ui/core/Tooltip'
import Team from '@components/team'
import { constants } from '@common'
import IconButton from '@components/icon-button'

import './player-name-expanded.styl'

class PlayerNameExpanded extends Player {
  render = () => {
    const { player, isHosted } = this.props
    return (
      <div className='player__name-expanded'>
        <div className='player__name-expanded-main'>
          <div
            className='player__name-expanded-row player__name-expanded-name cursor'
            onClick={this.handleClick}
          >
            <span>{player.fname} {player.lname}</span>
            {(constants.season.year === player.draft_year) &&
              <sup className='player__label-rookie'>
                R
              </sup>}
          </div>
          <div className='player__name-expanded-row'>
            <Position pos={player.pos1} />
            <Team team={player.team} />
            {!!player.status &&
              <Tooltip title={player.status} placement='bottom'>
                <span className='player__label-status'>
                  {constants.status[player.status]}
                </span>
              </Tooltip>}
          </div>
        </div>
        {!!(isHosted && player.player) &&
          <div className='player__name-expanded-action'>
            <IconButton small text onClick={this.handleContextClick} icon='more' />
          </div>}
      </div>
    )
  }
}

export default connect(PlayerNameExpanded)
