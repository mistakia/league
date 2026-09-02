import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import NFLTeamBye from '@components/nfl-team-bye'
import PlayerAge from '@components/player-age'
import PlayerName from '@components/player-name'

import './auction-nominated-player.styl'

// PlayerHeadshot derives its HEIGHT from the width it is given --
// `round(width * 70 / 96)` -- so a width is really a height here, and 96 is the
// only one that lands on the 70px the bid bar is tall. It was 180 and 150,
// which render 131px and 109px, and a MUI avatar does not clip: both spilled
// out of the bar and over the player board beneath it. The breakpoint is 799 to
// match auction-nominated-player.styl, which below that pulls the headshot out
// of the bar entirely into a 100px circle floated above it -- the one context
// where a crop larger than the bar is the point.
const BAR_HEADSHOT_WIDTH = 96
const FLOATED_HEADSHOT_WIDTH = 150

const getHeadshotWidth = () =>
  window.innerWidth > 799 ? BAR_HEADSHOT_WIDTH : FLOATED_HEADSHOT_WIDTH

export default function AuctionNominatedPlayer({
  player_map,
  auction_adjusted_salary
}) {
  const [headshot_width, set_headshot_width] = useState(getHeadshotWidth())
  const update = () => set_headshot_width(getHeadshotWidth())

  useEffect(() => {
    window.addEventListener('resize', update)
    return function cleanup() {
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className='auction__nominated-player'>
      <div className='nominated__player'>
        <PlayerName
          large
          player_map={player_map}
          headshot_width={headshot_width}
        />
      </div>
      <div className='nominated__player-details'>
        {/* TWO PRICES SIDE BY SIDE, and until now nothing in either label said
            which one moves. `Market` is the static preseason `market_salary`;
            the other is recomputed from the league's remaining cap money spread
            across the value still unrostered, so it changes as the auction
            proceeds. Both rendered as a bare dollar amount under a one-word
            label, and `Auction` -- on the auction screen, beside the auction's
            own bid -- named the surface rather than the number.

            It is NOT the current bid, which is a different number in this same
            bar, so `Current bid` and `Live bid` were both rejected: they would
            have named a real quantity that this field does not hold. `Live
            value` says the one thing that distinguishes it from `Market`. */}
        <div className='selected__player-header-item'>
          <label>Market</label>$
          {player_map.getIn(['market_salary', 'season'], 0)}
        </div>
        <div className='selected__player-header-item nominated__detail-live'>
          <label>Live value</label>${auction_adjusted_salary}
        </div>
        <div className='selected__player-header-item'>
          <label>Bye</label>
          <NFLTeamBye nfl_team={player_map.get('team')} />
        </div>
        <div className='selected__player-header-item'>
          <label>Age</label>
          <PlayerAge date={player_map.get('date_of_birth')} />
        </div>
      </div>
    </div>
  )
}

AuctionNominatedPlayer.propTypes = {
  player_map: ImmutablePropTypes.map,
  auction_adjusted_salary: PropTypes.number
}
