import React from 'react'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { sortableHandle } from 'react-sortable-hoc'

import { constants, getExtensionAmount } from '@common'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import PlayerHeadshotGroup from '@components/player-headshot-group'
import TeamName from '@components/team-name'
import PercentileMetric from '@components/percentile-metric'

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
      isTransition,
      percentiles = {}
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
    const pos = playerMap.get('pos', '')
    const slot = playerMap.get('slot')
    const extendedSalary = getExtensionAmount({
      pos,
      slot,
      tag: isBeforeExtensionDeadline ? tag : constants.tags.REGULAR,
      extensions,
      league,
      value,
      bid
    })
    const projectionType = isRegularSeason ? 'ros' : '0'
    const hasProjections = playerMap.hasIn(['market_salary', projectionType])
    const market_salary = playerMap.getIn(['market_salary', projectionType], 0)
    // const market_salary_adj = playerMap.get('market_salary_adj', 0)
    const savings =
      hasProjections &&
      (!isRestrictedFreeAgencyPeriod || bid || !isRestrictedFreeAgent)
        ? market_salary -
          (isBeforeExtensionDeadline ? extendedSalary : bid || value)
        : null

    const vorp = playerMap.getIn(['vorp', projectionType], 0)
    const vorpAdj = playerMap.getIn(['vorp_adj', projectionType], 0)
    const week = Math.max(constants.week, 1)
    const weekPoints = playerMap.getIn(['points', `${week}`, 'total'], 0)
    const starts = playerMap.getIn(['lineups', 'starts'], 0)
    const startPoints = playerMap.getIn(['lineups', 'sp'], 0)
    const benchPoints = playerMap.getIn(['lineups', 'bp'], 0)
    const points_added = playerMap.get('points_added', 0)
    const points_added_rnk = playerMap.get('points_added_rnk', null)
    const points_added_pos_rnk = playerMap.get('points_added_pos_rnk', null)

    const classNames = ['player__item', 'table__row']
    if (selected === playerMap.get('pid')) classNames.push('selected')
    if (isWaiver) classNames.push('waiver')

    let rookie_tag_savings = null
    let franchise_tag_savings = null
    const regular_extended_salary = getExtensionAmount({
      pos,
      slot,
      tag: constants.tags.REGULAR,
      extensions,
      league,
      value
    })

    if (isBeforeExtensionDeadline) {
      const is_rookie = playerMap.get('start') >= constants.year - 1
      if (is_rookie) {
        rookie_tag_savings =
          Math.max(regular_extended_salary - value, 0) || null
      }

      franchise_tag_savings =
        Math.max(
          regular_extended_salary - league[`f${pos.toLowerCase()}`],
          0
        ) || null
    }

    return (
      <div className={classNames.join(' ')}>
        {reorder && <DragHandle />}
        <div className='player__item-name table__cell sticky__column'>
          <PlayerName
            pid={playerMap.get('pid')}
            waiverId={waiverId}
            poachId={poachId}
            hideActions={isPoach}
            headshot_width={48}
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
                  headshot_width={48}
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
        <div className='row__group'>
          <div className='row__group-body'>
            {!isWaiver && (
              <div className='metric table__cell'>
                {isPoach ? value + 2 || '-' : salary ? `$${salary}` : '-'}
              </div>
            )}
            {!isWaiver && !isPoach && (
              <div className='metric table__cell'>
                {extendedSalary ? `$${extendedSalary}` : '-'}
              </div>
            )}
            {/* {!isWaiver && !isPoach && isOffseason && (
              <PercentileMetric
                scaled
                value={market_salary_adj}
                percentile={percentiles.market_salary_adj}
              />
            )} */}
            {!isWaiver && !isPoach && isOffseason && (
              <PercentileMetric
                scaled
                value={market_salary}
                percentile={percentiles.market_salary}
              />
            )}
            {isOffseason && (
              <PercentileMetric
                scaled
                value={savings}
                percentile={percentiles.savings}
              />
            )}
          </div>
        </div>
        {isBeforeExtensionDeadline && (
          <>
            <div className='metric table__cell'>{regular_extended_salary}</div>
            <div className='row__group'>
              <div className='row__group-body'>
                <PercentileMetric
                  scaled
                  value={franchise_tag_savings}
                  percentile={percentiles.franchise_tag_savings}
                />
                <PercentileMetric
                  scaled
                  value={rookie_tag_savings}
                  percentile={percentiles.rookie_tag_savings}
                />
              </div>
            </div>
          </>
        )}
        {!isOffseason && (
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='metric table__cell'>
                {points_added ? points_added.toFixed(1) : '-'}
              </div>
              <div className='metric table__cell'>{`${
                points_added_rnk || '-'
              }`}</div>
              <div className='metric table__cell'>
                {`${points_added_pos_rnk ? pos : ''}${
                  points_added_pos_rnk || '-'
                }`}
              </div>
            </div>
          </div>
        )}
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='metric table__cell'>
              {vorp ? vorp.toFixed(0) : '-'}
            </div>
            {isOffseason && (
              <PercentileMetric
                scaled
                value={vorpAdj}
                percentile={percentiles.vorp_adj}
              />
            )}
            <div className='metric table__cell'>{starts || '-'}</div>
          </div>
        </div>
        {isRegularSeason && (
          <div className='metric table__cell'>
            {weekPoints ? weekPoints.toFixed(1) : '-'}
          </div>
        )}
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
