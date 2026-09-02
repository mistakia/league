import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import './auction-election-chip.styl'

/**
 * The viewing team's own election on one free agent row.
 *
 * Read-only and deliberately tiny. The board is 186 nominatable rows at 30px,
 * and without this a manager can only learn whether they already hold a ceiling
 * on a player by opening that player's drawer -- one at a time, across a board
 * they are scanning precisely to decide where to put the next one.
 *
 * A DECLINE IS NOT A $0 MAXIMUM, and this is the surface where the distinction
 * has to survive. "I will take them at $0" and "no thanks" are different
 * instructions -- the first is a live claim that wins uncontested under the
 * nomination-order tiebreak, the second ranks below every number -- and telling
 * them apart across several hundred players is the whole reason `maximum_bid`
 * is nullable rather than defaulted.
 *
 * Clicking opens the drawer, which is where auction-election-control lives.
 * Setting a maximum from a 30px row would put a write behind a target a
 * mis-tap can hit.
 */
export default function AuctionElectionChip({ election, select_player, pid }) {
  if (!election) return null

  const maximum_bid = election.get('maximum_bid')
  const is_declined = maximum_bid === null
  const settled_at = election.get('settled_at')

  const class_names = ['auction-election-chip']
  if (is_declined) class_names.push('declined')
  if (settled_at) class_names.push('settled')

  // The chip shows the STATED maximum, not the capped one -- the stated amount
  // is the instruction the manager gave and the one they will look for. But a
  // ceiling capped down to availableCap is the number that surprises them at
  // settlement, so the hover carries it rather than leaving it only in the
  // standing-elections panel.
  const build_title = () => {
    if (is_declined) return 'You declined this player. Click to revise.'
    if (election.get('is_capped')) {
      return `Your maximum is $${maximum_bid}, capped to $${election.get(
        'effective_maximum'
      )} by your available cap. Click to revise.`
    }
    return `Your maximum is $${maximum_bid}. Click to revise.`
  }

  return (
    <div
      className={class_names.join(' ')}
      onClick={() => select_player(pid)}
      title={build_title()}
    >
      {/* "pass", not "declined". The label is the chip's whole width, and the
          chip competes with the player name for a 264px row: "declined" needs
          58px against 35px for "$25", which made the decline chip the widest
          thing on the board and clipped its row's name by 62px. The hover title
          below still says "declined" in full, so the short label costs nothing
          a manager cannot recover. */}
      {is_declined ? 'pass' : `$${maximum_bid}`}
    </div>
  )
}

AuctionElectionChip.propTypes = {
  election: ImmutablePropTypes.map,
  select_player: PropTypes.func,
  pid: PropTypes.string
}
