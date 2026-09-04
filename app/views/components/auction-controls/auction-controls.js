import React, { useEffect, useLayoutEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { Link } from 'react-router-dom'

import AuctionTeam from '@components/auction-team'
import AuctionMainBid from '@components/auction-main-bid'

import './auction-controls.styl'

// HOW TALL THE AUCTION CHROME ACTUALLY IS, published for everything that has to
// sit clear of it: the page's bottom margin, the floating menu button, and the
// commissioner controls above it. It was a pair of constants
// ($auctionHeightDesktop / $auctionHeightMobile) that four places re-derived and
// had to agree on.
//
// MEASURED RATHER THAN A CONSTANT, for the same reason --auction-side-height is
// in auction.js and --app-banner-height is in league-pause-notice.js: this box
// is not one height. Below 536px the bid bar's actions row cannot fit on one
// line -- it needs 535.1px flat -- so it wraps and the chrome grows past the
// 214px the constant reserved. A static reservation does not fail loudly there;
// `.auction__controls` is `position fixed`, so the surplus comes out of the team
// strip at the bottom of it and reads as a clipped chip row.
//
// The constants survive as the CSS fallback for the frame before this runs.
const sync_controls_height = (controls) => {
  document.documentElement.style.setProperty(
    '--auction-controls-height',
    `${controls.offsetHeight}px`
  )
}

export default function AuctionControls({
  tids,
  join,
  load_league,
  is_logged_in,
  auction_is_ended,
  league_id,
  league_name
}) {
  const controls_ref = useRef(null)

  useEffect(() => {
    load_league()
    if (is_logged_in && !auction_is_ended) {
      join()
    }
  }, [join, load_league, is_logged_in, auction_is_ended])

  // Removes the property on unmount so a stale chrome height cannot outlive the
  // auction, which would leave every other page reserving a band for chrome it
  // does not have. `is_logged_in` is a dependency because the early return below
  // means the ref is only attached once it is true.
  useLayoutEffect(() => {
    const controls = controls_ref.current
    if (!controls) return undefined

    sync_controls_height(controls)
    const observer = new ResizeObserver(() => sync_controls_height(controls))
    observer.observe(controls)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--auction-controls-height')
    }
  }, [is_logged_in])

  // TODO allow non logged in users to follow the auction
  if (!is_logged_in) {
    return null
  }

  const teamItems = []
  tids.forEach((tid, index) => {
    teamItems.push(<AuctionTeam key={index} tid={tid} />)
  })

  // WHAT THIS BAR IS, said on the bar itself. The chrome is a sibling of
  // <Routes /> rather than part of the auction page, so it is pinned to the
  // bottom of every route for the length of the free agency period -- the
  // standings, the player list, a public data view. Without a name on it, a bid
  // stepper and a countdown appear over an unrelated page with nothing saying
  // which league it belongs to or where the board is.
  //
  // The name is the route to the board too. Reaching the auction page from
  // here used to mean knowing it was under the league menu.
  const label = (
    <div className='auction__controls-label'>
      {league_id ? (
        <Link to={`/leagues/${league_id}/auction`}>Free Agency Auction</Link>
      ) : (
        <span>Free Agency Auction</span>
      )}
      {Boolean(league_name) && (
        <span className='auction__controls-label-league'>{league_name}</span>
      )}
    </div>
  )

  return (
    <div className='auction__controls' ref={controls_ref}>
      {label}
      <AuctionMainBid />
      {Boolean(teamItems.length) && (
        <div className='auction__teams'>{teamItems}</div>
      )}
    </div>
  )
}

AuctionControls.propTypes = {
  tids: ImmutablePropTypes.list,
  join: PropTypes.func,
  load_league: PropTypes.func,
  is_logged_in: PropTypes.bool,
  auction_is_ended: PropTypes.bool,
  league_id: PropTypes.number,
  league_name: PropTypes.string
}
