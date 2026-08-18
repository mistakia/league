import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'

import './scoreboard-scores.styl'

export default function ScoreboardScores({
  select_matchup,
  matchups,
  selected
}) {
  const items = []
  for (const [index, matchup] of matchups.entries()) {
    const classNames = ['scoreboard__matchup cursor']
    if (matchup.matchup_id === selected) classNames.push('selected')
    items.push(
      <div
        key={index}
        className={classNames.join(' ')}
        onClick={() => select_matchup({ matchupId: matchup.matchup_id })}
      >
        <ScoreboardScoreTeam
          tid={matchup.away_team_id}
          week={matchup.week}
          year={matchup.season_year}
        />
        <ScoreboardScoreTeam
          tid={matchup.home_team_id}
          week={matchup.week}
          year={matchup.season_year}
        />
      </div>
    )
  }
  return <div className='scoreboard__scores'>{items}</div>
}

ScoreboardScores.propTypes = {
  select_matchup: PropTypes.func,
  matchups: ImmutablePropTypes.list,
  selected: PropTypes.number
}
