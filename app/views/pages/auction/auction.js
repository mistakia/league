import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PageLayout from '@layouts/page'
import { useMediaQuery } from '@core/utils'
import AuctionTargets from '@components/auction-targets'
import AuctionStandingElections from '@components/auction-standing-elections'
import AuctionSettlementStatus from '@components/auction-settlement-status'
import AuctionBlockCalendar from '@components/auction-block-calendar'
import AuctionStatus from '@components/auction-status'
import AuctionTransactions from '@components/auction-transactions'

import './auction.styl'

// THE SIDE RAIL'S HEIGHT, PUBLISHED SO A FIXED CONTROL CAN CLEAR IT. Below
// 800px the rail stacks under the board and the floating menu button floats
// over its last row -- and the rail DOES NOT SCROLL, so a covered row cannot be
// moved out from under the button and is simply never readable. Measured at
// 768, 600 and 400 the rail is exactly its three rows with no slack anywhere in
// it, so there is no offset inside the rail that covers nothing; the button has
// to clear the rail entirely and sit over the board, which does scroll and
// where a floating button is what it does on every other page.
//
// MEASURED RATHER THAN A CONSTANT, for the same reason the pause banner is:
// the rail is 115px at 768 and 145px at 400, and the settlement status inside
// it names every team still to answer, so its wrap -- and the rail's height --
// grows with the league and has no single correct px value. ResizeObserver
// keeps it honest across re-wraps, elections arriving, and rotation.
//
// Follows --app-banner-height in league-pause-notice.js, including removing the
// property on unmount so a stale rail height cannot outlive the auction page.
const sync_side_height = (side) => {
  document.documentElement.style.setProperty(
    '--auction-side-height',
    `${side.offsetHeight}px`
  )
}

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
  const side_ref = useRef(null)

  useLayoutEffect(() => {
    const side = side_ref.current
    if (!side) return undefined

    sync_side_height(side)
    const observer = new ResizeObserver(() => sync_side_height(side))
    observer.observe(side)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--auction-side-height')
    }
  }, [is_hosted_league])

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
          <div className='auction__side' ref={side_ref}>
            {/* Never collapsible. The main state of the auction -- whose turn
                to nominate, or that a player is open or a block is running --
                has to be readable without opening anything, and this is the
                surface that carries it for the whole period. */}
            <AuctionStatus />
            {/* Never collapsible. It is one line, and in election mode it is
                the auction's only forcing function -- a manager has to see who
                the board is waiting on without opening anything. */}
            <AuctionSettlementStatus />
            {/* Discloses on request on every viewport, so it needs no
                remount keyed on the breakpoint the way its sibling does. */}
            <AuctionBlockCalendar />
            <AuctionStandingElections
              key={`standing-elections-${is_narrow}`}
              is_collapsible={is_narrow}
            />
            {/* Last in the rail: the auction's ledger rather than its current
                state, and the only panel here a manager reads backwards. Keyed
                on the breakpoint for the same reason its sibling is -- the
                Accordion reads `default_expanded` once, so it has to remount
                rather than stay open through a rotation into the phone
                layout. */}
            <AuctionTransactions
              key={`transactions-${is_narrow}`}
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
