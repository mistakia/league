import React from 'react'

import { Roster } from '@common'

import './auction-team.styl'

export default class AuctionTeam extends React.Component {
  render = () => {
    const {
      team, isConnected, isWinningBid, bid,
      isNominating, rosterRow, league
    } = this.props

    const r = new Roster({ roster: rosterRow, league })

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
        <div className='auction__team-cap'>${r.availableCap}</div>
        {hasBid && <div className='auction__team-bid'>$ {bid}</div>}
      </div>
    )
  }
}
