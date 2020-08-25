import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'

import './player-name.styl'

export default class PlayerName extends React.Component {
  render = () => {
    const { player } = this.props

    return (
      <div className='player__name'>
        <div className='player__name-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='player__name-main'>
          <span>{player.pname}</span>
          {(constants.season.year === player.draft_year) &&
            <sup className='player__label-rookie'>
              R
            </sup>}
          <Team team={player.team} />
        </div>
      </div>
    )
  }
}
