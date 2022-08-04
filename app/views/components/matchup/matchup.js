import React from 'react'
import { Map } from 'immutable'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@common'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './matchup.styl'

export default class Matchup extends React.Component {
  render = () => {
    const { matchup, teams, rosters } = this.props

    const home = teams.find((t) => t.uid === matchup.hid)
    const home_roster = rosters.getIn(
      [home.uid, constants.season.week],
      new Map()
    )
    const home_baseline_projection = home_roster.getIn(
      ['lineups', `${matchup.week}`, 'baseline_total'],
      0
    )
    const away = teams.find((t) => t.uid === matchup.aid)
    const away_roster = rosters.getIn(
      [away.uid, constants.season.week],
      new Map()
    )
    const away_baseline_projection = away_roster.getIn(
      ['lineups', `${matchup.week}`, 'baseline_total'],
      0
    )

    const formatSpread = (value) => (value > 0 ? `+${value}` : value)

    return (
      <div className='matchup'>
        <div className='matchup__head'>
          <div className='matchup__col metric'>Spread</div>
        </div>
        <div className='matchup__away'>
          <div
            className='matchup__banner'
            style={{
              backgroundColor: `#${away.pc}`
            }}
          />
          <TeamImage tid={matchup.aid} />
          <TeamName tid={matchup.aid} />
          <div className='matchup__col metric'>
            {formatSpread(home_baseline_projection - away_baseline_projection)}
          </div>
        </div>
        <div className='matchup__home'>
          <div
            className='matchup__banner'
            style={{
              backgroundColor: `#${home.pc}`
            }}
          />
          <TeamImage tid={matchup.hid} />
          <TeamName tid={matchup.hid} />
          <div className='matchup__col metric'>
            {formatSpread(away_baseline_projection - home_baseline_projection)}
          </div>
        </div>
      </div>
    )
  }
}

Matchup.propTypes = {
  matchup: ImmutablePropTypes.record,
  teams: ImmutablePropTypes.map,
  rosters: ImmutablePropTypes.map
}
