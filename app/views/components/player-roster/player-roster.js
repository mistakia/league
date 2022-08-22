import React from 'react'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { sortableHandle } from 'react-sortable-hoc'

import { constants, getExtensionAmount } from '@common'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import PlayerHeadshotGroup from '@components/player-headshot-group'
import TeamName from '@components/team-name'

const DragHandle = sortableHandle(() => (
  <div className='player__item-action reorder table__cell'>
    <DragIndicatorIcon />
  </div>
))

class PlayerRoster extends Player {
  render() {
    const {
      playerMap,
      selected,
      claim,
      reorder,
      waiverId,
      poachId,
      isHosted,
      league,
      isRestrictedFreeAgencyPeriod,
      isBeforeExtensionDeadline,
      isTransition
    } = this.props

    const isWaiver = Boolean(waiverId)
    const isPoach = Boolean(poachId)
    const isClaim = isWaiver || isPoach
    const { isRegularSeason, isOffseason } = constants
    const tag = playerMap.get('tag')
    const isRestrictedFreeAgent = tag === constants.tags.TRANSITION

    const value = playerMap.get('value', 0)
    const bid = playerMap.get('bid', 0)
    const salary = isTransition ? value : bid || value
    const extensions = playerMap.get('extensions', 0)
    const extendedSalary = getExtensionAmount({
      pos: playerMap.get('pos'),
      tag: isBeforeExtensionDeadline ? tag : constants.tags.REGULAR,
      extensions,
      league,
      value,
      bid
    })
    const projectionType = isRegularSeason ? 'ros' : '0'
    const hasProjections = playerMap.hasIn(['market_salary', projectionType])
    const projectedSalary = playerMap.getIn(
      ['market_salary', projectionType],
      0
    )
    const market_salary_adj = playerMap.get('market_salary_adj', 0)
    const savings =
      hasProjections &&
      (!isRestrictedFreeAgencyPeriod || bid || !isRestrictedFreeAgent)
        ? projectedSalary -
          (isBeforeExtensionDeadline ? extendedSalary : bid || value)
        : null

    const vorp = playerMap.getIn(['vorp', projectionType], 0)
    const vorpAdj = playerMap.getIn(['vorp_adj', projectionType], 0)
    const rosPoints = playerMap.getIn(['points', projectionType, 'total'], 0)
    const week = Math.max(constants.week, 1)
    const weekPoints = playerMap.getIn(['points', `${week}`, 'total'], 0)
    const starts = playerMap.getIn(['lineups', 'starts'], 0)
    const startPoints = playerMap.getIn(['lineups', 'sp'], 0)
    const benchPoints = playerMap.getIn(['lineups', 'bp'], 0)

    const isNegative = Math.sign(savings) === -1

    const classNames = ['player__item', 'table__row']
    if (selected === playerMap.get('pid')) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        {reorder && <DragHandle />}
        <div className='player__item-name table__cell sticky__column'>
          <PlayerName
            pid={playerMap.get('pid')}
            waiverId={waiverId}
            poachId={poachId}
            hideActions={isPoach}
            headshot
          />
          <div className='player__item-menu'>
            {Boolean(playerMap.get('pid') && isHosted) && (
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
                  pid={claim.release.get(0).get('pid')}
                  hideActions={isClaim}
                  headshot
                />
              ))}
          </div>
        )}
        {Boolean(isTransition) && (
          <div className='table__cell player__item-team'>
            <TeamName abbrv tid={playerMap.get('tid')} />
          </div>
        )}
        {Boolean(isTransition) && (
          <div className='metric table__cell'>{bid ? `$${bid}` : '-'}</div>
        )}
        {isWaiver && (
          <div className='metric table__cell'>
            {isNaN(claim.bid) ? '-' : `$${claim.bid}`}
          </div>
        )}
        {!isWaiver && (
          <div className='metric table__cell'>
            {isPoach ? value + 2 || '-' : salary ? `$${salary}` : '-'}
          </div>
        )}
        {!isWaiver && !isPoach && !isOffseason && (
          <div className='metric table__cell'>
            {extendedSalary ? `$${extendedSalary}` : '-'}
          </div>
        )}
        {!isWaiver && !isPoach && isOffseason && (
          <div className='metric table__cell'>
            {market_salary_adj ? `$${market_salary_adj.toFixed(0)}` : '-'}
          </div>
        )}
        {!isWaiver && !isPoach && isOffseason && (
          <div className='metric table__cell'>
            {projectedSalary ? `$${projectedSalary.toFixed(0)}` : '-'}
          </div>
        )}
        {isOffseason && (
          <div className={`metric table__cell ${isNegative ? 'warning' : ''}`}>
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
        {constants.week > 0 && (
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
