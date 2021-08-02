import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import ScoreboardScoreTeam from '@components/scoreboard-score-team'
import { constants } from '@common'

import './scoreboard-teams.styl'

function Team({ tid, onClick, selected, cutoff, challenger }) {
  const classNames = ['scoreboard__teams-team', 'cursor']
  if (tid === selected) classNames.push('selected')
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
  selected: PropTypes.number,
  cutoff: PropTypes.number,
  challenger: PropTypes.number
}

export default class ScoreboardTeams extends React.Component {
  render = () => {
    const { onClick, selected, scoreboards, week } = this.props

    const isWC = week === 14
    const sorted = scoreboards.sort((a, b) => b.points - a.points)
    const cutoff = isWC ? sorted[1].points : sorted[0].points
    const challenger = isWC ? sorted[2].points : sorted[1].points
    const items = []
    for (const [index, scoreboard] of sorted.entries()) {
      const { tid } = scoreboard
      items.push(
        <Team key={index} {...{ tid, selected, onClick, cutoff, challenger }} />
      )
    }

    return <div className='scoreboard__teams'>{items}</div>
  }
}

ScoreboardTeams.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.number,
  week: PropTypes.number,
  scoreboards: ImmutablePropTypes.list
}
