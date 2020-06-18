import React from 'react'

import PageLayout from '@layouts/page'
import AuctionTransaction from '@components/auction-transaction'
import AuctionPlayer from '@components/auction-player'
import AuctionMainBid from '@components/auction-main-bid'
import AuctionPositionFilter from '@components/auction-position-filter'

import './auction.styl'

export default function () {
  const { players, transactions } = this.props

  const sorted = players.sort((a, b) => b.vorp.get('available') - a.vorp.get('available')).toList()

  const transactionItems = []
  for (const [index, transaction] of transactions.entries()) {
    transactionItems.push(<AuctionTransaction key={index} transaction={transaction} />)
  }

  const playerItems = []
  for (const [index, player] of sorted.entries()) {
    playerItems.push(<AuctionPlayer key={index} player={player} index={index} />)
  }

  const body = (
    <div className='auction'>
      <div className='auction__players'>
        <div className='auction__players-header'>
          <AuctionPositionFilter />
        </div>
        <div className='auction__players-body'>
          {playerItems}
        </div>
      </div>
      <div className='auction__main'>
        <AuctionMainBid />
        <div className='auction__main-board'></div>
      </div>
      <div className='auction__log'>
        {transactionItems}
      </div>
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
