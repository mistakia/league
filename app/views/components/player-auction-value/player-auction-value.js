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
 * So the pair collapses into ONE price and its ORIGIN: the amount is what the
 * player is worth right now, inflation already applied, and `from $5` beside it
 * is where that started.
 *
 * `from $5`, NOT `+$2`, AND THE DELTA FORM WAS AMBIGUOUS IN THE ONE WAY THAT
 * MATTERS AT A BID. `$7 +$2` does not say whether the two are to be added:
 * read as "seven, and two more of inflation on top" it makes the player worth
 * nine, and read as "seven, of which two is inflation" it makes them worth
 * seven. Both readings are available from the glyphs and the surface picked
 * neither, so a manager could be a dollar or two off in either direction with
 * no way to tell -- on the one screen where that number decides a bid.
 *
 * A baseline cannot be read that way. `$7 from $5` states the endpoint and the
 * origin, so the only arithmetic left is the subtraction the reader does not
 * have to do, and there is no third number for the pair to imply. It also keeps
 * the preseason figure ON the surface rather than in the tooltip, which is
 * where the merge had put it -- so `Market Value` names something the reader
 * can see the whole of, and the exact inflation is still spelled out in words
 * on hover for anyone who wants it.
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
          {/* NOTHING WHEN THE TWO ARE EQUAL. `from $7` beside `$7` is a line
              that says the auction has not moved this player, which is what an
              unannotated price already says. */}
          {inflation !== 0 && (
            <span
              className={`player__auction-value-baseline ${
                inflation > 0 ? 'over' : 'under'
              }`}
            >
              from ${market_salary}
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
