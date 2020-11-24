import React from 'react'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'

import './scoreboard-teams.styl'

function Team ({ team, onClick, selected }) {
  const classNames = ['scoreboard__teams-team', 'cursor']
  if (team.uid === selected) classNames.push('selected')
  return (
    <div className={classNames.join(' ')} onClick={() => onClick(team.uid)}>
      <ScoreboardScoreTeam tid={team.uid} />
    </div>
  )
}

export default class ScoreboardTeams extends React.Component {
  render = () => {
    const { teams, onClick, selected } = this.props

    const items = []
    for (const [index, team] of teams.entries()) {
      items.push(
        <Team key={index} {...{ team, selected, onClick }} />
      )
    }

    return (
      <div className='scoreboard__teams'>
        {items}
      </div>
    )
  }
}
