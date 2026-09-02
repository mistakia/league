import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PageLayout from '@layouts/page'
import { useMediaQuery } from '@core/utils'
import AuctionTargets from '@components/auction-targets'
import AuctionStandingElections from '@components/auction-standing-elections'
import AuctionSettlementStatus from '@components/auction-settlement-status'
import AuctionBlockCalendar from '@components/auction-block-calendar'

import './auction.styl'

export default function AuctionPage({
  transactions,
  load_all_players,
  load_league,
  load_rosters,
  load_auction_elections,
  load_auction_blocks,
  teamId,
  is_team_in_league,
  is_hosted_league
}) {
  const { lid } = useParams()
  // Matches the 800px breakpoint auction.styl stacks the side rail at. The two
  // tall panels collapse there and stay open on a desktop rail, and the flag is
  // a KEY on each so the Accordion -- which owns its open state and reads
  // `default_expanded` once -- remounts rather than keeping a desktop-open
  // panel open after a rotation into the phone layout.
  const is_narrow = useMediaQuery('(max-width: 800px)')

  useEffect(() => {
    load_league()
    load_all_players()
    load_rosters(lid)
  }, [load_all_players, load_league, load_rosters, lid])

  // Elections arrive over REST rather than the socket, because they are
  // accepted for the whole free agency period rather than only while a player
  // is open. The socket join is a separate, narrower thing that belongs to live
  // blocks.
  // THE PAIR HAS TO BE CONSISTENT, and briefly it is not. `leagueId` comes from
  // the ROUTE while `teamId` comes from app state, and AUTH_FULFILLED adopts
  // the user's FIRST league's team -- so for a manager whose first league is not
  // the one on screen, this fired once with another league's team against this
  // league's id. `verifyUserTeam` answers 400 `invalid leagueId` and the api
  // saga turns every 400 into a red error toast, so the auction page greeted
  // those managers with a failure notice on every load.
  //
  // Waiting for `teamId` to be a team OF THIS LEAGUE is the condition that
  // actually holds: comparing app.leagueId to the route does not, because the
  // league moves to the one on screen before the team does.
  useEffect(() => {
    if (!teamId || !is_team_in_league) return
    load_auction_elections({ leagueId: lid, teamId })
  }, [load_auction_elections, lid, teamId, is_team_in_league])

  // The block schedule is NOT gated on teamId: opt-ins are public and the
  // convened blocks and the computed final block are facts about the auction
  // rather than about one team, so every viewer gets them.
  useEffect(() => {
    load_auction_blocks({ leagueId: lid })
  }, [load_auction_blocks, lid])

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
            {/* Never collapsible. It is one line, and in election mode it is
                the auction's only forcing function -- a manager has to see who
                the board is waiting on without opening anything. */}
            <AuctionSettlementStatus />
            <AuctionBlockCalendar
              key={`block-calendar-${is_narrow}`}
              is_collapsible={is_narrow}
            />
            <AuctionStandingElections
              key={`standing-elections-${is_narrow}`}
              is_collapsible={is_narrow}
            />
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
  load_auction_blocks: PropTypes.func,
  teamId: PropTypes.number,
  is_team_in_league: PropTypes.bool,
  is_hosted_league: PropTypes.bool
}
