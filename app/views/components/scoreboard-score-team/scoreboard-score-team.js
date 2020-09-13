import React from 'react'

import TeamName from '@components/team-name'

import './scoreboard-score-team.styl'

export default class ScoreboardScoreTeam extends React.Component {
  render = () => {
    const { tid, scoreboard } = this.props
    return (
      <div className='scoreboard__score-team'>
        <TeamName tid={tid} />
        <div className='scoreboard__score-proj metric'>{scoreboard.projected.toFixed(1)}</div>
        <div className='scoreboard__score-score metric'>{scoreboard.points.toFixed(1)}</div>
      </div>
    )
  }
}
