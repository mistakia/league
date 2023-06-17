import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'

import { nth } from '@libs-shared'

import PlayerName from '@components/player-name'

import './scoreboard-play.styl'

export default class ScoreboardPlay extends React.Component {
  render = () => {
    const { play, style } = this.props

    const players = []
    for (const [pid, points] of Object.entries(play.points)) {
      players.push(
        <div key={pid} className='scoreboard__play-player'>
          <div className='scoreboard__play-player-name'>
            <PlayerName pid={pid} />
          </div>
          <div className='scoreboard__play-player-points metric'>
            {points.total.toFixed(1)}
          </div>
        </div>
      )
    }

    const classNames = ['scoreboard__play']
    if (play.play.score_type === 'TD') classNames.push('td')

    return (
      <div className={classNames.join(' ')} style={style}>
        <div className='scoreboard__play-info'>
          <div className='scoreboard__play-info-time'>
            {dayjs.unix(play.time).format('ddd h:mm')}
          </div>
          <div className='scoreboard__play-info-play'>
            {play.play.dwn}
            {nth(play.play.dwn)} & {play.play.ytg} - {play.play.ydl_start}
          </div>
        </div>
        <div className='scoreboard__play-description'>{play.play.desc}</div>
        <div className='scoreboard__play-players'>{players}</div>
      </div>
    )
  }
}

ScoreboardPlay.propTypes = {
  style: PropTypes.object,
  play: PropTypes.object
}
