import React from 'react'
import DragIndicatorIcon from '@material-ui/icons/DragIndicator'
import { sortableHandle } from 'react-sortable-hoc'

import { constants, getExtensionAmount } from '@common'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import PlayerHeadshotGroup from '@components/player-headshot-group'

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
      poachId,
      isHosted,
      league,
      isBeforeExtensionDeadline,
      isBeforeTransitionDeadline
    } = this.props

    const isWaiver = Boolean(waiverId)
    const isPoach = Boolean(poachId)
    const isClaim = isWaiver || isPoach
    const { isRegularSeason, isOffseason } = constants.season
    const isRestrictedFreeAgent = player.tag === constants.tags.TRANSITION
    const isRestrictedFreeAgencyPeriod =
      !isBeforeExtensionDeadline && isBeforeTransitionDeadline

    const { pos, tag, value, bid } = player
    const salary = isRestrictedFreeAgent ? bid : value
    const extensions = player.get('extensions', 0)
    const extendedSalary = getExtensionAmount({
      pos,
      tag,
      extensions,
      league,
      value,
      bid
    })
    const projectionType = isRegularSeason ? 'ros' : '0'
    const hasProjections = player.hasIn(['market_salary', projectionType])
    const projectedSalary = player.getIn(['market_salary', projectionType], 0)
    const savings =
      hasProjections &&
      (!isRestrictedFreeAgencyPeriod || bid || !isRestrictedFreeAgent)
        ? projectedSalary - extendedSalary
        : null

    const vorp = player.getIn(['vorp', projectionType], 0)
    const vorpAdj = player.getIn(['vorp_adj', projectionType], 0)
    const rosPoints = player.getIn(['points', projectionType, 'total'], 0)
    const week = Math.max(constants.season.week, 1)
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
          <PlayerName
            playerId={player.player}
            waiverId={waiverId}
            poachId={poachId}
            hideActions={isPoach}
            headshot
          />
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
        </div>
        {isClaim && (
          <div className='player__item-name table__cell'>
            {Boolean(claim.release.size) &&
              (claim.release.size > 1 ? (
                <PlayerHeadshotGroup players={claim.release} />
              ) : (
                <PlayerName
                  playerId={claim.release.get(0).player}
                  hideActions={isClaim}
                  headshot
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
            {isPoach ? player.value + 2 || '-' : salary ? `$${salary}` : '-'}
          </div>
        )}
        {!isWaiver && !isPoach && (
          <div className='metric table__cell'>
            {extendedSalary ? `$${extendedSalary}` : '-'}
          </div>
        )}
        {!isWaiver && !isPoach && isOffseason && (
          <div className='metric table__cell'>
            {projectedSalary ? `$${projectedSalary.toFixed(0)}` : '-'}
          </div>
        )}
        {!isWaiver && isOffseason && (
          <div className={`metric table__cell ${isNegative && 'warning'}`}>
            {savings ? `$${savings.toFixed(0)}` : '-'}
          </div>
        )}
        <div className='metric table__cell'>{vorp ? vorp.toFixed(0) : '-'}</div>
        {isOffseason && (
          <div className='metric table__cell'>
            {vorpAdj ? vorpAdj.toFixed(0) : '-'}
          </div>
        )}
        {isRegularSeason && (
          <div className='metric table__cell'>
            {rosPoints ? rosPoints.toFixed(0) : '-'}
          </div>
        )}
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {weekPoints ? weekPoints.toFixed(1) : '-'}
          </div>
        )}
        <div className='metric table__cell'>{starts || '-'}</div>
        <div className='metric table__cell'>
          {startPoints ? startPoints.toFixed(0) : '-'}
        </div>
        <div className='metric table__cell'>
          {benchPoints ? benchPoints.toFixed(0) : '-'}
        </div>
      </div>
    )
  }
}

export default connect(PlayerRoster)
