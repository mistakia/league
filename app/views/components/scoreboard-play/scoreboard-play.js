import React from 'react'

import { nth } from '@common'

import './scoreboard-play.styl'

export default class ScoreboardPlay extends React.Component {
  render = () => {
    const { play, style } = this.props

    return (
      <div className='scoreboard__play' style={style}>
        <div className='scoreboard__play-info'>
          {play.down}{nth(play.down)} & {play.yardsToGo} - {play.startYardLine}
        </div>
        <div className='scoreboard__play-description'>
          {play.playDescription}
        </div>
        <div className='scoreboard__play-player' />
      </div>
    )
  }
}
