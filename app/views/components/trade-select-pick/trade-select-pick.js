import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { ordinalSuffixOf } from '@core/utils'
import { Team } from '@core/teams'

import './trade-select-pick.styl'

export default class TradeSelectPick extends React.Component {
  render = () => {
    const { pick, isSelected, teams } = this.props

    let text = `${pick.year} - ${ordinalSuffixOf(pick.round)}`
    if (pick.pick) {
      text = `${text} #${pick.pick} (${pick.pick_str})`
    }

    const team = teams.get(pick.otid, new Team())
    if (team.name) {
      text += ` (${team.name})`
    }

    const classNames = ['trade__select-pick']
    if (isSelected) classNames.push('selected')

    return <div className={classNames.join(' ')}>{text}</div>
  }
}

TradeSelectPick.propTypes = {
  isSelected: PropTypes.bool,
  pick: PropTypes.object,
  teams: ImmutablePropTypes.map
}
