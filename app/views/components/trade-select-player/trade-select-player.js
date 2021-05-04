import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
import { constants } from '@common'
import PlayerLabel from '@components/player-label'

import './trade-select-player.styl'

export default class TradeSelectPlayer extends React.Component {
  render = () => {
    const { player, isSelected } = this.props
    const classNames = ['trade__select-player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')}>
        <div className='player__name-position'>
          <Position pos={player.pos} />
        </div>
        <div className='player__name-main'>
          <span>{player.pname}</span>
          {(constants.season.year === player.draft_year) && <PlayerLabel label='R' type='rookie' description='Rookie' />}
          <Team team={player.team} />
        </div>
      </div>
    )
  }
}
