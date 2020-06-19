import React from 'react'

import Team from '@components/team'
import Position from '@components/position'

import './auction-player.styl'

export default class AuctionPlayer extends React.Component {
  handleClick = () => {
    if (!this.props.isAvailable) {
      return
    }

    if (!this.props.isEligible) {

    }

    this.props.select(this.props.player.player)
  }

  render = () => {
    const { index, player, isAvailable, isEligible } = this.props

    const classNames = ['auction__player']
    if (!isAvailable) {
      classNames.push('signed')
    }

    if (!isEligible) {
      classNames.push('ineligible')
    }

    return (
      <div className={classNames.join(' ')} onClick={this.handleClick}>
        <div className='auction__player-index'>{index + 1}.</div>
        <div className='auction__player-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='auction__player-name'>
          <span>{player.pname}</span><Team team={player.team} />
        </div>
        <div className='auction__player-metric'>
          ${Math.round(player.values.get('available'))}
        </div>
      </div>
    )
  }
}
