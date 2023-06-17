import React from 'react'
import { Map } from 'immutable'
import { useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { constants } from '@libs-shared'
import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './matchup.styl'

export default function Matchup({ matchup, teams, rosters }) {
  const navigate = useNavigate()
  const home = teams.find((t) => t.uid === matchup.hid)
  const home_roster = rosters.getIn(
    [home.uid, constants.year, constants.week],
    new Map()
  )
  const home_baseline_projection = home_roster.getIn(
    ['lineups', `${matchup.week}`, 'baseline_total'],
    0
  )
  const away = teams.find((t) => t.uid === matchup.aid)
  const away_roster = rosters.getIn(
    [away.uid, constants.year, constants.week],
    new Map()
  )
  const away_baseline_projection = away_roster.getIn(
    ['lineups', `${matchup.week}`, 'baseline_total'],
    0
  )
  const handleClick = () =>
    navigate(
      `/leagues/${matchup.lid}/matchups/${matchup.year}/${matchup.week}/${matchup.uid}`
    )
  const formatSpread = (value) => (value > 0 ? `+${value}` : value)

  return (
    <div className='matchup' onClick={handleClick}>
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

Matchup.propTypes = {
  matchup: ImmutablePropTypes.record,
  teams: ImmutablePropTypes.map,
  rosters: ImmutablePropTypes.map
}
