import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { getExtensionAmount } from '@libs-shared'
import { current_season, player_tag_types } from '@constants'

export default class PlayerRosterTotal extends React.Component {
  render() {
    const {
      players,
      league,
      reorder,
      is_before_extension_deadline,
      is_before_restricted_free_agency_end,
      is_team_manager
    } = this.props

    const { isOffseason, isRegularSeason } = current_season
    const week = Math.max(current_season.week, 1)
    const projectionType = isRegularSeason ? 'ros' : '0'

    let baseSalaryTotal = 0
    let extendedSalaryTotal = 0
    let projectedSalaryTotal = 0
    let savingsTotal = 0
    let valueTotal = 0
    let valueAdjTotal = 0
    let weekPointsTotal = 0
    let seasonlog_points_total = 0
    let points_added_total = 0

    players.forEach((player_map) => {
      const extensions = player_map.get('extensions', 0)
      const value = player_map.get('value', 0)
      const bid = player_map.get('bid', 0)
      const tag = player_map.get('tag')
      const isRestrictedFreeAgent =
        tag === player_tag_types.RESTRICTED_FREE_AGENCY
      const extendedSalary = getExtensionAmount({
        pos: player_map.get('pos'),
        tag: is_before_extension_deadline ? tag : player_tag_types.REGULAR,
        extensions,
        league,
        value,
        bid
      })
      const projectedSalary = player_map.getIn(
        ['market_salary', projectionType],
        0
      )
      const hasProjections = player_map.hasIn(['market_salary', projectionType])
      const is_restricted_free_agent_tag_processed = player_map.get(
        'restricted_free_agency_tag_processed'
      )
      const savings = hasProjections
        ? projectedSalary -
          (is_before_extension_deadline ? extendedSalary : bid || value)
        : 0

      const salary = is_before_extension_deadline
        ? value
        : is_before_restricted_free_agency_end &&
            isRestrictedFreeAgent &&
            is_team_manager &&
            !is_restricted_free_agent_tag_processed
          ? bid
          : value
      baseSalaryTotal = baseSalaryTotal + salary
      extendedSalaryTotal = extendedSalaryTotal + extendedSalary
      projectedSalaryTotal = projectedSalaryTotal + projectedSalary
      savingsTotal = savingsTotal + Math.max(savings, 0)
      valueTotal =
        valueTotal +
        Math.max(player_map.getIn(['pts_added', projectionType], 0), 0)
      valueAdjTotal =
        valueAdjTotal +
        player_map.getIn(['salary_adj_pts_added', projectionType], 0)
      weekPointsTotal =
        weekPointsTotal + player_map.getIn(['points', `${week}`, 'total'], 0)
      // Use seasonlog_points to avoid collision with projection points object
      const player_seasonlog_points = player_map.get('seasonlog_points')
      seasonlog_points_total =
        seasonlog_points_total +
        (typeof player_seasonlog_points === 'number'
          ? player_seasonlog_points
          : 0)
      const player_points_added = player_map.get('points_added')
      points_added_total =
        points_added_total +
        (typeof player_points_added === 'number' ? player_points_added : 0)
    })

    return (
      <div className='player__item table__row table__row-summary'>
        {reorder && <div className='player__item-action reorder table__cell' />}
        <div className='table__cell text lead-cell sticky__column'>Total</div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='metric table__cell'>
              ${baseSalaryTotal.toFixed(0)}
            </div>
            {isOffseason && is_before_extension_deadline && (
              <div className='metric table__cell'>${extendedSalaryTotal}</div>
            )}
            {/* {isOffseason && <div className='metric table__cell'>-</div>} */}
            {isOffseason && (
              <div className='metric table__cell'>
                {projectedSalaryTotal
                  ? `$${projectedSalaryTotal.toFixed(0)}`
                  : '-'}
              </div>
            )}
            {isOffseason && (
              <div className='metric table__cell'>
                {savingsTotal ? `$${savingsTotal.toFixed(0)}` : '-'}
              </div>
            )}
          </div>
        </div>
        {is_before_extension_deadline && (
          <>
            <div className='table__cell'>-</div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='table__cell'>-</div>
                <div className='table__cell'>-</div>
              </div>
            </div>
          </>
        )}
        {!isOffseason && (
          <>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='metric table__cell'>
                  {seasonlog_points_total
                    ? seasonlog_points_total.toFixed(1)
                    : '-'}
                </div>
                <div className='metric table__cell'>-</div>
              </div>
            </div>
            <div className='row__group'>
              <div className='row__group-body'>
                <div className='metric table__cell'>
                  {points_added_total ? points_added_total.toFixed(1) : '-'}
                </div>
                <div className='metric table__cell'>-</div>
              </div>
            </div>
          </>
        )}
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='metric table__cell'>
              {valueTotal ? valueTotal.toFixed(1) : '-'}
            </div>
            {isOffseason && (
              <div className='metric table__cell'>
                {valueAdjTotal ? valueAdjTotal.toFixed(1) : '-'}
              </div>
            )}
            <div className='metric table__cell'>-</div>
          </div>
        </div>
        {isRegularSeason && (
          <div className='metric table__cell'>
            {weekPointsTotal ? weekPointsTotal.toFixed(1) : '-'}
          </div>
        )}
        <div className='metric table__cell'>-</div>
        <div className='metric table__cell'>-</div>
      </div>
    )
  }
}

PlayerRosterTotal.propTypes = {
  players: ImmutablePropTypes.list,
  reorder: PropTypes.bool,
  league: PropTypes.object,
  is_before_extension_deadline: PropTypes.bool,
  is_before_restricted_free_agency_end: PropTypes.bool,
  is_team_manager: PropTypes.bool
}
