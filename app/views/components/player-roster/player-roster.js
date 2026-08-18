import React from 'react'
import { getExtensionAmount } from '#libs-shared'
import PlayerName from '@components/player-name'
import IconButton from '@components/icon-button'
import { Player, connect } from '@components/player'
import PlayerHeadshotGroup from '@components/player-headshot-group'
import TeamName from '@components/team-name'
import PercentileMetric from '@components/percentile-metric'
import StackedMetric from '@components/stacked-metric'
import NFLTeamBye from '@components/nfl-team-bye'
import { current_season, player_tag_types } from '#constants'

// league.franchise_tag_salary_<pos> no longer shares a shape with the
// position code, so the per-position lookup needs an explicit map.
const franchise_tag_salary_field_by_position = {
  qb: 'franchise_tag_salary_quarterback',
  rb: 'franchise_tag_salary_running_back',
  wr: 'franchise_tag_salary_wide_receiver',
  te: 'franchise_tag_salary_tight_end'
}

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
    const { isRegularSeason, isOffseason } = current_season
    const tag = player_map.get('tag')
    const isRestrictedFreeAgent =
      tag === player_tag_types.RESTRICTED_FREE_AGENCY
    const is_restricted_free_agent_tag_processed = player_map.get(
      'restricted_free_agency_tag_processed'
    )

    const player_salary = player_map.get('player_salary', 0)
    const bid = player_map.get('bid_amount')
    const salary = is_before_extension_deadline
      ? player_salary
      : is_before_restricted_free_agency_end &&
          !is_restricted_free_agent_tag_processed &&
          isRestrictedFreeAgent &&
          (is_team_manager || isRestrictedFreeAgency)
        ? bid
        : player_salary
    const extensions = player_map.get('extensions', 0)
    const pos = player_map.get('primary_position', '')
    const slot = player_map.get('slot')
    const extendedSalary = isRestrictedFreeAgency
      ? bid
      : getExtensionAmount({
          pos,
          slot,
          tag: is_before_extension_deadline ? tag : player_tag_types.REGULAR,
          extensions,
          league,
          player_salary,
          bid
        })
    const projectionType = isRegularSeason ? 'ros' : '0'
    const hasProjections = player_map.hasIn(['market_salary', projectionType])
    const market_salary = player_map.getIn(['market_salary', projectionType], 0)
    const get_savings = () => {
      if (!hasProjections) return null
      if (isRestrictedFreeAgency || isRestrictedFreeAgent)
        return typeof bid === 'number' ? market_salary - bid : null
      if (is_before_extension_deadline) return market_salary - extendedSalary
      return market_salary - player_salary
    }
    const savings = get_savings()

    const pts_added = player_map.getIn(['pts_added', projectionType], 0)
    // The net variant exists only at rest-of-season grain -- there is no
    // season-grain net, so this reads `ros_net` in every phase rather than
    // following `projectionType`.
    const pts_added_net = player_map.getIn(['pts_added', 'ros_net'], null)
    const points_added_including_cap_savings = player_map.getIn(
      ['projected_points_added_positive_including_cap_savings', projectionType],
      0
    )
    const week = Math.max(current_season.week, 1)
    const weekPoints = player_map.getIn(['points', `${week}`, 'total'], 0)
    const projected_starts = player_map.getIn(['lineups', 'starts'], 0)
    const startPoints = player_map.getIn(['lineups', 'starter_plus_points'], 0)
    const benchPoints = player_map.getIn(['lineups', 'bench_plus_points'], 0)

    // Seasonlog data for results display
    // Note: seasonlog_points is used because 'points' is overwritten by projection points object
    const seasonlog_points = player_map.get('seasonlog_points', null)
    const points_per_game = player_map.get('points_per_game', null)
    const points_position_rank = player_map.get('points_position_rank', null)
    const points_per_game_position_rank = player_map.get(
      'points_per_game_position_rank',
      null
    )
    const points_added_earned = player_map.get('points_added_earned', null)
    const points_added_earned_per_game = player_map.get(
      'points_added_earned_per_game',
      null
    )
    const points_added_earned_position_rank = player_map.get(
      'points_added_earned_position_rank',
      null
    )
    const points_added_earned_per_game_position_rank = player_map.get(
      'points_added_earned_per_game_position_rank',
      null
    )

    const classNames = ['player__item', 'table__row']
    if (selected === player_map.get('pid')) classNames.push('selected')
    if (isWaiver) classNames.push('waiver')
    if (isClaim) classNames.push('claim')

    let rookie_tag_savings = null
    let franchise_tag_savings = null
    const regular_extended_salary = getExtensionAmount({
      pos,
      slot,
      tag: player_tag_types.REGULAR,
      extensions,
      league,
      player_salary
    })

    if (is_before_extension_deadline) {
      const is_rookie =
        player_map.get('nfl_draft_year') >= current_season.year - 1
      if (is_rookie) {
        rookie_tag_savings =
          Math.max(regular_extended_salary - player_salary, 0) || null
      }

      franchise_tag_savings =
        Math.max(
          regular_extended_salary -
            league[franchise_tag_salary_field_by_position[pos.toLowerCase()]],
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
            {isNaN(claim.bid_amount) ? '-' : `$${claim.bid_amount}`}
          </div>
        )}
        {!isWaiver && (
          <div className='row__group'>
            <div className='row__group-body'>
              {!isRestrictedFreeAgency && (
                <PercentileMetric
                  scaled
                  value={isPoach ? player_salary + 2 : salary}
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
          <>
            <div className='row__group'>
              <div className='row__group-body'>
                <StackedMetric
                  value={seasonlog_points}
                  position_rank={points_position_rank}
                  position={pos}
                  percentile={percentiles.seasonlog_points}
                  fixed={1}
                />
                <StackedMetric
                  value={points_per_game}
                  position_rank={points_per_game_position_rank}
                  position={pos}
                  percentile={percentiles.points_per_game}
                  fixed={1}
                />
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <StackedMetric
                  value={points_added_earned}
                  position_rank={points_added_earned_position_rank}
                  position={pos}
                  percentile={percentiles.points_added_earned}
                  fixed={1}
                />
                <StackedMetric
                  value={points_added_earned_per_game}
                  position_rank={points_added_earned_per_game_position_rank}
                  position={pos}
                  percentile={percentiles.points_added_earned_per_game}
                  fixed={1}
                />
              </div>
            </div>
          </>
        )}
        <div className='row__group'>
          <div className='row__group-body'>
            <PercentileMetric
              scaled
              value={pts_added}
              percentile={percentiles.pts_added}
              show_positivity
            />
            <PercentileMetric
              scaled
              value={pts_added_net}
              percentile={percentiles.pts_added_net}
              show_positivity
            />
            {isOffseason && (
              <PercentileMetric
                scaled
                value={points_added_including_cap_savings}
                percentile={
                  percentiles.projected_points_added_positive_including_cap_savings
                }
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
