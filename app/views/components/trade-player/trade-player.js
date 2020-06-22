import React from 'react'

import Position from '@components/position'
import Team from '@components/team'

import './trade-player.styl'

export default class TradePlayer extends React.Component {
  render = () => {
    const { player, handleClick, isSelected } = this.props
    const classNames = ['trade__player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')} onClick={handleClick}>
        <Position pos={player.pos1} />
        <div className='trade__player-name'>{player.name}</div>
        <Team team={player.team} />
      </div>
    )
  }
}
