import React from 'react'

import { constants } from '@common'
import { getExtensionAmount } from '@core/utils'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import Icon from '@components/icon'
import { sortableHandle } from 'react-sortable-hoc'

const DragHandle = sortableHandle(() => (
  <div className='player__item-action reorder table__cell'>
    <Icon name='reorder' />
  </div>
))

class PlayerRoster extends Player {
  render() {
    const {
      player,
      selected,
      claim,
      reorder,
      waiverId,
      poach,
      isHosted,
      league
    } = this.props

    const isWaiver = Boolean(waiverId)
    const isPoach = Boolean(poach)
    const isClaim = isWaiver || isPoach

    const week = Math.max(constants.season.week, 1)

    const extensions = player.get('extensions').size
    const { pos, tag, value } = player
    const extendedSalary = getExtensionAmount({
      pos,
      tag,
      extensions,
      league,
      value
    })
    const projectedSalary = player.getIn(['values', 'ros', 'default'], 0)
    const savings = projectedSalary - extendedSalary

    const classNames = ['player__item', 'table__row']
    if (selected === player.player) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        {reorder && <DragHandle />}
        <div className='player__item-name table__cell sticky__column'>
          <div className='player__item-menu'>
            {Boolean(player.player && isHosted) && (
              <IconButton
                small
                text
                icon='more'
                onClick={this.handleContextClick}
              />
            )}
          </div>
          <PlayerName
            playerId={player.player}
            waiverId={waiverId}
            hideActions={isPoach}
          />
        </div>
        {isClaim && (
          <div className='player__item-name table__cell'>
            {claim.drop && (
              <PlayerName playerId={claim.drop} hideActions={isClaim} />
            )}
          </div>
        )}
        {isWaiver && (
          <div className='metric table__cell'>
            {claim.bid && `$${claim.bid}`}
          </div>
        )}
        {!isWaiver && (
          <div className='metric table__cell'>
            ${isPoach ? player.value + 2 || '-' : player.value}
          </div>
        )}
        {!isWaiver && !isPoach && (
          <div className='metric table__cell'>${extendedSalary}</div>
        )}
        {!isWaiver && !isPoach && (
          <div className='metric table__cell'>
            ${projectedSalary.toFixed(0)}
          </div>
        )}
        {!isWaiver && (
          <div className='metric table__cell'>${savings.toFixed(0)}</div>
        )}
        <div className='metric table__cell'>
          {player.getIn(['vorp', 'ros', 'default'], 0).toFixed(1)}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['vorp_adj', 'ros', 'default'], 0).toFixed(1)}
        </div>
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {player.getIn(['points', 'ros', 'total'], 0).toFixed(1)}
          </div>
        )}
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {player.getIn(['points', `${week}`, 'total'], 0).toFixed(1)}
          </div>
        )}
        <div className='metric table__cell'>
          {player.getIn(['lineups', 'starts'])}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['lineups', 'sp'], 0).toFixed(1) || '--'}
        </div>
        <div className='metric table__cell'>
          {player.getIn(['lineups', 'bp'], 0).toFixed(1) || '--'}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRoster)
