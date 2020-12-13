import React from 'react'

import TeamName from '@components/team-name'
import { constants } from '@common'

import './scoreboard-score-team.styl'

export default class ScoreboardScoreTeam extends React.Component {
  render = () => {
    const { tid, scoreboard, type, cutoff, challenger } = this.props
    const isAdvancing = scoreboard.points >= cutoff
    return (
      <div className='scoreboard__score-team'>
        <TeamName tid={tid} />
        {type === constants.matchups.TOURNAMENT && <div className='scoreboard__score-minutes metric'>{scoreboard.minutes + (scoreboard.minutes > 1 ? ' mins' : ' min')}</div>}
        <div className='scoreboard__score-proj metric'>{scoreboard.projected.toFixed(1)}</div>
        <div className='scoreboard__score-score metric'>{scoreboard.points.toFixed(1)}</div>
        {type === constants.matchups.TOURNAMENT &&
          <div className='scoreboard__score-diff metric'>
            {isAdvancing
              ? `+${(scoreboard.points - challenger).toFixed(1)}`
              : `-${(cutoff - scoreboard.points).toFixed(1)}`}
          </div>}
      </div>
    )
  }
}
