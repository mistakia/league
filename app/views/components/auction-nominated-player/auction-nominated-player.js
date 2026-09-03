import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Tooltip from '@mui/material/Tooltip'

import PlayerName from '@components/player-name'

import './auction-nominated-player.styl'

// PlayerHeadshot derives its HEIGHT from the width it is given --
// `round(width * 70 / 96)` -- so a width is really a height here. 180 renders
// 131px in a 70px bar, and OVERFLOWING THE BAR IS THE POINT: the player's head
// rises out of the chrome onto the board above it, which is the one place on
// this screen the nominated player is the subject rather than a row. It goes
// UPWARD because `.player__name-headshot` aligns its contents `flex-end`, so
// the picture's feet stay on the bar's floor and the surplus goes out the top.
//
// THE SIZE MUST BE SET HERE, NOT IN THE STYLESHEET. PlayerHeadshot passes width
// and height to the avatar as an INLINE style, which outranks any rule short of
// `!important` -- so a CSS override of these looks perfectly reasonable, emits,
// and is silently ignored. Measured that way: the wrapper obeyed the stylesheet
// at 64px while the image inside stayed 150x109.
//
// 88 below the breakpoint, which renders 88x64. Narrow, the headshot sits
// INSIDE the bar in a 64px round window rather than overflowing it, because
// what sits above the bar there is the side rail, which does not scroll -- a
// covered row cannot be moved out from under the picture, so it is simply never
// readable. Above the breakpoint the thing above the bar is the player board,
// which scrolls, and the overflow costs nothing. 88 is the width whose derived
// height is exactly that 64px window, so the picture fills it and the crop
// takes 12px off either side instead of the top of the player's head.
//
// THE BREAKPOINT IS 1160, WHICH IS WHERE THE BAR IS A SINGLE ROW, and that is
// the only layout the large size means anything in. Overflowing needs something
// to overflow: at 1160 and up the bar is one 70px row with the scrolling board
// above it, so 131px of picture rises 61px out of the chrome. Below 1160 the bar
// STACKS into two rows and nothing overflows -- the picture just sits inside a
// taller box and DRIVES ITS HEIGHT. Measured with the large size in the stacked
// bar at 1024, the bar went to 177px against the 120px the chrome reserves, and
// the chrome overflowed its own band by 31px. So the size follows the bar's
// SHAPE, not the side rail: 1160 is the same boundary auction-main-bid.styl
// stacks at and page.styl reserves against.
const BAR_HEADSHOT_WIDTH = 180
const NARROW_HEADSHOT_WIDTH = 88

const getHeadshotWidth = () =>
  window.innerWidth > 1159 ? BAR_HEADSHOT_WIDTH : NARROW_HEADSHOT_WIDTH

export default function AuctionNominatedPlayer({
  player_map,
  auction_adjusted_salary
}) {
  const market_salary = player_map.getIn(['market_salary', 'season'], 0)
  const inflation = auction_adjusted_salary - market_salary

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
        {/* ONE PRICE, NOT TWO, AND THE SECOND NUMBER IS THE DIFFERENCE BETWEEN
            THEM. `Market` was the static preseason `market_salary` and `Live
            value` beside it was that same valuation re-priced against the cap
            money still unspent -- two dollar amounts, same size, same weight,
            one word of label each, and nothing on the surface saying they were
            the SAME quantity measured twice. Read cold beside the bar's own bid
            controls, `$7` under a label reading `Live value` was taken for the
            current bid, which is a different number a few inches to the right.

            So the pair collapses into a valuation and its inflation: `$7` is
            what the player is worth right now, `+$2` is how far the auction has
            carried it above the preseason figure, and the preseason figure
            itself moves into the tooltip -- it is the baseline for the delta,
            not a competing price to bid against. The delta is also the number
            that was never shown and is the actual bidding input: it says the
            room is paying over book, which is a fact about the auction rather
            than about the player.

            Collapsing two columns into one is worth width as well as clarity --
            see the note below on what the columns cost the name. */}
        <Tooltip
          title={
            inflation === 0
              ? `Market value $${market_salary}, unchanged by auction inflation`
              : `Market value $${market_salary}, ${
                  inflation > 0 ? 'up' : 'down'
                } $${Math.abs(inflation)} on auction inflation`
          }
        >
          <div className='selected__player-header-item nominated__detail-value'>
            <label>Value</label>
            <div className='nominated__detail-value-amounts'>
              <span className='nominated__detail-value-amount'>
                ${auction_adjusted_salary}
              </span>
              {inflation !== 0 && (
                <span
                  className={`nominated__detail-value-inflation ${
                    inflation > 0 ? 'over' : 'under'
                  }`}
                >
                  {inflation > 0 ? '+' : '-'}${Math.abs(inflation)}
                </span>
              )}
            </div>
          </div>
        </Tooltip>
        {/* NO `Bye` OR `Age`. Neither is a bidding input -- a bye week and an
            age do not change what a player is worth in the next thirty
            seconds, and both are on the player's own row in the board directly
            above this bar. What they cost is the thing this surface exists to
            name: the four of them wanted 284px of a player half that has 569px
            at 1440px and 233px at 1024px, and with the headshot at its full
            180px the shortfall came out of the PLAYER'S NAME, which rendered as
            "ADAM PREN". Two columns instead of four frees about 142px and the
            name is whole again from 1280px up; one column frees more still. */}
      </div>
    </div>
  )
}

AuctionNominatedPlayer.propTypes = {
  player_map: ImmutablePropTypes.map,
  auction_adjusted_salary: PropTypes.number
}
