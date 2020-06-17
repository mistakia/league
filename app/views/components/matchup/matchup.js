import React from 'react'

import TeamName from '@components/team-name'

import './matchup.styl'

export default class Matchup extends React.Component {
  render = () => {
    const { matchup } = this.props

    return (
      <div className='matchup'>
        <div className='matchup__week'>
          Week {matchup.week}
        </div>
        <div className='matchup__away'>
          <TeamName tid={matchup.aid} />
        </div>
        <div className='matchup__divider'>
          <div className='matchup__versus'>
            V
          </div>
        </div>
        <div className='matchup__home'>
          <TeamName tid={matchup.hid} />
        </div>
      </div>
    )
  }
}
