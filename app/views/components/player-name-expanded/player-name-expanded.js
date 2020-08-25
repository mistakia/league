import React from 'react'

import Position from '@components/position'
import Tooltip from '@material-ui/core/Tooltip'
import Team from '@components/team'
import { constants } from '@common'

import './player-name-expanded.styl'

export default class PlayerNameExpanded extends React.Component {
  render = () => {
    const { player } = this.props
    return (
      <div className='player__name-expanded'>
        <div className='player__name-expanded-row'>
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
    )
  }
}
