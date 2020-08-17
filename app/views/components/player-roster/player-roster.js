import React from 'react'

import Position from '@components/position'
import Team from '@components/team'
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
  handleClick = (event) => {
    const { waiverId } = this.props
    this.handleContextClick(event, waiverId)
  }

  render () {
    const { player, vbaseline, selected, claim, reorder } = this.props

    const isClaim = !!claim

    const classNames = ['player__item']
    if (selected === player.player) classNames.push('selected')

    return (
      <div className={classNames.join(' ')}>
        <div className='player__item-position'>
          <Position pos={player.pos1} />
        </div>
        <div className='player__item-name'>
          <span>{player.pname}</span>
          <Team team={player.team} />
        </div>
        {isClaim &&
          <div className='player__item-name'>
            {claim.drop && <span>{claim.drop.pname}</span>}
            {claim.drop && <Team team={claim.drop.team} />}
          </div>}
        {isClaim &&
          <div className='player__item-metric'>
            {claim.bid && `$${claim.bid}`}
          </div>}
        <div className='player__item-metric'>
          {(player.vorp.getIn(['0', vbaseline]) || 0).toFixed(1)}
        </div>
        <div className='player__item-metric'>
          {player.lineups.starts}
        </div>
        <div className='player__item-metric'>
          {(player.lineups.sp || 0).toFixed(1) || '--'}
        </div>
        <div className='player__item-metric'>
          {(player.lineups.bp || 0).toFixed(1) || '--'}
        </div>
        <div className='player__item-action'>
          <IconButton small text onClick={this.handleClick} icon='more' />
        </div>
        {reorder && <DragHandle />}
      </div>
    )
  }
}

export default connect(PlayerRoster)
