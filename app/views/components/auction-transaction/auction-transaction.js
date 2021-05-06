import React from 'react'
import AttachMoneyIcon from '@material-ui/icons/AttachMoney'
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline'

import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'

import './auction-transaction.styl'

export default class AuctionTransaction extends React.Component {
  render = () => {
    const { transaction, style } = this.props
    const isSigned = transaction.type === 7
    const icon = isSigned ? (
      <AddCircleOutlineIcon fontSize='small' />
    ) : (
      <AttachMoneyIcon fontSize='small' />
    )

    const classNames = ['auction__transaction']
    if (isSigned) classNames.push('signed')

    return (
      <div className={classNames.join(' ')} style={style}>
        <div className='auction__transaction-type'>{icon}</div>
        <div className='auction__transaction-value'>${transaction.value}</div>
        <div className='auction__transaction-player'>
          <PlayerName playerId={transaction.player} />
        </div>
        <div className='auction__transaction-team'>
          <TeamName tid={transaction.tid} abbrv />
        </div>
      </div>
    )
  }
}
