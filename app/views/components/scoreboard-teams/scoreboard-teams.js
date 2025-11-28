import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'
import { Scoreboard } from '@core/scoreboard'

import './scoreboard-teams.styl'
import { current_season, matchup_types } from '@constants'

function Team({ tid, onClick, selected_tid, cutoff, challenger }) {
  const classNames = ['scoreboard__teams-team', 'cursor']
  if (tid === selected_tid) classNames.push('selected')
  return (
    <div className={classNames.join(' ')} onClick={() => onClick(tid)}>
      <ScoreboardScoreTeam
        tid={tid}
        type={matchup_types.TOURNAMENT}
        {...{ cutoff, challenger }}
      />
    </div>
  )
}

Team.propTypes = {
  tid: PropTypes.number,
  onClick: PropTypes.func,
  selected_tid: PropTypes.number,
  cutoff: PropTypes.number,
  challenger: PropTypes.number
}

export default function ScoreboardTeams({
  onClick,
  selected_tid,
  scoreboards,
  week,
  teams
}) {
  const [show_other_teams, set_show_other_teams] = useState(false)

  const isWC = week === current_season.wildcardWeek
  const sorted = scoreboards.sort((a, b) => b.points - a.points)
  const cutoff = isWC
    ? sorted.get(1, new Scoreboard()).points
    : sorted.get(0, new Scoreboard()).points
  const challenger = isWC
    ? sorted.get(2, new Scoreboard()).points
    : sorted.get(1, new Scoreboard()).points

  // Get tids from scoreboards
  const scoreboard_tids = new Set(sorted.map((board) => board.tid))

  // Calculate other teams (teams not in scoreboards)
  const other_teams_tids = teams
    .filter((team) => !scoreboard_tids.has(team.get('uid')))
    .map((team) => team.get('uid'))

  const items = []
  for (const [index, scoreboard] of sorted.entries()) {
    const { tid } = scoreboard
    items.push(
      <Team
        key={index}
        {...{ tid, selected_tid, onClick, cutoff, challenger }}
      />
    )
  }

  const other_teams_items = []
  for (const [index, tid] of other_teams_tids.entries()) {
    other_teams_items.push(
      <Team
        key={`other-${index}`}
        {...{ tid, selected_tid, onClick, cutoff: 0, challenger: 0 }}
      />
    )
  }

  return (
    <div className='scoreboard__teams-container'>
      <div className='scoreboard__teams'>{items}</div>
      <div className='scoreboard__other-teams-container'>
        <div
          className='scoreboard__other-teams-toggle cursor'
          onClick={() => set_show_other_teams(!show_other_teams)}
        >
          {show_other_teams ? 'Hide Teams' : 'Show All Teams'}
        </div>
        {show_other_teams && (
          <div className='scoreboard__other-teams'>{other_teams_items}</div>
        )}
      </div>
    </div>
  )
}

ScoreboardTeams.propTypes = {
  onClick: PropTypes.func,
  selected_tid: PropTypes.number,
  week: PropTypes.number,
  scoreboards: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.list
}
