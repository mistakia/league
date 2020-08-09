import React from 'react'

import Position from '@components/position'
import { Player, connect } from '@components/player'
import Team from '@components/team'
import IconButton from '@components/icon-button'

import './player-roster-row.styl'

class PlayerRosterRow extends Player {
  render = () => {
    const { player } = this.props

    return (
      <div className='roster__item'>
        <div className='roster__item-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='roster__item-name'>
          <span>{player.pname}</span>
          <Team team={player.team} />
        </div>
        <div className='roster__item-action'>
          {player.player && <IconButton small text icon='more' onClick={this.handleContextClick} />}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRosterRow)
