import React from 'react'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'

import './scoreboard-scores.styl'

export default class ScoreboardScores extends React.Component {
  render = () => {
    const { matchups } = this.props

    const items = []
    for (const [index, matchup] of matchups.entries()) {
      items.push(
        <div key={index} className='scoreboard__matchup'>
          <ScoreboardScoreTeam tid={matchup.aid} />
          <ScoreboardScoreTeam tid={matchup.hid} />
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
