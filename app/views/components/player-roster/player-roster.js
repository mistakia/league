import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import Player from '@components/player'

export default class PlayerRoster extends Player {
  render () {
    const { player, vbaseline } = this.props

    return (
      <div className='player__item'>
        <div className='player__item-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='player__item-name'>
          <span>{player.pname}</span>
          <Team team={player.team} />
        </div>
        <div className='player__item-metric'>
          {/* contract value */}
        </div>
        <div className='player__item-metric'>
          {(player.vorp.get(vbaseline) || 0).toFixed(1)}
        </div>
        <div className='player__item-metric'>
          {/* contract value */}
        </div>
        <div className='player__item-metric'>
          {/* projected starts  */}
        </div>
        <div className='player__item-metric'>
          {/* projected points over best bench  */}
        </div>
        <div className='player__item-metric'>
          {/* projected bench points  */}
        </div>
      </div>
    )
  }
}
