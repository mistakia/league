import { Set } from 'immutable'
import React from 'react'
import TextField from '@material-ui/core/TextField'

import EditableAuctionBudget from '@components/editable-auction-budget'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PlayerName from '@components/player-name'
import { constants } from '@common'

import './auction-targets.styl'

export default class AuctionTargets extends React.Component {
  render = () => {
    const { players, vbaseline, lineupPlayerIds, lineupPlayers, lineupPoints } = this.props
    const all = Set(players).union(Set(lineupPlayers))
    const sorted = all.sort((a, b) => b.vorp.get(vbaseline) - a.vorp.get(vbaseline))
    const groups = {}
    for (const position of constants.positions) {
      if (!groups[position]) groups[position] = {}
      groups[position] = sorted.filter(p => p.pos1 === position)
    }

    const items = {}
    for (const position in groups) {
      if (!items[position]) items[position] = []
      const players = groups[position]
      for (const [index, player] of players.entries()) {
        const classNames = ['auction__targets-player']
        if (lineupPlayerIds.includes(player.player)) classNames.push('optimal')
        const item = (
          <div className={classNames.join(' ')} key={index}>
            <div className='auction__targets-player-cost'>
              ${player.values.get(vbaseline)}
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
          <EditableAuctionBudget />
          {lineupPoints &&
            <TextField
              className='auction__targets-player-meta'
              label='Projected Points'
              value={lineupPoints}
              disabled
              margin='dense'
              size='small'
              variant='outlined'
            />}
          <div className='optimal__lineup-key'>Optimal Lineup</div>
        </div>
        <div className='auction__targets-body'>
          <div className='auction__targets-section'>
            {items.QB}
          </div>
          <div className='auction__targets-section'>
            {items.RB}
          </div>
          <div className='auction__targets-section'>
            {items.WR}
          </div>
          <div className='auction__targets-section'>
            {items.TE}
          </div>
          <div className='auction__targets-section'>
            {items.K}
          </div>
          <div className='auction__targets-section'>
            {items.DST}
          </div>
        </div>
      </div>
    )
  }
}
