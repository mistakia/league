import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'

import { nth } from '@libs-shared'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'

import './scoreboard-play.styl'

// Minimal player display for scoreboard context
// Uses inline rendering to avoid:
// 1. Redux connect() overhead per player in virtualized list
// 2. Production build closure issues with connected components in loops
function PlayerNameDisplay({ player_map }) {
  if (!player_map) {
    return null
  }
  return (
    <div className='player__name'>
      <div className='player__name-position'>
        <Position pos={player_map.get('pos')} />
      </div>
      <div className='player__name-main'>
        <div className='player__name-top'>
          <span>{player_map.get('pname')}</span>
        </div>
        <NFLTeam team={player_map.get('team')} />
      </div>
    </div>
  )
}

PlayerNameDisplay.propTypes = {
  player_map: PropTypes.object
}

export default class ScoreboardPlay extends React.Component {
  render = () => {
    const { play, style, playerMaps } = this.props

    // IMPORTANT: Use .map() instead of for...of + push() to avoid production build
    // optimization issues that cause props to be passed incorrectly
    const players = Object.entries(play.points).map(([pid, points]) => {
      const player_map = playerMaps.get(pid)
      return (
        <div
          key={`${play.play?.playId}-${pid}`}
          className='scoreboard__play-player'
        >
          <div className='scoreboard__play-player-name'>
            <PlayerNameDisplay player_map={player_map} />
          </div>
          <div className='scoreboard__play-player-points metric'>
            {points.total.toFixed(1)}
          </div>
        </div>
      )
    })

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
            {nth(play.play.dwn)} & {play.play.yards_to_go} -{' '}
            {play.play.ydl_start}
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
  play: PropTypes.object,
  playerMaps: PropTypes.object
}
