import React from 'react'
import { constants, getExtensionAmount } from '@libs-shared'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import PlayerHeadshotGroup from '@components/player-headshot-group'
import TeamName from '@components/team-name'
import PercentileMetric from '@components/percentile-metric'

class PlayerRoster extends Player {
  render() {
    const {
      playerMap,
      selected,
      claim,
      dragHandle,
      waiverId,
      poachId,
      is_hosted,
      league,
      isBeforeExtensionDeadline,
      isBeforeRestrictedFreeAgencyEnd,
      isRestrictedFreeAgency,
      percentiles = {},
      is_manager_in_league,
      is_team_manager
    } = this.props

    const isWaiver = Boolean(waiverId)
    const isPoach = Boolean(poachId)
    const isClaim = isWaiver || isPoach
    const { isRegularSeason, isOffseason } = constants
    const tag = playerMap.get('tag')
    const isRestrictedFreeAgent = tag === constants.tags.RESTRICTED_FREE_AGENCY
    const is_restricted_free_agent_tag_processed = playerMap.get(
      'restricted_free_agency_tag_processed'
    )

    const value = playerMap.get('value', 0)
    const bid = playerMap.get('bid')
    const salary = isBeforeExtensionDeadline
      ? value
      : isBeforeRestrictedFreeAgencyEnd &&
          !is_restricted_free_agent_tag_processed &&
          isRestrictedFreeAgent &&
          (is_team_manager || isRestrictedFreeAgency)
        ? bid
        : value
    const extensions = playerMap.get('extensions', 0)
    const pos = playerMap.get('pos', '')
    const slot = playerMap.get('slot')
    const extendedSalary = isRestrictedFreeAgency
      ? bid
      : getExtensionAmount({
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
    const get_savings = () => {
      if (!hasProjections) return null
      if (isRestrictedFreeAgency || isRestrictedFreeAgent)
        return typeof bid === 'number' ? market_salary - bid : null
      if (isBeforeExtensionDeadline) return market_salary - extendedSalary
      return market_salary - value
    }
    const savings = get_savings()

    const pts_added = playerMap.getIn(['pts_added', projectionType], 0)
    const salary_adj_pts_added = playerMap.getIn(
      ['salary_adj_pts_added', projectionType],
      0
    )
    const week = Math.max(constants.week, 1)
    const weekPoints = playerMap.getIn(['points', `${week}`, 'total'], 0)
    const projected_starts = playerMap.getIn(['lineups', 'starts'], 0)
    const startPoints = playerMap.getIn(['lineups', 'sp'], 0)
    const benchPoints = playerMap.getIn(['lineups', 'bp'], 0)
    const points_added = playerMap.get('points_added', 0)
    const points_added_rnk = playerMap.get('points_added_rnk', null)
    const points_added_pos_rnk = playerMap.get('points_added_pos_rnk', null)

    const classNames = ['player__item', 'table__row']
    if (selected === playerMap.get('pid')) classNames.push('selected')
    if (isWaiver) classNames.push('waiver')
    if (isClaim) classNames.push('claim')

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
      const is_rookie = playerMap.get('nfl_draft_year') >= constants.year - 1
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
        {dragHandle}
        <div className='table__cell text sticky__column lead-cell'>
          <PlayerName
            pid={playerMap.get('pid')}
            waiverId={waiverId}
            poachId={poachId}
            hideActions={isPoach}
            headshot_width={48}
            show_position_bar
          />
          {Boolean(
            playerMap.get('pid') && is_hosted && is_manager_in_league
          ) && (
            <div className='player__item-menu'>
              <IconButton
                small
                text
                icon='more'
                onClick={this.handleContextClick}
              />
            </div>
          )}
        </div>
        {isClaim && (
          <div className='table__cell text lead-cell'>
            {Boolean(claim.release.size) &&
              (claim.release.size > 1 ? (
                <PlayerHeadshotGroup players={claim.release} />
              ) : (
                <PlayerName
                  pid={claim.release.get(0).get('pid')}
                  hideActions={isClaim}
                  headshot_width={48}
                  show_position_bar
                />
              ))}
          </div>
        )}
        {Boolean(isRestrictedFreeAgency) && (
          <div className='table__cell player__item-team'>
            <TeamName abbrv tid={playerMap.get('tid')} />
          </div>
        )}
        {Boolean(isRestrictedFreeAgency) && (
          <div className='metric table__cell'>
            {typeof bid === 'number' ? `$${bid}` : '-'}
          </div>
        )}
        {isWaiver && (
          <div className='metric table__cell'>
            {isNaN(claim.bid) ? '-' : `$${claim.bid}`}
          </div>
        )}
        {!isWaiver && (
          <div className='row__group'>
            <div className='row__group-body'>
              {!isRestrictedFreeAgency && (
                <PercentileMetric
                  scaled
                  value={isPoach ? value + 2 : salary}
                  percentile={percentiles.salary}
                  prefix='$'
                />
              )}
              {!isPoach && isOffseason && isBeforeExtensionDeadline && (
                <PercentileMetric
                  scaled
                  value={extendedSalary}
                  percentile={percentiles.extended_salary}
                  prefix='$'
                />
              )}
              {/* {!isPoach && isOffseason && (
              <PercentileMetric
                scaled
                value={market_salary_adj}
                percentile={percentiles.market_salary_adj}
              />
            )} */}
              {!isPoach && isOffseason && (
                <PercentileMetric
                  scaled
                  value={market_salary}
                  percentile={percentiles.market_salary}
                  prefix='$'
                />
              )}
              {isOffseason && (
                <PercentileMetric
                  scaled
                  value={savings}
                  percentile={percentiles.savings}
                  prefix='$'
                  show_positivity
                />
              )}
            </div>
          </div>
        )}
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
              <PercentileMetric
                scaled
                value={points_added}
                percentile={percentiles.points_added}
                decimals={1}
              />
              <PercentileMetric
                scaled
                value={points_added_rnk}
                percentile={percentiles.points_added_rnk}
                invert_order
              />
              <PercentileMetric
                scaled
                value={points_added_pos_rnk}
                percentile={percentiles.points_added_pos_rnk}
                prefix={points_added_pos_rnk ? pos : ''}
                invert_order
              />
            </div>
          </div>
        )}
        <div className='row__group'>
          <div className='row__group-body'>
            <PercentileMetric
              scaled
              value={pts_added}
              percentile={percentiles.pts_added}
              show_positivity
            />
            {isOffseason && (
              <PercentileMetric
                scaled
                value={salary_adj_pts_added}
                percentile={percentiles.salary_adj_pts_added}
              />
            )}
            <PercentileMetric
              scaled
              value={projected_starts}
              percentile={percentiles.projected_starts}
            />
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
