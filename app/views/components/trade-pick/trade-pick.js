import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { ordinalSuffixOf } from '@core/utils'

import './trade-pick.styl'

export default class TradePick extends React.Component {
  render = () => {
    const { pick, league, teams, draft_value } = this.props
    let text = `${pick.year} - ${ordinalSuffixOf(pick.round)}`
    if (pick.pick) {
      const pickNum = pick.pick % league.num_teams || league.num_teams
      const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
      text = `${text} #${pick.pick} (${pickStr})`
    }

    const team = teams.get(pick.otid)
    text += ` (${team.abbrv})`

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
  league: PropTypes.object,
  teams: ImmutablePropTypes.map,
  draft_value: PropTypes.number
}
