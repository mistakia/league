import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PageLayout from '@layouts/page'
// import AuctionTransaction from '@components/auction-transaction'
import AuctionTeam from '@components/auction-team'
import AuctionTargets from '@components/auction-targets'

import './auction.styl'

export default function AuctionPage({
  transactions,
  tids,
  loadAllPlayers,
  load_league,
  join,
  loadRosters
}) {
  const { lid } = useParams()

  useEffect(() => {
    load_league()
    loadAllPlayers()
    join()
    loadRosters(lid)
  }, [join, loadAllPlayers, load_league, loadRosters, lid])

  useEffect(() => {
    const element = document.querySelector('.auction__team.winning')
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }, [transactions])

  // TODO show auction transactions
  // const TransactionRow = ({ index, key, ...params }) => {
  //   const transaction = transactions.get(index)
  //   return (
  //     <AuctionTransaction key={key} transaction={transaction} {...params} />
  //   )
  // }

  // TransactionRow.propTypes = {
  //   index: PropTypes.number,
  //   key: PropTypes.number
  // }

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
    </div>
  )

  return <PageLayout body={body} />
}

AuctionPage.propTypes = {
  join: PropTypes.func,
  loadAllPlayers: PropTypes.func,
  transactions: ImmutablePropTypes.list,
  tids: ImmutablePropTypes.list,
  load_league: PropTypes.func,
  loadRosters: PropTypes.func
}
