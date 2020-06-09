import React from 'react'

import Position from '@components/position'

import './player.styl'

class Player extends React.Component {
  render () {
    const { player } = this.props

    return (
      <div className='player__item'>
        <div className='player__item-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='player__item-name'>
          {player.pname} {player.team}
        </div>
        <div className='player__item-metric'>
          ${Math.round(player.values.get('available'))}
        </div>
        <div className='player__item-metric'>
          {(player.vorp.get('available') || 0).toFixed(1)}
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

export default Player
