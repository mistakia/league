import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import { constants } from '@common'

class PlayerRoster extends Player {
  handleClick = (event) => {
    const { waiverId } = this.props
    this.handleContextClick(event, waiverId)
  }

  render () {
    const { player, vbaseline, selected, waiverId, type, bid } = this.props

    const isWaiver = !!waiverId

    const classNames = ['player__item']
    if (selected === player.player) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        <div className='player__item-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='player__item-name'>
          <span>{player.pname}</span>
          <Team team={player.team} />
        </div>
        {isWaiver &&
          <div className='player__item-metric'>
            {constants.waiversDetails[type]}
          </div>}
        {isWaiver &&
          <div className='player__item-metric'>
            {bid && `$${bid}`}
          </div>}
        <div className='player__item-metric'>
          {/* contract value */}
        </div>
        <div className='player__item-metric'>
          {(player.vorp.get(vbaseline) || 0).toFixed(1)}
        </div>
        {!isWaiver &&
          <div className='player__item-metric'>
            {/* contract value */}
          </div>}
        <div className='player__item-metric'>
          {/* projected starts  */}
        </div>
        <div className='player__item-metric'>
          {/* projected points over best bench  */}
        </div>
        <div className='player__item-metric'>
          {/* projected bench points  */}
        </div>
        <div className='player__item-action'>
          <IconButton small text onClick={this.handleClick} icon='more' />
        </div>
      </div>
    )
  }
}

export default connect(PlayerRoster)
