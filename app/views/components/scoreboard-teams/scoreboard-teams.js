import React from 'react'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'
import { constants } from '@common'

import './scoreboard-teams.styl'

function Team ({ tid, onClick, selected, cutoff, challenger }) {
  const classNames = ['scoreboard__teams-team', 'cursor']
  if (tid === selected) classNames.push('selected')
  return (
    <div className={classNames.join(' ')} onClick={() => onClick(tid)}>
      <ScoreboardScoreTeam
        tid={tid}
        type={constants.matchups.TOURNAMENT}
        {... { cutoff, challenger }}
      />
    </div>
  )
}

export default class ScoreboardTeams extends React.Component {
  render = () => {
    const { onClick, selected, scoreboards } = this.props

    const sorted = scoreboards.sort((a, b) => b.points - a.points)
    const cutoff = sorted[1].points
    const challenger = sorted[2].points
    const items = []
    for (const [index, scoreboard] of sorted.entries()) {
      const { tid } = scoreboard
      items.push(
        <Team key={index} {...{ tid, selected, onClick, cutoff, challenger }} />
      )
    }

    return (
      <div className='scoreboard__teams'>
        {items}
      </div>
    )
  }
}
