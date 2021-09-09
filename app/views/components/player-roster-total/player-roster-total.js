import React from 'react'
import { List } from 'immutable'

import { Player, connect } from '@components/player'
import { constants, getExtensionAmount } from '@common'

class PlayerRosterTotal extends Player {
  render() {
    const { players, league, reorder } = this.props

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

    players.forEach((player) => {
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
      const projectedSalary = player.getIn(['market_salary', projectionType], 0)
      const savings = projectedSalary - extendedSalary

      baseSalaryTotal = baseSalaryTotal + (bid || value)
      extendedSalaryTotal = extendedSalaryTotal + extendedSalary
      projectedSalaryTotal = projectedSalaryTotal + projectedSalary
      savingsTotal = savingsTotal + savings
      valueTotal = valueTotal + player.getIn(['vorp', projectionType], 0)
      valueAdjTotal =
        valueAdjTotal + player.getIn(['vorp_adj', projectionType], 0)
      rosPointsTotal =
        rosPointsTotal + player.getIn(['points', projectionType, 'total'], 0)
      weekPointsTotal =
        weekPointsTotal + player.getIn(['points', `${week}`, 'total'], 0)
    })

    return (
      <div className='player__item table__row table__row-summary'>
        {reorder && <div className='player__item-action table__cell' />}
        <div className='player__item-name table__cell sticky__column'>
          Total
        </div>
        <div className='metric table__cell'>${baseSalaryTotal.toFixed(0)}</div>
        {<div className='metric table__cell'>${extendedSalaryTotal}</div>}
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

export default connect(PlayerRosterTotal)
