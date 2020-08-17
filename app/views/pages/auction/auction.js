import React from 'react'
import { AutoSizer, List } from 'react-virtualized'

import PageLayout from '@layouts/page'
import SearchFilter from '@components/search-filter'
import AuctionTransaction from '@components/auction-transaction'
import AuctionPlayer from '@components/auction-player'
import AuctionTeam from '@components/auction-team'
import AuctionMainBid from '@components/auction-main-bid'
import AuctionTargets from '@components/auction-targets'
import AuctionPositionFilter from '@components/auction-position-filter'
import AuctionCommissionerControls from '@components/auction-commissioner-controls'

import './auction.styl'

export default function () {
  const { players, transactions, tids, playerId, vbaseline, isCommish } = this.props

  const sorted = players.sort((a, b) => {
    return b.getIn(['vorp', '0', vbaseline]) - a.getIn(['vorp', '0', vbaseline])
  }).toList()

  const transactionItems = []
  for (const [index, transaction] of transactions.entries()) {
    transactionItems.push(<AuctionTransaction key={index} transaction={transaction} />)
  }

  const playerRow = ({ index, key, ...params }) => {
    const player = sorted.get(index)
    return (
      <AuctionPlayer key={key} player={player} {...params} index={index} />
    )
  }

  const teamItems = []
  for (const [index, tid] of tids.entries()) {
    teamItems.push(<AuctionTeam key={index} tid={tid} />)
  }

  const body = (
    <div className='auction'>
      <div className='auction__players'>
        <div className='auction__players-header'>
          <SearchFilter search={this.props.search} value={this.props.searchValue} />
          <AuctionPositionFilter />
        </div>
        <div className='auction__players-body'>
          <AutoSizer>
            {({ height, width }) => (
              <List
                width={width}
                height={height}
                rowHeight={25}
                rowCount={sorted.size}
                rowRenderer={playerRow}
              />
            )}
          </AutoSizer>
        </div>
      </div>
      <div className='auction__main'>
        <AuctionMainBid playerId={playerId} />
        <div className='auction__teams'>
          {teamItems}
        </div>
        <div className='auction__main-board'>
          <AuctionTargets />
        </div>
      </div>
      <div className='auction__log empty'>
        {transactionItems}
      </div>
      {isCommish && <AuctionCommissionerControls />}
    </div>
  )

  return (
    <PageLayout body={body} />
  )
}
