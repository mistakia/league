import React from 'react'

import { Player, connect } from '@components/player'
import { getExtensionAmount } from '@core/utils'
import { constants } from '@common'

class PlayerRosterTotal extends Player {
  render() {
    const { players, league } = this.props

    const week = Math.max(constants.season.week, 1)

    let baseSalaryTotal = 0
    let extendedSalaryTotal = 0
    let projectedSalaryTotal = 0
    let savingsTotal = 0
    let valueTotal = 0
    let valueAdjTotal = 0
    let rosPointsTotal = 0
    let weekPointsTotal = 0

    players.forEach((player) => {
      const extensions = player.get('extensions').size
      const { pos, tag, value } = player
      const extendedSalary = getExtensionAmount({
        pos,
        tag,
        extensions,
        league,
        value
      })
      const projectedSalary = player.getIn(['values', 'ros', 'default'], 0)
      const savings = projectedSalary - extendedSalary

      baseSalaryTotal = baseSalaryTotal + value
      extendedSalaryTotal = extendedSalaryTotal + extendedSalary
      projectedSalaryTotal = projectedSalaryTotal + projectedSalary
      savingsTotal = savingsTotal + savings
      valueTotal = valueTotal + player.getIn(['vorp', 'ros', 'default'], 0)
      valueAdjTotal =
        valueAdjTotal + player.getIn(['vorp_adj', 'ros', 'default'], 0)
      rosPointsTotal =
        rosPointsTotal + player.getIn(['points', 'ros', 'total'], 0)
      weekPointsTotal =
        weekPointsTotal + player.getIn(['points', `${week}`, 'total'], 0)
    })

    return (
      <div className='player__item table__row table__row-summary'>
        <div className='player__item-name table__cell sticky__column'>
          Total
        </div>
        <div className='metric table__cell'>${baseSalaryTotal.toFixed(0)}</div>
        <div className='metric table__cell'>${extendedSalaryTotal}</div>
        <div className='metric table__cell'>
          {projectedSalaryTotal ? `$${projectedSalaryTotal.toFixed(0)}` : '-'}
        </div>
        <div className='metric table__cell'>
          {savingsTotal ? `$${savingsTotal.toFixed(0)}` : '-'}
        </div>
        <div className='metric table__cell'>
          {valueTotal ? valueTotal.toFixed(1) : '-'}
        </div>
        <div className='metric table__cell'>
          {valueAdjTotal ? valueAdjTotal.toFixed(1) : '-'}
        </div>
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
