import React from 'react'

import { ordinalSuffixOf } from '@core/utils'

import './trade-select-pick.styl'

export default class TradeSelectPick extends React.Component {
  render = () => {
    const { pick, league, isSelected } = this.props

    let text = `${pick.year} - ${ordinalSuffixOf(pick.round)}`
    if (pick.pick) {
      const pickNum = (pick.pick % league.nteams) || league.nteams
      const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
      text = `${text} #${pick.pick} (${pickStr})`
    }

    const classNames = ['trade__select-pick']
    if (isSelected) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        {text}
      </div>
    )
  }
}
