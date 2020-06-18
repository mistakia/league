import React from 'react'

import { constants } from '@common'
import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'

import './auction-transaction.styl'

export default class AuctionTransaction extends React.Component {
  render = () => {
    const { transaction } = this.props
    return (
      <div className='auction__transaction'>
        <div className='auction__transaction-type'>
          {constants.transactionsDetail[transaction.type]}
        </div>
        <div className='auction__transaction-value'>
          ${transaction.value}
        </div>
        <div className='auction__transaction-player'>
          <PlayerName playerId={transaction.player} />
        </div>
        <div className='auction__transaction-team'>
          <TeamName tid={transaction.tid} />
        </div>
      </div>
    )
  }
}
