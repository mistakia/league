import React from 'react'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'

import './scoreboard-scores.styl'

export default class ScoreboardScores extends React.Component {
  handleClick = (matchupId) => {
    this.props.select(matchupId)
  }

  render = () => {
    const { matchups, selected } = this.props

    const items = []
    for (const [index, matchup] of matchups.entries()) {
      const classNames = ['scoreboard__matchup cursor']
      if (matchup.uid === selected) classNames.push('selected')
      items.push(
        <div
          key={index}
          className={classNames.join(' ')}
          onClick={() => this.handleClick(matchup.uid)}
        >
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
