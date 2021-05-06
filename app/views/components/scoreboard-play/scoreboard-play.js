import React from 'react'
import moment from 'moment'

import { nth } from '@common'

import PlayerName from '@components/player-name'

import './scoreboard-play.styl'

export default class ScoreboardPlay extends React.Component {
  render = () => {
    const { play, style } = this.props

    const players = []
    for (const [playerId, points] of Object.entries(play.points)) {
      players.push(
        <div key={playerId} className='scoreboard__play-player'>
          <div className='scoreboard__play-player-name'>
            <PlayerName playerId={playerId} />
          </div>
          <div className='scoreboard__play-player-points metric'>
            {points.total.toFixed(1)}
          </div>
        </div>
      )
    }

    const classNames = ['scoreboard__play']
    if (play.play.isBigPlay) classNames.push('big')
    if (play.play.scoringPlayType === 'TD') classNames.push('td')

    return (
      <div className={classNames.join(' ')} style={style}>
        <div className='scoreboard__play-info'>
          <div className='scoreboard__play-info-time'>
            {moment(play.time, 'X').format('ddd h:mm')}
          </div>
          <div className='scoreboard__play-info-play'>
            {play.play.down}
            {nth(play.play.down)} & {play.play.yardsToGo} -{' '}
            {play.play.startYardLine}
          </div>
        </div>
        <div className='scoreboard__play-description'>
          {play.play.playDescription}
        </div>
        <div className='scoreboard__play-players'>{players}</div>
      </div>
    )
  }
}
