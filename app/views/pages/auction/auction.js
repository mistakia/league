import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PageLayout from '@layouts/page'
import AuctionTargets from '@components/auction-targets'
import AuctionStandingElections from '@components/auction-standing-elections'
import AuctionSettlementStatus from '@components/auction-settlement-status'

import './auction.styl'

export default function AuctionPage({
  transactions,
  load_all_players,
  load_league,
  load_rosters,
  load_auction_elections,
  teamId,
  is_hosted_league
}) {
  const { lid } = useParams()

  useEffect(() => {
    load_league()
    load_all_players()
    load_rosters(lid)
  }, [load_all_players, load_league, load_rosters, lid])

  // Elections arrive over REST rather than the socket, because they are
  // accepted for the whole free agency period rather than only while a player
  // is open. The socket join is a separate, narrower thing that belongs to live
  // blocks.
  useEffect(() => {
    if (!teamId) return
    load_auction_elections({ leagueId: lid, teamId })
  }, [load_auction_elections, lid, teamId])

  useEffect(() => {
    const element = document.querySelector('.auction__team.winning')
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }, [transactions])

  // In election mode the PAGE is the auction: the live bid bar is app-level
  // chrome that mounts for blocks, so everything a manager needs between blocks
  // has to be here.
  const body = (
    <div className='auction'>
      <div className='auction__menu'>
        <div className='auction__main-board'>
          <AuctionTargets />
        </div>
        {is_hosted_league && (
          <div className='auction__side'>
            <AuctionSettlementStatus />
            <AuctionStandingElections />
          </div>
        )}
      </div>
    </div>
  )

  return <PageLayout body={body} />
}

AuctionPage.propTypes = {
  load_all_players: PropTypes.func,
  transactions: ImmutablePropTypes.list,
  load_league: PropTypes.func,
  load_rosters: PropTypes.func,
  load_auction_elections: PropTypes.func,
  teamId: PropTypes.number,
  is_hosted_league: PropTypes.bool
}
