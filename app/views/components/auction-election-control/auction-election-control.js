import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Button from '@components/button'
import { auction_election_outcome_display_names } from '#constants'

import './auction-election-control.styl'

/**
 * Set, raise, withdraw or decline an election on one player.
 *
 * ONE control, reused. Its home is the selected-player drawer, which is
 * reachable from every player list in the app -- that is what makes "an election
 * on any free agent at any time" true without reworking six list layouts. The
 * same control renders inside the live bid bar for the active nomination.
 *
 * A maximum and a decline are one concept, not two: a decline is a maximum bid
 * at the current price, and it is stored as a null so it ranks below every
 * number at settlement. That is why "Decline" and "Set maximum" are two buttons
 * on one control rather than two components.
 *
 * IT STATES THE CURRENT ELECTION BEFORE IT OFFERS TO CHANGE ONE. Until
 * 2026-09-02 this rendered an empty number field and two buttons and nothing
 * else, so "I hold no election on this player" and "I hold a $12 maximum" were
 * the same picture -- and the surface a manager opens precisely to check what
 * they already instructed answered that question only by pre-filling a field
 * they then could not tell apart from one they had just typed into. The state
 * line is the primary content here and the form is secondary to it.
 */
export default function AuctionElectionControl({
  pid,
  election,
  submit_auction_election,
  withdraw_auction_election,
  leagueId,
  teamId,
  available_cap,
  is_election_window_open,
  select_player,
  ineligible_reason = null,
  decline_refusal_reason = null,
  compact = false
}) {
  // WHY EVERY WRITE HERE IS OFF, in the caller's words. The control does not
  // decide this: eligibility is a question about the OPEN NOMINATION -- roster
  // space, position room and the cap against the price on the board -- and the
  // bid bar is the only call site that has a nomination to ask about. The
  // drawer renders this control on any free agent at any time and passes
  // nothing, which is right: an election on a player nobody has nominated is
  // exactly the standing instruction this control exists to take.
  //
  // A team failing that predicate is not in the outstanding set, so the auction
  // is not waiting on it -- there is nothing to decline and no maximum that can
  // change the outcome. The buttons stay, disabled, rather than disappearing:
  // an absent control reads as a bug on a bar that was offering one a second
  // ago, and it answers no question about why.
  const is_ineligible = Boolean(ineligible_reason)

  // ONE BUTTON, not the control. The route refuses a decline from the team that
  // nominated the open player and refuses nothing else from it, so a maximum and
  // a withdrawal stay available -- disabling the group here would take away two
  // writes the server would have honored, on the one surface where the manager
  // is most likely to want them.
  //
  // Subordinate to `is_ineligible`: a team that cannot roster the player has
  // nothing to set either, and the two lines would otherwise both want the note.
  const is_decline_refused = Boolean(decline_refusal_reason) && !is_ineligible
  const has_election = Boolean(election)
  const is_decline = has_election && election.get('maximum_bid') === null
  const maximum_bid = has_election ? election.get('maximum_bid') : null
  const is_settled = has_election && Boolean(election.get('settled_at'))

  // What the SERVER holds, as the field would show it. Re-deriving it every
  // render is what lets the draft below resynchronise: this component outlives
  // both the write that changes the election and the drawer moving to another
  // player, and a `useState` initialiser runs for neither. Before this, setting
  // a maximum left the field showing whatever had been typed, withdrawing one
  // left the withdrawn amount sitting in it, and opening a second player showed
  // the first player's ceiling.
  const server_value = has_election && !is_decline ? String(maximum_bid) : ''
  const sync_key = `${pid}:${server_value}`

  const [draft, set_draft] = useState(server_value)
  const [synced_from, set_synced_from] = useState(sync_key)
  if (synced_from !== sync_key) {
    set_synced_from(sync_key)
    set_draft(server_value)
  }

  if (!is_election_window_open || !pid) {
    return null
  }

  const submit = (value) =>
    submit_auction_election({ leagueId, teamId, pid, maximum_bid: value })

  const withdraw = () => withdraw_auction_election({ leagueId, teamId, pid })

  const handle_set = () => {
    if (is_ineligible) return
    const parsed = Number(draft)
    if (!Number.isInteger(parsed) || parsed < 0) return
    submit(parsed)
  }

  const class_names = ['auction-election-control']
  // The bid bar is a strip, not a page section: it already names the player,
  // the price and the clock, and the note here would be the fourth sentence on
  // a surface a manager reads in seconds. The state line stays -- knowing
  // whether you already hold a ceiling on the open player is the reason to look.
  //
  // COMPACT IS THE STATE LINE PLUS TWO BUTTONS -- decline, and a route to the
  // drawer -- and the bound is a layout constraint rather than a preference.
  // The bar body is capped at 1000px, so the full form's 573px did not shrink
  // anything: it pushed `Undo decline` clean off the viewport and squeezed
  // auction-settlement-status into a 71px column 188px tall, hanging 118px
  // below a 70px bar and over the player board.
  //
  // Setting a NUMBER still stays in the drawer, which is the only place that
  // can explain the availableCap capping term, and a second number field 100px
  // from `Enter Bid` would be its own defect. What changed on 2026-09-02 is
  // that the bar had no route to it at all -- a manager looking at the open
  // nomination could decline, and could not set a ceiling without knowing to
  // click the player name. `Set maximum` dispatches select_player and opens
  // that drawer; it writes nothing itself. The room for it came from
  // auction-settlement-status leaving the bar for the side rail on the same
  // day, which returned the ~260px basis it had been holding.
  if (compact) class_names.push('compact')
  if (is_ineligible) class_names.push('ineligible')
  if (is_decline_refused) class_names.push('decline-refused')
  if (is_settled) class_names.push('settled')
  else if (is_decline) class_names.push('declined')
  else if (has_election) class_names.push('maximum')

  const outcome = has_election ? election.get('outcome') : null

  const render_state_value = () => {
    if (is_settled) {
      return (
        auction_election_outcome_display_names[outcome] || outcome || 'Settled'
      )
    }
    if (is_decline) return 'Declined'
    if (has_election) return `$${maximum_bid}`
    return 'None set'
  }

  // The STATED maximum is what the manager typed; a ceiling capped down to
  // availableCap is the number that surprises them at settlement, so both are
  // named here rather than only in the standing-elections panel.
  const render_note = () => {
    if (is_settled) return 'This player has been settled.'
    // Ahead of every other line, and it replaces rather than joins them. Each
    // of the others explains how a write here will be honored; there is no
    // write here to explain.
    if (is_ineligible) return ineligible_reason
    if (is_decline_refused) return decline_refusal_reason
    if (is_decline) {
      return 'You will not bid. Revocable until this player settles.'
    }
    if (has_election && election.get('is_capped')) {
      return `Capped to $${election.get('effective_maximum')} by your $${available_cap} available cap.`
    }
    if (has_election) {
      return `Honored whenever they are nominated, including while you are away. Your available cap is $${available_cap}.`
    }
    return `Set a maximum and it is bid for you whenever they are nominated, up to $${available_cap} of available cap. Declining answers for you without bidding.`
  }

  return (
    <div className={class_names.join(' ')}>
      <div className='auction-election-control__state'>
        <label>Your election</label>
        <div className='auction-election-control__state-value'>
          {render_state_value()}
        </div>
      </div>

      <div className='auction-election-control__body'>
        {!is_settled && (
          <div className='auction-election-control__form'>
            {!compact && (
              <>
                {/* A plain input, matching auction-main-bid. @mui/material sits
                    on a per-package import ratchet and one more import here
                    would exceed its budget for a field the bid bar already
                    renders without it. */}
                <label htmlFor={`auction-election-${pid}`}>Maximum bid</label>
                <input
                  id={`auction-election-${pid}`}
                  type='number'
                  min='0'
                  inputMode='numeric'
                  placeholder='0'
                  value={draft}
                  disabled={is_ineligible}
                  onChange={(event) => set_draft(event.target.value)}
                />
                <Button small disabled={is_ineligible} onClick={handle_set}>
                  {has_election && !is_decline ? 'Update' : 'Set maximum'}
                </Button>
              </>
            )}
            {/* A decline is revocable while its player is unsettled -- the
                un-pass that did not exist anywhere in the codebase under the
                retired pass mechanic, where a misclick could only be undone by
                another team bidding. This is the one button the bar keeps: it
                is the action the retired pass occupied that slot to perform. */}
            {is_decline ? (
              <Button small disabled={is_ineligible} onClick={withdraw}>
                Undo decline
              </Button>
            ) : (
              <Button
                small
                disabled={is_ineligible || is_decline_refused}
                onClick={() => submit(null)}
              >
                Decline
              </Button>
            )}
            {/* The bar's route to a maximum. It opens the drawer rather than
                setting a number here, which is the same split the chip on the
                board uses and the one the comment at the top of this file
                argues for: the amount field belongs where there is room to
                explain the availableCap capping term, and a second number
                input a hundred pixels from `Enter Bid` is its own defect.

                This is an affordance, not a write -- it dispatches
                select_player and nothing else. */}
            {compact && (
              <Button
                small
                disabled={is_ineligible}
                onClick={() => select_player(pid)}
              >
                {has_election && !is_decline ? 'Change maximum' : 'Set maximum'}
              </Button>
            )}
            {!compact && has_election && !is_decline && (
              <Button small disabled={is_ineligible} onClick={withdraw}>
                Withdraw
              </Button>
            )}
          </div>
        )}
        {/* THE ONE LINE THE COMPACT STRIP DOES TAKE. The bar suppresses this
            note because the surrounding bar already names the player, the price
            and the clock and the note would be a fourth sentence -- but that
            argument is about a note explaining a control the manager can see is
            there. Two disabled buttons and no reason is the state this change
            exists to remove, so the strip carries the line for exactly the case
            that produced it. */}
        {(!compact || is_ineligible || is_decline_refused) && (
          <div className='auction-election-control__note'>{render_note()}</div>
        )}
      </div>
    </div>
  )
}

AuctionElectionControl.propTypes = {
  pid: PropTypes.string,
  election: ImmutablePropTypes.map,
  submit_auction_election: PropTypes.func,
  withdraw_auction_election: PropTypes.func,
  leagueId: PropTypes.number,
  teamId: PropTypes.number,
  available_cap: PropTypes.number,
  is_election_window_open: PropTypes.bool,
  select_player: PropTypes.func,
  ineligible_reason: PropTypes.string,
  decline_refusal_reason: PropTypes.string,
  compact: PropTypes.bool
}
