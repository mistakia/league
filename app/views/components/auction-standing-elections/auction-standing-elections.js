import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import PlayerName from '@components/player-name'
import { auction_election_outcome_display_names } from '#constants'

import './auction-standing-elections.styl'

/**
 * Every live election this team holds.
 *
 * The two numbers that matter are `availableSpace` and per-election capping.
 * Aggregate overcommitment is deliberately NOT flagged: summing several hundred
 * maximums exceeds a $200 cap almost always, the design permits it because the
 * effective maximum is min(stated, availableCap), and a warning that is always
 * on says nothing. What a manager can act on is which specific ceilings will be
 * capped down, and that roster space usually binds before dollars do.
 */
export default function AuctionStandingElections({
  standing_elections,
  availableCap,
  availableSpace
}) {
  const live = standing_elections.filter(
    (election) => !election.get('settled_at')
  )
  const maximums = live.filter(
    (election) => election.get('maximum_bid') !== null
  )
  const declines = live.filter(
    (election) => election.get('maximum_bid') === null
  )
  const settled = standing_elections.filter((election) =>
    Boolean(election.get('settled_at'))
  )

  const render_row = (election, index) => {
    const pid = election.get('pid')
    const maximum = election.get('maximum_bid')
    const is_capped = election.get('is_capped')
    const outcome = election.get('outcome')

    return (
      <div className='auction-standing-elections__row' key={`${pid}-${index}`}>
        <PlayerName pid={pid} />
        <div className='auction-standing-elections__amount'>
          {maximum === null ? 'Declined' : `$${maximum}`}
          {is_capped && (
            <span className='auction-standing-elections__capped'>
              {' '}
              capped to ${election.get('effective_maximum')}
            </span>
          )}
        </div>
        {outcome && (
          <div className='auction-standing-elections__outcome'>
            {auction_election_outcome_display_names[outcome] || outcome}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='auction-standing-elections'>
      <div className='auction-standing-elections__header'>
        <h3>Your elections</h3>
        <div>
          {availableSpace} open {availableSpace === 1 ? 'spot' : 'spots'}, $
          {availableCap} cap
        </div>
      </div>

      {!live.size && !settled.size && (
        <div className='auction-standing-elections__empty'>
          No elections yet. Open any free agent and set a maximum bid, or
          decline them, and it will be honored whenever they are nominated --
          including while you are away.
        </div>
      )}

      {Boolean(maximums.size) && (
        <div className='auction-standing-elections__group'>
          <label>Maximums ({maximums.size})</label>
          {maximums.toIndexedSeq().map(render_row)}
        </div>
      )}

      {Boolean(declines.size) && (
        <div className='auction-standing-elections__group'>
          <label>Declined ({declines.size})</label>
          {declines.toIndexedSeq().map(render_row)}
        </div>
      )}

      {Boolean(settled.size) && (
        <div className='auction-standing-elections__group'>
          <label>Settled ({settled.size})</label>
          {settled.toIndexedSeq().map(render_row)}
        </div>
      )}
    </div>
  )
}

AuctionStandingElections.propTypes = {
  standing_elections: ImmutablePropTypes.map,
  availableCap: PropTypes.number,
  availableSpace: PropTypes.number
}
