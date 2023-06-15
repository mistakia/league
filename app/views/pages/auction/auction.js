import React, { useEffect } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PageLayout from '@layouts/page'
import AuctionTransaction from '@components/auction-transaction'
import AuctionTeam from '@components/auction-team'
import AuctionMainBid from '@components/auction-main-bid'
import AuctionTargets from '@components/auction-targets'
import AuctionCommissionerControls from '@components/auction-commissioner-controls'

import './auction.styl'

export default function AuctionPage({
  transactions,
  tids,
  isCommish,
  isHosted,
  loadAllPlayers,
  join
}) {
  useEffect(() => {
    loadAllPlayers()
    join()
  }, [join, loadAllPlayers])

  useEffect(() => {
    const element = document.querySelector('.auction__team.winning')
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }, [transactions])

  const TransactionRow = ({ index, key, ...params }) => {
    const transaction = transactions.get(index)
    return (
      <AuctionTransaction key={key} transaction={transaction} {...params} />
    )
  }

  TransactionRow.propTypes = {
    index: PropTypes.number,
    key: PropTypes.number
  }

  const teamItems = []
  tids.forEach((tid, index) => {
    teamItems.push(<AuctionTeam key={index} tid={tid} />)
  })

  const body = (
    <div className='auction'>
      <div className='auction__menu'>
        <div className='auction__main-board'>
          <AuctionTargets />
        </div>
      </div>
      <div className='auction__header'>
        <AuctionMainBid />
        <div className='auction__teams'>{teamItems}</div>
      </div>
      {isCommish && isHosted ? <AuctionCommissionerControls /> : null}
    </div>
  )

  return <PageLayout body={body} />
}

AuctionPage.propTypes = {
  join: PropTypes.func,
  loadAllPlayers: PropTypes.func,
  transactions: ImmutablePropTypes.list,
  tids: ImmutablePropTypes.list,
  isCommish: PropTypes.bool,
  isHosted: PropTypes.bool
}
