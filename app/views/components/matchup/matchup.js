import React from 'react'

import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './matchup.styl'

export default class Matchup extends React.Component {
  render = () => {
    const { matchup, teams } = this.props

    const home = teams.find((t) => t.uid === matchup.hid)
    const away = teams.find((t) => t.uid === matchup.aid)

    return (
      <div className='matchup'>
        <div className='matchup__week'>Week {matchup.week}</div>
        <div className='matchup__body'>
          <div className='matchup__away'>
            <div
              className='matchup__banner'
              style={{
                backgroundColor: `#${away.pc}`
              }}
            />
            <div
              className='matchup__line'
              style={{
                backgroundColor: `#${away.ac}`
              }}
            />
            <TeamImage tid={matchup.aid} />
            <TeamName tid={matchup.aid} />
          </div>
          <div className='matchup__divider'>
            <div className='matchup__versus'>@</div>
          </div>
          <div className='matchup__home'>
            <div
              className='matchup__banner'
              style={{
                backgroundColor: `#${home.pc}`
              }}
            />
            <div
              className='matchup__line'
              style={{
                backgroundColor: `#${home.ac}`
              }}
            />
            <TeamName tid={matchup.hid} />
            <TeamImage tid={matchup.hid} />
          </div>
        </div>
      </div>
    )
  }
}
