import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import { ordinalSuffixOf } from '@core/utils'
import { Team } from '@core/teams'

import './trade-select-pick.styl'

export default class TradeSelectPick extends React.Component {
  render = () => {
    const { pick, isSelected, teams } = this.props

    if (!pick) {
      return null
    }

    const class_names = ['trade__select-pick']
    if (isSelected) {
      class_names.push('selected')
    }

    const team = teams.get(pick.otid, new Team())

    return (
      <div className={class_names.join(' ')}>
        <div className='pick__content'>
          <span className='pick__year'>{pick.year}</span>
          <span className='pick__round'>
            {ordinalSuffixOf(pick.round)} Round
          </span>
          {pick.pick && (
            <span className='pick__number'>
              #{pick.pick}
              {pick.pick_str && (
                <span className='pick__str'>({pick.pick_str})</span>
              )}
            </span>
          )}
          {team.name && <span className='pick__team'>{team.name}</span>}
        </div>
      </div>
    )
  }
}

TradeSelectPick.propTypes = {
  isSelected: PropTypes.bool,
  pick: PropTypes.object,
  teams: ImmutablePropTypes.map
}
