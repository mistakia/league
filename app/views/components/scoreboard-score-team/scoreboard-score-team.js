import React from 'react'

import TeamName from '@components/team-name'

import './scoreboard-score-team.styl'

export default class ScoreboardScoreTeam extends React.Component {
  render = () => {
    const { tid, projectedScore } = this.props
    return (
      <div className='scoreboard__score-team'>
        <TeamName tid={tid} />
        <div className='scoreboard__score-proj metric'>{projectedScore.toFixed(1)}</div>
        <div className='scoreboard__score-score metric' />
      </div>
    )
  }
}
