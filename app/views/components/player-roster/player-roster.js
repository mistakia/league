import React from 'react'
import { constants, getExtensionAmount } from '@libs-shared'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import PlayerHeadshotGroup from '@components/player-headshot-group'
import TeamName from '@components/team-name'
import PercentileMetric from '@components/percentile-metric'
import NFLTeamBye from '@components/nfl-team-bye'

class PlayerRoster extends Player {
  render() {
    const {
      player_map,
      selected,
      claim,
      dragHandle,
      waiverId,
      poachId,
      is_hosted,
      league,
      is_before_extension_deadline,
      is_before_restricted_free_agency_end,
      isRestrictedFreeAgency,
      percentiles = {},
      is_manager_in_league,
      is_team_manager
    } = this.props

    const isWaiver = Boolean(waiverId)
    const isPoach = Boolean(poachId)
    const isClaim = isWaiver || isPoach
    const { isRegularSeason, isOffseason } = constants
    const tag = player_map.get('tag')
    const isRestrictedFreeAgent = tag === constants.tags.RESTRICTED_FREE_AGENCY
    const is_restricted_free_agent_tag_processed = player_map.get(
      'restricted_free_agency_tag_processed'
    )

    const value = player_map.get('value', 0)
    const bid = player_map.get('bid')
    const salary = is_before_extension_deadline
      ? value
      : is_before_restricted_free_agency_end &&
          !is_restricted_free_agent_tag_processed &&
          isRestrictedFreeAgent &&
          (is_team_manager || isRestrictedFreeAgency)
        ? bid
        : value
    const extensions = player_map.get('extensions', 0)
    const pos = player_map.get('pos', '')
    const slot = player_map.get('slot')
    const extendedSalary = isRestrictedFreeAgency
      ? bid
      : getExtensionAmount({
          pos,
          slot,
          tag: is_before_extension_deadline ? tag : constants.tags.REGULAR,
          extensions,
          league,
          value,
          bid
        })
    const projectionType = isRegularSeason ? 'ros' : '0'
    const hasProjections = player_map.hasIn(['market_salary', projectionType])
    const market_salary = player_map.getIn(['market_salary', projectionType], 0)
    // const market_salary_adj = player_map.get('market_salary_adj', 0)
    const get_savings = () => {
      if (!hasProjections) return null
      if (isRestrictedFreeAgency || isRestrictedFreeAgent)
        return typeof bid === 'number' ? market_salary - bid : null
      if (is_before_extension_deadline) return market_salary - extendedSalary
      return market_salary - value
    }
    const savings = get_savings()

    const pts_added = player_map.getIn(['pts_added', projectionType], 0)
    const salary_adj_pts_added = player_map.getIn(
      ['salary_adj_pts_added', projectionType],
      0
    )
    const week = Math.max(constants.week, 1)
    const weekPoints = player_map.getIn(['points', `${week}`, 'total'], 0)
    const projected_starts = player_map.getIn(['lineups', 'starts'], 0)
    const startPoints = player_map.getIn(['lineups', 'sp'], 0)
    const benchPoints = player_map.getIn(['lineups', 'bp'], 0)
    const points_added = player_map.get('points_added', 0)
    const points_added_rnk = player_map.get('points_added_rnk', null)
    const points_added_pos_rnk = player_map.get('points_added_pos_rnk', null)

    const classNames = ['player__item', 'table__row']
    if (selected === player_map.get('pid')) classNames.push('selected')
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

    if (is_before_extension_deadline) {
      const is_rookie = player_map.get('nfl_draft_year') >= constants.year - 1
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
            pid={player_map.get('pid')}
            waiverId={waiverId}
            poachId={poachId}
            hideActions={isPoach}
            headshot_width={48}
            show_position_bar
            show_reserve_tag
          />
          {Boolean(
            player_map.get('pid') && is_hosted && is_manager_in_league
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
                  show_reserve_tag
                />
              ))}
          </div>
        )}
        {Boolean(isRestrictedFreeAgency) && (
          <div className='table__cell player__item-team'>
            <TeamName abbrv tid={player_map.get('tid')} />
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
              {!isPoach && isOffseason && is_before_extension_deadline && (
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
        {is_before_extension_deadline && (
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
        {isRegularSeason && (
          <div className='metric table__cell'>
            <NFLTeamBye nfl_team={player_map.get('team')} />
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
