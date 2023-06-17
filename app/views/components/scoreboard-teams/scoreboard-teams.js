import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'
import { constants } from '@libs-shared'
import { Scoreboard } from '@core/scoreboard'

import './scoreboard-teams.styl'

function Team({ tid, onClick, selected_tid, cutoff, challenger }) {
  const classNames = ['scoreboard__teams-team', 'cursor']
  if (tid === selected_tid) classNames.push('selected')
  return (
    <div className={classNames.join(' ')} onClick={() => onClick(tid)}>
      <ScoreboardScoreTeam
        tid={tid}
        type={constants.matchups.TOURNAMENT}
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

export default class ScoreboardTeams extends React.Component {
  render = () => {
    const { onClick, selected_tid, scoreboards, week } = this.props

    const isWC = week === constants.season.wildcardWeek
    const sorted = scoreboards.sort((a, b) => b.points - a.points)
    const cutoff = isWC
      ? sorted.get(1, new Scoreboard()).points
      : sorted.get(0, new Scoreboard()).points
    const challenger = isWC
      ? sorted.get(2, new Scoreboard()).points
      : sorted.get(1, new Scoreboard()).points
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

    return <div className='scoreboard__teams'>{items}</div>
  }
}

ScoreboardTeams.propTypes = {
  onClick: PropTypes.func,
  selected_tid: PropTypes.number,
  week: PropTypes.number,
  scoreboards: ImmutablePropTypes.list
}
