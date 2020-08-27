import React from 'react'
import Switch from '@material-ui/core/Switch'
import FormGroup from '@material-ui/core/FormGroup'
import FormControlLabel from '@material-ui/core/FormControlLabel'
// import TextField from '@material-ui/core/TextField'

// import EditableAuctionBudget from '@components/editable-auction-budget'
import AuctionValueTypeToggle from '@components/auction-value-type-toggle'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import AuctionTargetHeader from '@components/auction-target-header'
import PlayerName from '@components/player-name'
import { constants } from '@common'

import './auction-targets.styl'

export default class AuctionTargets extends React.Component {
  handleToggle = () => {
    this.props.toggleHideRostered()
  }

  render = () => {
    const {
      players,
      vbaseline,
      lineupPlayerIds,
      // lineupBudget,
      lineupPoints,
      lineupFeasible,
      valueType,
      rosteredPlayerIds,
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
        if (rosterSlot) classNames.push('signed')
        else if (rosteredPlayerIds.includes(player.player)) classNames.push('rostered')
        if (lineupPlayerIds.includes(player.player)) classNames.push('optimal')
        const salary = rosterSlot ? rosterSlot.value : player.getIn(['values', valueType, vbaseline])

        const item = (
          <div className={classNames.join(' ')} key={index}>
            <div className='auction__targets-player-salary'>
              ${salary}
            </div>
            <PlayerName playerId={player.player} />
            <PlayerWatchlistAction playerId={player.player} />
          </div>
        )
        items[position].push(item)
      }
    }

    const lineupText = lineupFeasible
      ? `Optimal Lineup ${lineupPoints || 0} Pts`
      : 'Not Feasible'

    return (
      <div className='auction__targets'>
        <div className='auction__targets-head'>
          <FormGroup>
            <FormControlLabel
              control={<Switch size='small' checked={this.props.hideRostered} onChange={this.handleToggle} />}
              labelPlacement='top'
              label='Hide Rostered'
            />
          </FormGroup>
          <AuctionValueTypeToggle />
          <div className='optimal__lineup-key'>{lineupText}</div>
        </div>
        <div className='auction__targets-body'>
          <div className='auction__targets-column'>
            <div className='auction__targets-section'>
              <AuctionTargetHeader pos='QB' />
              <div className='empty'>
                {items.QB}
              </div>
            </div>
            <div className='auction__targets-section'>
              <AuctionTargetHeader pos='TE' />
              <div className='empty'>
                {items.TE}
              </div>
            </div>
          </div>
          <div className='auction__targets-column'>
            <div className='auction__targets-section'>
              <AuctionTargetHeader pos='RB' />
              <div className='empty'>
                {items.RB}
              </div>
            </div>
            <div className='auction__targets-section'>
              <AuctionTargetHeader pos='K' />
              <div className='empty'>
                {items.K}
              </div>
            </div>
          </div>
          <div className='auction__targets-column'>
            <div className='auction__targets-section'>
              <AuctionTargetHeader pos='WR' />
              <div className='empty'>
                {items.WR}
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
      </div>
    )
  }
}
