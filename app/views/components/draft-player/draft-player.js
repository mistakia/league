import React from 'react'

import Team from '@components/team'
import PlayerWatchlistAction from '@components/player-watchlist-action'

import './draft-player.styl'

export default class DraftPlayer extends React.Component {
  handleClick = () => {
    this.props.select(this.props.player.player)
  }

  render = () => {
    const { player, selected, isDrafted, index, vbaseline, watchlist } = this.props

    const classNames = ['player-draft__item']
    if (selected === player.player) {
      classNames.push('selected')
    }

    if (isDrafted) {
      classNames.push('drafted')
    } else if (watchlist.has(player.player)) {
      classNames.push('watchlist')
    }

    return (
      <div className={classNames.join(' ')} onClick={this.handleClick}>
        <div className='player-draft__item-action'>
          <PlayerWatchlistAction playerId={player.player} />
        </div>
        <div className='player-draft__item-index'>{index + 1}.</div>
        <div className='player-draft__item-name'>
          <span>{player.pname}</span><Team team={player.team} />
        </div>
        <div className='player-draft__item-metric'>
          ${Math.round(player.values.get(vbaseline))}
        </div>
      </div>
    )
  }
}
