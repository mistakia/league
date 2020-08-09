import React from 'react'

import './auction-team.styl'

export default class AuctionTeam extends React.Component {
  render = () => {
    const { team, isConnected, isWinningBid, bid, isNominating } = this.props

    const classNames = ['auction__team']
    if (!isConnected) {
      classNames.push('offline')
    }

    if (isNominating) {
      classNames.push('nominating')
    }

    return (
      <div className={classNames.join(' ')}>
        <div className='auction__team-name'>{team.abbrv}</div>
        <div className='auction__team-cap'>${team.cap}</div>
        {isWinningBid &&
          <div className='auction__winning-bid'>${bid}</div>}
      </div>
    )
  }
}
