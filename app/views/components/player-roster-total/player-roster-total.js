import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { constants, getExtensionAmount } from '@libs-shared'

export default class PlayerRosterTotal extends React.Component {
  render() {
    const {
      players,
      league,
      reorder,
      isBeforeExtensionDeadline,
      is_team_manager
    } = this.props

    const { isOffseason, isRegularSeason } = constants
    const week = Math.max(constants.week, 1)
    const projectionType = isRegularSeason ? 'ros' : '0'

    let baseSalaryTotal = 0
    let extendedSalaryTotal = 0
    let projectedSalaryTotal = 0
    let savingsTotal = 0
    let valueTotal = 0
    let valueAdjTotal = 0
    let weekPointsTotal = 0
    let points_added = 0

    players.forEach((playerMap) => {
      const extensions = playerMap.get('extensions', 0)
      const value = playerMap.get('value', 0)
      const bid = playerMap.get('bid', 0)
      const tag = playerMap.get('tag')
      const isRestrictedFreeAgent = tag === constants.tags.TRANSITION
      const extendedSalary = getExtensionAmount({
        pos: playerMap.get('pos'),
        tag: isBeforeExtensionDeadline ? tag : constants.tags.REGULAR,
        extensions,
        league,
        value,
        bid
      })
      const projectedSalary = playerMap.getIn(
        ['market_salary', projectionType],
        0
      )
      const hasProjections = playerMap.hasIn(['market_salary', projectionType])
      const savings = hasProjections
        ? projectedSalary -
          (isBeforeExtensionDeadline ? extendedSalary : bid || value)
        : 0

      const salary = isBeforeExtensionDeadline
        ? value
        : isRestrictedFreeAgent && is_team_manager
        ? bid
        : value
      baseSalaryTotal = baseSalaryTotal + salary
      extendedSalaryTotal = extendedSalaryTotal + extendedSalary
      projectedSalaryTotal = projectedSalaryTotal + projectedSalary
      savingsTotal = savingsTotal + Math.max(savings, 0)
      valueTotal =
        valueTotal +
        Math.max(playerMap.getIn(['pts_added', projectionType], 0), 0)
      valueAdjTotal =
        valueAdjTotal +
        playerMap.getIn(['salary_adj_pts_added', projectionType], 0)
      weekPointsTotal =
        weekPointsTotal + playerMap.getIn(['points', `${week}`, 'total'], 0)
      points_added = points_added + playerMap.get('points_added', 0)
    })

    return (
      <div className='player__item table__row table__row-summary'>
        {reorder && <div className='player__item-action reorder table__cell' />}
        <div className='player__item-name table__cell sticky__column'>
          Total
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='metric table__cell'>
              ${baseSalaryTotal.toFixed(0)}
            </div>
            {isOffseason && isBeforeExtensionDeadline && (
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
        {isBeforeExtensionDeadline && (
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
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='metric table__cell'>
                {points_added ? `${points_added.toFixed(1)}` : '-'}
              </div>
              <div className='metric table__cell'>-</div>
              <div className='metric table__cell'>-</div>
            </div>
          </div>
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
  isBeforeExtensionDeadline: PropTypes.bool,
  is_team_manager: PropTypes.bool
}
