import React from 'react'

import { ordinalSuffixOf } from '@core/utils'

import './trade-pick.styl'

export default class TradePick extends React.Component {
  render = () => {
    const { pick, league, isSelected, teams } = this.props
    let text = `${pick.year} - ${ordinalSuffixOf(pick.round)}`
    if (pick.pick) {
      const pickNum = (pick.pick % league.nteams) || league.nteams
      const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
      text = `${text} #${pick.pick} (${pickStr})`
    }

    const team = teams.get(pick.otid)
    text += ` (${team.abbrv})`

    const classNames = ['trade__pick']
    if (isSelected) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        {text}
      </div>
    )
  }
}
