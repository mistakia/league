import React from 'react'
import { List } from 'immutable'

import { constants, getExtensionAmount } from '@common'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import { sortableHandle } from 'react-sortable-hoc'
import DragIndicatorIcon from '@material-ui/icons/DragIndicator'

const DragHandle = sortableHandle(() => (
  <div className='player__item-action reorder table__cell'>
    <DragIndicatorIcon />
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

    const extensions = player.get('extensions', new List()).size
    const { pos, tag, value, bid } = player
    const extendedSalary = getExtensionAmount({
      pos,
      tag,
      extensions,
      league,
      value,
      bid
    })
    const projectedSalary = player.getIn(['values', 'ros', 'default'], 0)
    const savings = projectedSalary - extendedSalary

    const vorp = player.getIn(['vorp', 'ros', 'default'], 0)
    const vorpAdj = player.getIn(['vorp_adj', 'ros', 'default'], 0)
    const rosPoints = player.getIn(['points', 'ros', 'total'], 0)
    const weekPoints = player.getIn(['points', `${week}`, 'total'], 0)
    const starts = player.getIn(['lineups', 'starts'], 0)
    const startPoints = player.getIn(['lineups', 'sp'], 0)
    const benchPoints = player.getIn(['lineups', 'bp'], 0)

    const isNegative = Math.sign(savings) === -1

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
            {claim.release.size &&
              claim.release.map((player) => (
                <PlayerName
                  key={player}
                  playerId={player}
                  hideActions={isClaim}
                />
              ))}
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
          <div className='metric table__cell'>
            {extendedSalary ? `$${extendedSalary}` : '-'}
          </div>
        )}
        {!isWaiver && !isPoach && (
          <div className='metric table__cell'>
            {projectedSalary ? `$${projectedSalary.toFixed(0)}` : '-'}
          </div>
        )}
        {!isWaiver && (
          <div className={`metric table__cell ${isNegative && 'warning'}`}>
            {savings ? `$${savings.toFixed(0)}` : '-'}
          </div>
        )}
        <div className='metric table__cell'>{vorp ? vorp.toFixed(1) : '-'}</div>
        <div className='metric table__cell'>
          {vorpAdj ? vorpAdj.toFixed(1) : '-'}
        </div>
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {rosPoints ? rosPoints.toFixed(1) : '-'}
          </div>
        )}
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {weekPoints ? weekPoints.toFixed(1) : '-'}
          </div>
        )}
        <div className='metric table__cell'>{starts || '-'}</div>
        <div className='metric table__cell'>
          {startPoints ? startPoints.toFixed(1) : '-'}
        </div>
        <div className='metric table__cell'>
          {benchPoints ? benchPoints.toFixed(1) : '-'}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRoster)
