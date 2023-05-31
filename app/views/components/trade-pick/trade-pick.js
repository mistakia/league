import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { ordinalSuffixOf } from '@core/utils'
import { Team } from '@core/teams'

import './trade-pick.styl'

export default class TradePick extends React.Component {
  render = () => {
    const { pick, teams, draft_value } = this.props
    let text = `${pick.year} - ${ordinalSuffixOf(pick.round)}`
    if (pick.pick) {
      text = `${text} #${pick.pick} (${pick.pick_str})`
    }

    const team = teams.get(pick.otid, new Team())
    if (team.abbrv) {
      text += ` (${team.abbrv})`
    }

    return (
      <div className='trade__pick'>
        <div className='trade__player-name'>{text}</div>
        <div className='trade__player-metric metric'>
          <label>Val</label>
          {draft_value ? draft_value.toFixed(1) : 0}
        </div>
      </div>
    )
  }
}

TradePick.propTypes = {
  pick: PropTypes.object,
  teams: ImmutablePropTypes.map,
  draft_value: PropTypes.number
}
