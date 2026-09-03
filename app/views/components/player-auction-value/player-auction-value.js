import React from 'react'
import PropTypes from 'prop-types'

import Icon from '@components/icon'
import Tooltip from '@components/tooltip'

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
 * So the pair collapses into THREE ROWS: the label, the price, and a footnote
 * under it in small type reading `+$12 from $33`.
 *
 * THE FOOTNOTE NAMES ITS ORIGIN BECAUSE A BARE DELTA DID NOT. `$45 +$12` does
 * not say whether the two are to be added: read as "forty-five, and twelve more
 * of inflation on top" the player is worth fifty-seven, and read as
 * "forty-five, of which twelve is inflation" they are worth forty-five. Both
 * readings are available from the glyphs and the surface picked neither, so a
 * manager could be off by the whole delta in either direction -- on the one
 * screen where that number decides a bid. `from $33` closes it: the arithmetic
 * is stated rather than implied, and there is no third number for the pair to
 * suggest.
 *
 * The size is the other half of the same fix. On the price's own line and in
 * the price's own size, the delta was a second figure of equal standing; below
 * it, at or under the size of the label, it is unmistakably an annotation ON
 * the price rather than a companion to it.
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
        <label className='player__auction-value-label'>
          Market Value
          {/* THE ICON IS THE ONLY THING THAT SAYS THERE IS A TOOLTIP. The whole
              item is the hover target and always was, but a plain label and a
              number look like every other item in these rows, so nobody hovers
              -- the explanation was reachable and undiscoverable, which is the
              same as absent. `.icon` is `pointer-events none`, so the glyph
              does not need to be the trigger itself: the hover falls through to
              the item, which is where the Tooltip already sits. */}
          <Icon name='info-outline' className='player__auction-value-info' />
        </label>
        <div className='player__auction-value-amount'>
          ${auction_adjusted_salary}
        </div>
        {/* NOTHING WHEN THE TWO ARE EQUAL, because `+$0 from $7` beside `$7` is
            a line that says the auction has not moved this player, which is
            what an unannotated price already says.

            ITS OWN ROW, AT A SIZE BELOW THE LABEL'S. Beside the price it was a
            second figure competing with the subject, and it forced the price
            off centre -- the price now centres because it is alone on its line,
            which needs no grid. Under it and smaller, it reads as the footnote
            it is, and the extra room a full line gives is what lets it carry
            the MAGNITUDE as well as the origin: `+$12 from $33` says how far
            the auction has moved this player and from where, and neither number
            can be mistaken for something to add to the price above. */}
        {inflation !== 0 && (
          <div
            className={`player__auction-value-context ${
              inflation > 0 ? 'over' : 'under'
            }`}
          >
            {inflation > 0 ? '+' : '-'}${Math.abs(inflation)} from $
            {market_salary}
          </div>
        )}
      </div>
    </Tooltip>
  )
}

PlayerAuctionValue.propTypes = {
  auction_adjusted_salary: PropTypes.number,
  market_salary: PropTypes.number,
  class_name: PropTypes.string
}
