import React from 'react'

import TeamName from '@components/team-name'
import TeamImage from '@components/team-image'

import './matchup.styl'

export default class Matchup extends React.Component {
  render = () => {
    const { matchup } = this.props

    return (
      <div className='matchup'>
        <div className='matchup__week'>
          Week {matchup.week}
        </div>
        <div className='matchup__body'>
          <div className='matchup__away'>
            <TeamName tid={matchup.aid} />
            <TeamImage tid={matchup.aid} />
          </div>
          <div className='matchup__divider'>
            <div className='matchup__versus'>
              @
            </div>
          </div>
          <div className='matchup__home'>
            <TeamImage tid={matchup.hid} />
            <TeamName tid={matchup.hid} />
          </div>
        </div>
      </div>
    )
  }
}
