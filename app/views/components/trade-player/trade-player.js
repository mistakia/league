import React from 'react'

import PlayerName from '@components/player-name'

import './trade-player.styl'

export default class TradePlayer extends React.Component {
  render = () => {
    const { player, handleClick, isSelected } = this.props
    const classNames = ['trade__player']
    if (isSelected) classNames.push('selected')
    return (
      <div className={classNames.join(' ')} onClick={handleClick}>
        <PlayerName playerId={player.player} />
      </div>
    )
  }
}
