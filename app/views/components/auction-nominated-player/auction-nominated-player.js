import React from 'react'

import PlayerName from '@components/player-name'

import './auction-nominated-player.styl'

export default class AuctionNominatedPlayer extends React.Component {
  render = () => {
    const { player, vbaseline, valueType } = this.props

    const inflationType = valueType === 'ros' ? 'inflation' : 'inflationSeason'

    return (
      <div className='auction__nominated-player'>
        <PlayerName playerId={player.player} />
        <div className='nominated__player-details'>
          <div className='nominated__player-detail'>
            Retail: ${player.getIn(['values', valueType, vbaseline], 0)}
          </div>
          <div className='nominated__player-detail'>
            Inflation: ${player.getIn(['values', inflationType, vbaseline], 0)}
          </div>
        </div>
      </div>
    )
  }
}
