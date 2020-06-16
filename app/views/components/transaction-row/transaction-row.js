import React from 'react'

import { constants } from '@common'
import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'
import Timestamp from '@components/timestamp'

import './transaction-row.styl'

export default class TransactionRow extends React.Component {
  render = () => {
    const { transaction, style } = this.props

    return (
      <div style={style}>
        <div className='transaction'>
          <div className='transaction__value'>
            ${transaction.value}
          </div>
          <div className='transaction__type'>
            {constants.transactionsDetail[transaction.type]}
          </div>
          <div className='transaction__player'>
            <PlayerName playerId={transaction.player} />
          </div>
          <div className='transaction__team'>
            <TeamName tid={transaction.tid} />
          </div>
          <div className='transaction__timestamp'>
            <Timestamp timestamp={transaction.timestamp} />
          </div>
        </div>
      </div>
    )
  }
}
