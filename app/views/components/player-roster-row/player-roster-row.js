import React from 'react'

import Position from '@components/position'
import Team from '@components/team'

import './player-roster-row.styl'

export default class PlayerRosterRow extends React.Component {
  render = () => {
    const { player } = this.props

    return (
      <div className='roster__item'>
        <div className='roster__item-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='roster__item-name'>
          <span>{player.pname}</span>
          <Team team={player.team} />
        </div>
        <div className='roster__item-metric'>
        </div>
      </div>
    )
  }
}
