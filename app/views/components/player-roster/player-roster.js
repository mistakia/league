import React from 'react'

import PlayerNameExpanded from '@components/player-name-expanded'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import Icon from '@components/icon'
import { sortableHandle } from 'react-sortable-hoc'

const DragHandle = sortableHandle(() =>
  <div className='player__item-action reorder'>
    <Icon name='reorder' />
  </div>
)

class PlayerRoster extends Player {
  render () {
    const { player, vbaseline, selected, claim, reorder, isHosted } = this.props

    const isClaim = !!claim

    const classNames = ['player__item']
    if (selected === player.player) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        <div className='player__item-name'>
          <PlayerNameExpanded playerId={player.player} />
        </div>
        {isClaim &&
          <div className='player__item-name'>
            {claim.drop && <PlayerNameExpanded playerId={claim.drop} />}
          </div>}
        {isClaim &&
          <div className='player__item-metric'>
            {claim.bid && `$${claim.bid}`}
          </div>}
        <div className='player__item-metric'>
          {(player.getIn(['vorp', '0', vbaseline]) || 0).toFixed(1)}
        </div>
        <div className='player__item-metric'>
          {player.getIn(['lineups', 'starts'])}
        </div>
        <div className='player__item-metric'>
          {player.getIn(['lineups', 'sp'], 0).toFixed(1) || '--'}
        </div>
        <div className='player__item-metric'>
          {player.get(['lineups', 'bp'], 0).toFixed(1) || '--'}
        </div>
        <div className='player__item-action'>
          {!!isHosted && <IconButton small text onClick={this.handleContextClick} icon='more' />}
        </div>
        {reorder && <DragHandle />}
      </div>
    )
  }
}

export default connect(PlayerRoster)
