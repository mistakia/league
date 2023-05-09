import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { ordinalSuffixOf } from '@core/utils'

import './trade-select-pick.styl'

export default class TradeSelectPick extends React.Component {
  render = () => {
    const { pick, league, isSelected, teams } = this.props

    let text = `${pick.year} - ${ordinalSuffixOf(pick.round)}`
    if (pick.pick) {
      const pickNum = pick.pick % league.num_teams || league.num_teams
      const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
      text = `${text} #${pick.pick} (${pickStr})`
    }

    const team = teams.get(pick.otid)
    text += ` (${team.name})`

    const classNames = ['trade__select-pick']
    if (isSelected) classNames.push('selected')

    return <div className={classNames.join(' ')}>{text}</div>
  }
}

TradeSelectPick.propTypes = {
  isSelected: PropTypes.bool,
  pick: PropTypes.object,
  teams: ImmutablePropTypes.map,
  league: PropTypes.object
}
