import React from 'react'

import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import PlayerName from '@components/player-name'

import './player-roster-row.styl'

class PlayerRosterRow extends Player {
  render = () => {
    const { player, selected, isHosted } = this.props

    const isSelected = selected === player.player
    const classNames = ['roster__item']
    if (isSelected) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        <div className='roster__item-name'>
          <PlayerName playerId={player.player} />
        </div>
        {!!player.player &&
          <div className='roster__item-salary metric'>
            {`$${player.value}`}
          </div>}
        <div className='roster__item-action'>
          {!!(player.player && isHosted) && <IconButton small text icon='more' onClick={this.handleContextClick} />}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRosterRow)
