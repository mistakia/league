import React from 'react'

import Team from '@components/team'
import Position from '@components/position'
import PlayerWatchlistAction from '@components/player-watchlist-action'

import './auction-player.styl'

export default class AuctionPlayer extends React.Component {
  handleClick = () => {
    if (!this.props.isFreeAgent) {
      return
    }

    if (!this.props.isEligible) {
      return
    }

    if (this.props.nominatedPlayer) {
      return
    }

    this.props.select(this.props.player.player)
  }

  render = () => {
    const {
      index, player, isFreeAgent, isEligible, vbaseline, watchlist,
      style, valueType, selected, nominatedPlayer
    } = this.props

    const classNames = ['auction__player']
    if (!isFreeAgent) {
      classNames.push('signed')
    } else if (watchlist.has(player.player)) {
      classNames.push('watchlist')
    }

    if (selected === player.player || nominatedPlayer === player.player) {
      classNames.push('selected')
    }

    if (!isEligible) {
      classNames.push('ineligible')
    }

    return (
      <div style={style}>
        <div className={classNames.join(' ')} onClick={this.handleClick}>
          <div className='auction__player-action'>
            <PlayerWatchlistAction playerId={player.player} />
          </div>
          <div className='auction__player-index'>{index + 1}.</div>
          <div className='auction__player-position'>
            <Position pos={player.pos1} />
          </div>
          <div className='auction__player-name'>
            <span>{player.pname}</span><Team team={player.team} />
          </div>
          <div className='auction__player-metric'>
            ${Math.round(player.getIn(['values', valueType, vbaseline])) || '--'}
          </div>
        </div>
      </div>
    )
  }
}
