import React from 'react'

import { constants } from '@common'
import PlayerNameExpanded from '@components/player-name-expanded'
import { Player, connect } from '@components/player'
import Icon from '@components/icon'
import { sortableHandle } from 'react-sortable-hoc'

const DragHandle = sortableHandle(() =>
  <div className='player__item-action reorder table__cell'>
    <Icon name='reorder' />
  </div>
)

class PlayerRoster extends Player {
  render () {
    const { player, selected, claim, reorder, waiverId } = this.props

    const isClaim = !!claim

    const week = Math.max(constants.season.week, 1)

    const classNames = ['player__item', 'table__row']
    if (selected === player.player) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        {reorder && <DragHandle />}
        <div className='player__item-name table__cell sticky__column'>
          <PlayerNameExpanded playerId={player.player} waiverId={waiverId} />
        </div>
        {!isClaim &&
          <div className='metric table__cell'>
            ${player.value}
          </div>}
        {isClaim &&
          <div className='player__item-name table__cell'>
            {claim.drop && <PlayerNameExpanded playerId={claim.drop} />}
          </div>}
        {isClaim &&
          <div className='metric table__cell'>
            {claim.bid && `$${claim.bid}`}
          </div>}
        <div className='metric table__cell'>
          {player.getIn(['vorp', 'ros', 'starter'], 0).toFixed(1)}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['points', 'ros', 'total'], 0).toFixed(1)}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['points', `${week}`, 'total'], 0).toFixed(1)}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['lineups', 'starts'])}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['lineups', 'sp'], 0).toFixed(1) || '--'}
        </div>
        <div className='metric table__cell'>
          {player.get(['lineups', 'bp'], 0).toFixed(1) || '--'}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRoster)
