import React from 'react'
// import TextField from '@material-ui/core/TextField'

// import EditableAuctionBudget from '@components/editable-auction-budget'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import AuctionTargetHeader from '@components/auction-target-header'
import PlayerName from '@components/player-name'
import { constants } from '@common'

import './auction-targets.styl'

export default class AuctionTargets extends React.Component {
  render = () => {
    const {
      players,
      vbaseline,
      lineupPlayerIds,
      // lineupBudget,
      // lineupPoints,
      // lineupFeasible,
      team
    } = this.props
    const groups = {}
    for (const position of constants.positions) {
      if (!groups[position]) groups[position] = {}
      groups[position] = players.filter(p => p.pos1 === position)
    }

    const items = {}
    for (const position in groups) {
      if (!items[position]) items[position] = []
      const players = groups[position]
      for (const [index, player] of players.entries()) {
        const classNames = ['auction__targets-player']
        const rosterSlot = team.roster.get(player.player)
        if (rosterSlot) classNames.push('rostered')
        if (lineupPlayerIds.includes(player.player)) classNames.push('optimal')
        const cost = rosterSlot ? rosterSlot.value : player.getIn(['values', '0', vbaseline])

        const item = (
          <div className={classNames.join(' ')} key={index}>
            <div className='auction__targets-player-cost'>
              ${cost}
            </div>
            <PlayerName playerId={player.player} />
            <PlayerWatchlistAction playerId={player.player} />
          </div>
        )
        items[position].push(item)
      }
    }

    return (
      <div className='auction__targets'>
        <div className='auction__targets-head'>
          <div className='optimal__lineup-key'>Optimal Lineup</div>
        </div>
        <div className='auction__targets-body'>
          <div className='auction__targets-section'>
            <AuctionTargetHeader pos='QB' />
            <div className='empty'>
              {items.QB}
            </div>
          </div>
          <div className='auction__targets-section'>
            <AuctionTargetHeader pos='RB' />
            <div className='empty'>
              {items.RB}
            </div>
          </div>
          <div className='auction__targets-section'>
            <AuctionTargetHeader pos='WR' />
            <div className='empty'>
              {items.WR}
            </div>
          </div>
          <div className='auction__targets-section'>
            <AuctionTargetHeader pos='TE' />
            <div className='empty'>
              {items.TE}
            </div>
          </div>
          <div className='auction__targets-section'>
            <AuctionTargetHeader pos='K' />
            <div className='empty'>
              {items.K}
            </div>
          </div>
          <div className='auction__targets-section'>
            <AuctionTargetHeader pos='DST' />
            <div className='empty'>
              {items.DST}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
