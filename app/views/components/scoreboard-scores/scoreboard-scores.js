import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'

import './scoreboard-scores.styl'

export default function ScoreboardScores({ select, matchups, selected }) {
  const items = []
  for (const [index, matchup] of matchups.entries()) {
    const classNames = ['scoreboard__matchup cursor']
    if (matchup.uid === selected) classNames.push('selected')
    items.push(
      <div
        key={index}
        className={classNames.join(' ')}
        onClick={() => select(matchup.uid)}
      >
        <ScoreboardScoreTeam tid={matchup.aid} />
        <ScoreboardScoreTeam tid={matchup.hid} />
      </div>
    )
  }
  return <div className='scoreboard__scores'>{items}</div>
}

ScoreboardScores.propTypes = {
  select: PropTypes.func,
  matchups: ImmutablePropTypes.list,
  selected: PropTypes.number
}
