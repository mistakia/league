import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@mui/material/Tooltip'

import './player-auction-value.styl'

/**
 * ONE PRICE, NOT TWO, AND THE SECOND NUMBER IS THE DIFFERENCE BETWEEN THEM.
 *
 * Both surfaces that show an auction price used to show it twice: `Market`, the
 * static preseason `market_salary`, beside a second dollar amount that is that
 * same valuation re-priced against the cap money still unspent. Same size, same
 * weight, one word of label each, and nothing on either surface saying the two
 * were the SAME quantity measured twice. On the auction bar it was worse than
 * ambiguous -- `$7` under a label reading `Live value`, a few inches from the
 * bid controls, was taken for the current bid, which is a different number.
 *
 * So the pair collapses into a valuation and its inflation: the amount is what
 * the player is worth right now, the delta beside it is how far the auction has
 * carried that above the preseason figure, and the preseason figure moves into
 * the tooltip -- it is the BASELINE for the delta, not a competing price to bid
 * against. The delta is also the number neither surface ever showed and is the
 * actual bidding input: it says the room is paying over book, which is a fact
 * about the auction rather than about the player.
 *
 * `.selected__player-header-item` is the shared label-over-value item class,
 * carried here rather than by each caller, because every caller wants it -- the
 * auction bar's details group and the selected-player drawer header are the
 * same kind of row. `class_name` is for a caller that also wants its OWN
 * treatment on top; the auction bar boxes this item, and the box lives in
 * auction-nominated-player.styl where the rest of that bar's chrome is.
 */
export default function PlayerAuctionValue({
  auction_adjusted_salary,
  market_salary,
  class_name = ''
}) {
  const inflation = auction_adjusted_salary - market_salary
  const title =
    inflation === 0
      ? `Market value $${market_salary}, unchanged by auction inflation`
      : `Market value $${market_salary}, ${
          inflation > 0 ? 'up' : 'down'
        } $${Math.abs(inflation)} on auction inflation`

  return (
    <Tooltip title={title}>
      <div
        className={`selected__player-header-item player__auction-value ${class_name}`}
      >
        {/* `Market Value`, NOT `Value`. What this holds IS a market value --
            the preseason one re-priced against the cap money still unspent --
            and `Value` alone left the reader to guess whose value and of what.
            It also settles the thing the merge is for: the item that used to
            read `Market` beside this one is now THIS item, so the name it
            carried comes here rather than disappearing. */}
        <label>Market Value</label>
        <div className='player__auction-value-amounts'>
          <span className='player__auction-value-amount'>
            ${auction_adjusted_salary}
          </span>
          {inflation !== 0 && (
            <span
              className={`player__auction-value-inflation ${
                inflation > 0 ? 'over' : 'under'
              }`}
            >
              {inflation > 0 ? '+' : '-'}${Math.abs(inflation)}
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  )
}

PlayerAuctionValue.propTypes = {
  auction_adjusted_salary: PropTypes.number,
  market_salary: PropTypes.number,
  class_name: PropTypes.string
}
