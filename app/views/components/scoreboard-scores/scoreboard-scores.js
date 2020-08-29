import React from 'react'

import TeamName from '@components/team-name'

import './scoreboard-scores.styl'

export default class ScoreboardScores extends React.Component {
  render = () => {
    const { matchups } = this.props

    const items = []
    for (const [index, matchup] of matchups.entries()) {
      items.push(
        <div key={index} className='scoreboard__matchup'>
          <div className='scoreboard__matchup-team'>
            <TeamName tid={matchup.aid} />
            <div className='scoreboard__matchup-score' />
          </div>
          <div className='scoreboard__matchup-team'>
            <TeamName tid={matchup.hid} />
            <div className='scoreboard__matchup-score' />
          </div>
        </div>
      )
    }
    return (
      <div className='scoreboard__scores'>
        {items}
      </div>
    )
  }
}
