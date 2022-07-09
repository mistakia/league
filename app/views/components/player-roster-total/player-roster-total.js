import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { constants, getExtensionAmount } from '@common'

export default class PlayerRosterTotal extends React.Component {
  render() {
    const { players, league, reorder, isBeforeExtensionDeadline } = this.props

    const { isOffseason } = constants.season
    const week = Math.max(constants.season.week, 1)
    const projectionType = constants.season.isRegularSeason ? 'ros' : '0'

    let baseSalaryTotal = 0
    let extendedSalaryTotal = 0
    let projectedSalaryTotal = 0
    let savingsTotal = 0
    let valueTotal = 0
    let valueAdjTotal = 0
    let rosPointsTotal = 0
    let weekPointsTotal = 0

    players.forEach((playerMap) => {
      const extensions = playerMap.get('extensions', 0)
      const value = playerMap.get('value', 0)
      const bid = playerMap.get('bid', 0)
      const extendedSalary = getExtensionAmount({
        pos: playerMap.get('pos'),
        tag: isBeforeExtensionDeadline
          ? playerMap.get('tag')
          : constants.tags.REGULAR,
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

      baseSalaryTotal = baseSalaryTotal + (bid || value)
      extendedSalaryTotal = extendedSalaryTotal + extendedSalary
      projectedSalaryTotal = projectedSalaryTotal + projectedSalary
      savingsTotal = savingsTotal + savings
      valueTotal = valueTotal + playerMap.getIn(['vorp', projectionType], 0)
      valueAdjTotal =
        valueAdjTotal + playerMap.getIn(['vorp_adj', projectionType], 0)
      rosPointsTotal =
        rosPointsTotal + playerMap.getIn(['points', projectionType, 'total'], 0)
      weekPointsTotal =
        weekPointsTotal + playerMap.getIn(['points', `${week}`, 'total'], 0)
    })

    return (
      <div className='player__item table__row table__row-summary'>
        {reorder && <div className='player__item-action table__cell' />}
        <div className='player__item-name table__cell sticky__column'>
          Total
        </div>
        <div className='metric table__cell'>${baseSalaryTotal.toFixed(0)}</div>
        {!isOffseason && (
          <div className='metric table__cell'>${extendedSalaryTotal}</div>
        )}
        {isOffseason && (
          <div className='metric table__cell'>
            {projectedSalaryTotal ? `$${projectedSalaryTotal.toFixed(0)}` : '-'}
          </div>
        )}
        {isOffseason && (
          <div className='metric table__cell'>
            {savingsTotal ? `$${savingsTotal.toFixed(0)}` : '-'}
          </div>
        )}
        <div className='metric table__cell'>
          {valueTotal ? valueTotal.toFixed(1) : '-'}
        </div>
        {isOffseason && (
          <div className='metric table__cell'>
            {valueAdjTotal ? valueAdjTotal.toFixed(1) : '-'}
          </div>
        )}
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {rosPointsTotal ? rosPointsTotal.toFixed(1) : '-'}
          </div>
        )}
        {constants.season.week > 0 && (
          <div className='metric table__cell'>
            {weekPointsTotal ? weekPointsTotal.toFixed(1) : '-'}
          </div>
        )}
        <div className='metric table__cell'>-</div>
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
  isBeforeExtensionDeadline: PropTypes.bool
}
