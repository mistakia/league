import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Button from '@components/button'

/**
 * Set, raise, withdraw or decline an election on one player.
 *
 * ONE control, reused. Its home is the selected-player drawer header, which is
 * reachable from every player list in the app -- that is what makes "an election
 * on any free agent at any time" true without reworking six list layouts. The
 * same control renders inside the live bid bar for the active nomination.
 *
 * A maximum and a decline are one concept, not two: a decline is a maximum bid
 * at the current price, and it is stored as a null so it ranks below every
 * number at settlement. That is why "Decline" and "Set maximum" are two buttons
 * on one control rather than two components.
 */
export default function AuctionElectionControl({
  pid,
  election,
  submit_auction_election,
  withdraw_auction_election,
  leagueId,
  teamId,
  is_election_window_open
}) {
  const has_election = Boolean(election)
  const is_decline = has_election && election.get('maximum_bid') === null
  const [value, set_value] = useState(
    has_election && !is_decline ? String(election.get('maximum_bid')) : ''
  )

  if (!is_election_window_open || !pid) {
    return null
  }

  const submit = (maximum_bid) =>
    submit_auction_election({ leagueId, teamId, pid, maximum_bid })

  const handle_set = () => {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 0) return
    submit(parsed)
  }

  return (
    <div className='auction-election-control'>
      {/* A plain input, matching auction-main-bid. @mui/material sits on a
          per-package import ratchet and one more import here would exceed its
          budget for a field the bid bar already renders without it. */}
      <label>Max bid</label>
      <input
        type='number'
        value={value}
        onChange={(event) => set_value(event.target.value)}
      />
      <Button small onClick={handle_set}>
        {has_election && !is_decline ? 'Update' : 'Set'}
      </Button>
      {/* A decline is revocable while its player is unsettled -- the un-pass
          that did not exist anywhere in the codebase under the retired pass
          mechanic, where a misclick could only be undone by another team
          bidding. */}
      {is_decline ? (
        <Button
          small
          onClick={() => withdraw_auction_election({ leagueId, teamId, pid })}
        >
          Undo decline
        </Button>
      ) : (
        <Button small onClick={() => submit(null)}>
          Decline
        </Button>
      )}
      {has_election && !is_decline && (
        <Button
          small
          onClick={() => withdraw_auction_election({ leagueId, teamId, pid })}
        >
          Withdraw
        </Button>
      )}
    </div>
  )
}

AuctionElectionControl.propTypes = {
  pid: PropTypes.string,
  election: PropTypes.object,
  submit_auction_election: PropTypes.func,
  withdraw_auction_election: PropTypes.func,
  leagueId: PropTypes.number,
  teamId: PropTypes.number,
  is_election_window_open: PropTypes.bool
}
