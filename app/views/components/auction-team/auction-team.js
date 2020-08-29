import React from 'react'

import './auction-team.styl'

export default class AuctionTeam extends React.Component {
  render = () => {
    const {
      team, isConnected, isWinningBid, bid,
      isNominating, roster
    } = this.props

    const classNames = ['auction__team']
    if (!isConnected) {
      classNames.push('offline')
    }

    if (isNominating) {
      classNames.push('nominating')
    }

    if (isWinningBid) {
      classNames.push('winning')
    }

    const hasBid = bid !== null

    return (
      <div className={classNames.join(' ')}>
        <div className='auction__team-name'>{team.abbrv}</div>
        <div className='auction__team-cap'>${roster.availableCap}</div>
        {hasBid && <div className='auction__team-bid'>$ {bid}</div>}
      </div>
    )
  }
}
