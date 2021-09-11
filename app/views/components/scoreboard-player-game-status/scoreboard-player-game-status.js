import React from 'react'
import PropTypes from 'prop-types'

import './scoreboard-player-game-status.styl'

export default class ScoreboardPlayerGameStatus extends React.Component {
  render = () => {
    const { status } = this.props
    const classNames = ['scoreboard__player-game-status']
    if (status && status.hasPossession) classNames.push('possession')
    if (status && status.isRedzone) classNames.push('redzone')

    return (
      <div className={classNames.join(' ')}>
        <div className='scoreboard__player-game-status-yardline-container'>
          <div
            className='scoreboard__player-game-status-yardline'
            style={{
              width: status ? `${status.yardline || 0}%` : '0%'
            }}
          />
        </div>
      </div>
    )
  }
}

ScoreboardPlayerGameStatus.propTypes = {
  status: PropTypes.object
}
