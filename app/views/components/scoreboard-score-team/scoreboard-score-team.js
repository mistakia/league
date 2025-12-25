import React, { useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'

import './scoreboard-score-team.styl'
import { matchup_types } from '@constants'

export default function ScoreboardScoreTeam({
  tid,
  scoreboard,
  type,
  cutoff,
  challenger
}) {
  const is_advancing = useMemo(
    () => scoreboard.points >= cutoff,
    [scoreboard.points, cutoff]
  )

  const render_score_diff = useCallback(() => {
    if (type === matchup_types.TOURNAMENT) {
      return (
        <div className='scoreboard__score-diff metric'>
          {is_advancing
            ? `+${(scoreboard.points - challenger).toFixed(1)}`
            : `-${(cutoff - scoreboard.points).toFixed(1)}`}
        </div>
      )
    }
  }, [type, is_advancing, scoreboard.points, challenger, cutoff])

  const render_score_minutes = useCallback(() => {
    if (type === matchup_types.TOURNAMENT) {
      return (
        <div className='scoreboard__score-minutes'>
          {scoreboard.minutes && !isNaN(scoreboard.minutes)
            ? scoreboard.minutes + (scoreboard.minutes > 1 ? ' mins' : ' min')
            : ''}
        </div>
      )
    }
  }, [type, scoreboard.minutes])

  const render_optimal = useCallback(() => {
    if (type === matchup_types.TOURNAMENT) {
      return (
        <div className='scoreboard__score-optimal metric'>
          {scoreboard.optimal ? scoreboard.optimal.toFixed(0) : ''}
        </div>
      )
    }
  }, [type, scoreboard.optimal])

  return (
    <div className='scoreboard__score-team'>
      <TeamName tid={tid} year={scoreboard.matchup.year} />
      <div className='scoreboard__score-score metric'>
        {scoreboard.points ? scoreboard.points.toFixed(0) : ''}
      </div>
      <div className='scoreboard__score-proj metric'>
        {scoreboard.projected ? scoreboard.projected.toFixed(0) : ''}
      </div>
      {render_optimal()}
      {render_score_diff()}
      {render_score_minutes()}
    </div>
  )
}

ScoreboardScoreTeam.propTypes = {
  tid: PropTypes.number,
  scoreboard: PropTypes.object,
  type: PropTypes.number,
  cutoff: PropTypes.number,
  challenger: PropTypes.number
}
