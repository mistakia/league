import React, { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'

import Icon from '@components/icon'
import TeamName from '@components/team-name'
import LoadingButton from '@mui/lab/LoadingButton'
import Button from '@components/button'
import ButtonGroup from '@components/button-group'
import Timer from '@components/timer'
import AuctionNominatedPlayer from '@components/auction-nominated-player'
import AuctionElectionControl from '@components/auction-election-control'

import './auction-main-bid.styl'

// Converted from a class while being edited, deliberately.
// test/app.connected-component-props.spec.mjs states in its own header that it
// is blind to connected components written as classes -- so the gate that
// exists to catch exactly this edit (dropping a prop its children needed) could
// not see this file at all while it was one.
export default function AuctionMainBid({
  bid,
  availableCap,
  nominated_pid,
  bidValue,
  showNotification,
  nominate,
  selected_pid,
  isPaused,
  is_initialized,
  isComplete,
  isLocked,
  auction_capacity,
  isAboveCap,
  isNominating,
  isCommish,
  nominating_team_id,
  timer,
  isWinningBid,
  league,
  isStarted,
  free_agency_period_start,
  auction_mode,
  block_end_at,
  is_final_block
}) {
  const [value, set_value] = useState(0)

  // THE NOMINATOR'S OPTIONAL CEILING. Empty is the ordinary case and means "not
  // stated" -- NOT a decline, which a nominator cannot express anyway. A
  // nomination binds the nominator to its opening bid but does not discharge it
  // from the outstanding set, so a nominator who states nothing here is the team
  // the auction waits on next, and can elect later from the standing-elections
  // control once they have seen the field react.
  const [nomination_maximum_bid, set_nomination_maximum_bid] = useState('')
  const previous = useRef({ bidValue, nominated_pid })

  // Election mode carries no clock of any kind, so there is no timer to render
  // and no bid clock to run down. Live mode is the open-outcry path.
  const is_election_mode = auction_mode === 'election'

  const is_valid = useCallback(
    (candidate) => {
      if (candidate !== 0 && !candidate) return false
      if (!Number.isInteger(candidate)) return false
      if (candidate > availableCap) return false
      if (nominated_pid && candidate <= bidValue) return false
      if (candidate < 0) return false
      return true
    },
    [availableCap, nominated_pid, bidValue]
  )

  useEffect(() => {
    const was = previous.current
    if (!was.nominated_pid && nominated_pid) {
      // new player nominated
      set_value(bidValue + 1)
    } else if (!nominated_pid && was.nominated_pid) {
      // waiting on nomination
      set_value(0)
    } else if (bidValue > was.bidValue) {
      // received new bid
      set_value(bidValue + 1)
    }
    previous.current = { bidValue, nominated_pid }
  }, [bidValue, nominated_pid])

  const handle_change = (event) => {
    const next = event.target.value ? Number(event.target.value) : ''
    if (next && !Number.isInteger(next)) return
    if (next && next > availableCap) return
    set_value(next)
  }

  const handle_up_click = () => {
    const next = value + 1
    if (!is_valid(next)) return
    set_value(next)
  }

  const handle_down_click = () => {
    const next = value - 1
    if (!is_valid(next)) return
    set_value(next)
  }

  const handle_click_bid = () => {
    if (!is_valid(value)) {
      showNotification({
        message: 'missing or invalid bid amount',
        severity: 'warning'
      })
      return
    }
    bid(value)
  }

  const handle_nomination_maximum_bid_change = (event) => {
    const next = event.target.value
    if (next === '') return set_nomination_maximum_bid('')
    const parsed = Number(next)
    if (!Number.isInteger(parsed) || parsed < 0) return
    if (parsed > availableCap) return
    set_nomination_maximum_bid(next)
  }

  const handle_click_nominate = () => {
    if (!is_valid(value)) {
      showNotification({
        message: 'missing or invalid bid amount',
        severity: 'warning'
      })
      return
    }

    // Refused BELOW the opening bid rather than quietly raised. The nomination
    // binds the nominator to its opening bid regardless, so a lower ceiling
    // would be raised back up by the server and the manager charged a number
    // they had explicitly capped under.
    const maximum =
      nomination_maximum_bid === '' ? null : Number(nomination_maximum_bid)
    if (maximum !== null && maximum < value) {
      showNotification({
        message: 'maximum must be at or above your opening bid',
        severity: 'warning'
      })
      return
    }

    nominate({ value, maximum_bid: maximum })
    set_nomination_maximum_bid('')
  }

  // WHY this team cannot take the open player, as a button label and as a
  // sentence. `auction_capacity` is null when there is no nomination or the
  // board has no map for it -- unknown, which both readers below treat as no
  // finding rather than as a refusal.
  //
  // The order is the order a manager can act on: a full roster and a position
  // limit are settled for the rest of the auction, and only the budget term can
  // still move (by a trade, or by the price falling on the next player).
  const is_structurally_ineligible = Boolean(
    auction_capacity && !auction_capacity.is_eligible
  )

  const ineligible_button_label = () => {
    if (!is_structurally_ineligible) return null
    if (!auction_capacity.has_roster_space) return 'Roster Full'
    if (!auction_capacity.has_position_capacity)
      return `${auction_capacity.position} Limit`
    return 'Cap Short'
  }

  // Said in full for the election control, because the whole point of the line
  // is that no answer is owed: an ineligible team is not in the outstanding set
  // the nomination is waiting on, so declining and setting a maximum are both
  // actions that cannot change what happens to this player.
  const ineligible_election_reason = () => {
    if (!is_structurally_ineligible) return null
    if (!auction_capacity.has_roster_space) {
      return 'Roster full — no decline or maximum needed.'
    }
    if (!auction_capacity.has_position_capacity) {
      return `At your ${auction_capacity.position} limit — no decline or maximum needed.`
    }
    return `Cap $${auction_capacity.available_cap} is under the $${auction_capacity.current_price} price — no decline or maximum needed.`
  }

  // A NARROWER REFUSAL, and it takes away one button rather than the control.
  //
  // `/auction-elections` refuses a DECLINE from the team that nominated the open
  // player -- nominating is bidding, so the nominator already holds a claim and
  // cannot answer "I will not bid" on top of it. It refuses nothing else: a
  // maximum from the same team is an ordinary raise on its own nomination, and
  // withdrawing an election it placed before nominating is a different verb the
  // route does not check. So `Set maximum` and `Undo decline` stay live and
  // only `Decline` goes.
  //
  // `isNominating` IS the nominator while a player is open, and it is not a
  // second reading of the field. `resolve_nominating_team_id` returns the last
  // nomination's team for as long as the latest transaction is a bid, and moves
  // to the next team in the rotation only once the player is processed -- so the
  // team on the clock and the nominator of the open player are the same team by
  // construction, and the `nominated_pid` term is what says which of the two
  // questions is being asked.
  const nominated_by_this_team = Boolean(nominated_pid) && isNominating

  const decline_refusal_reason = nominated_by_this_team
    ? 'Nominating is bidding — you cannot decline your own nomination.'
    : null

  const classNames = []
  let action = null
  let disabled = false
  if (!league.free_agency_period_start || !isStarted || isComplete) {
    action = null
  } else if (!is_initialized || isPaused) {
    action = null
  } else if (isLocked) {
    disabled = true
    action = (
      <Button small disabled>
        Locked
      </Button>
    )
  } else if (nominated_pid) {
    if (isWinningBid) {
      disabled = true
      classNames.push('winning')
      action = (
        <Button small disabled>
          Winning Bid
        </Button>
      )
    } else if (is_structurally_ineligible) {
      // BEFORE the cap check, and it used to be after it. `Ineligible` said
      // only that the roster had no room and was reached only once the price
      // had passed the cap, so a manager with a full roster read `Exceeded CAP`
      // and went looking for budget to free up -- an answer to a question that
      // was not the one holding them out. The label names the term that
      // actually applies.
      disabled = true
      action = (
        <Button small disabled>
          {ineligible_button_label()}
        </Button>
      )
    } else if (isAboveCap) {
      // Eligible, and cannot RAISE: `bid + 1` is past the cap while the cap
      // still covers the price on the board. That team can still win at the
      // current price under the tiebreak, which is why this is a separate state
      // from the one above and not a worse version of it.
      disabled = true
      action = (
        <Button small disabled>
          Exceeded CAP
        </Button>
      )
    } else {
      action = (
        <Button small onClick={handle_click_bid}>
          Bid ${value}
        </Button>
      )
    }
  } else if (isNominating || isCommish) {
    disabled = !selected_pid
    action = (
      <div className='auction__nominate'>
        {/* `isNominating` and NOT `isCommish`: a ceiling binds the team that
            stated it, and the commissioner nominating out of turn nominates on
            behalf of the team on the clock, so a ceiling typed here would be
            another team's. The server refuses it; offering the control anyway
            would be offering one that cannot work. The bound is also wrong --
            `availableCap` here is the CURRENT team's, not the nominating
            team's. */}
        {is_election_mode && isNominating && (
          <input
            type='number'
            className='auction__nominate-maximum-bid'
            placeholder='Max (optional)'
            min={value}
            max={availableCap}
            value={nomination_maximum_bid}
            onChange={handle_nomination_maximum_bid_change}
          />
        )}
        <Button small disabled={!selected_pid} onClick={handle_click_nominate}>
          Nominate ${value}
        </Button>
      </div>
    )
  } else {
    disabled = true
    action = <LoadingButton disabled variant='contained' loading />
  }

  let main
  if (!league.free_agency_period_start) {
    main = <div className='auction__text'>Auction is not scheduled</div>
  } else if (isComplete) {
    main = <div className='auction__text'>Auction is complete</div>
  } else if (!isStarted) {
    main = (
      <div className='auction__text'>
        Auction will begin on{' '}
        {free_agency_period_start.format('dddd, MMMM D YYYY, ha')}
      </div>
    )
  } else if (!is_initialized) {
    // NOT `Auction is paused`, which is what this said for the whole of every
    // load and forever on a client whose AUCTION_INIT never arrived. The
    // auction's state is unknown here, and saying so is the only honest line.
    main = <div className='auction__text'>Loading auction…</div>
  } else if (isPaused) {
    main = <div className='auction__text'>Auction is paused</div>
  } else if (nominated_pid) {
    main = <AuctionNominatedPlayer pid={nominated_pid} />
  } else if (selected_pid) {
    main = <AuctionNominatedPlayer pid={selected_pid} />
  } else if (isNominating) {
    main = <div className='auction__text'>Your turn to nominate a player</div>
  } else {
    main = (
      <div className='auction__text'>
        Waiting for a nomination by <TeamName tid={nominating_team_id} abbrv />
      </div>
    )
  }

  const is_running = isStarted && !isComplete && is_initialized && !isPaused

  // AN ELECTION IS NOT A SOCKET WRITE, so a socket pause is not a reason to
  // take it away.
  //
  // Declining posts to `/auction-elections` over REST, which has no pause check
  // and needs none -- a maximum is accepted for the whole free agency period,
  // including hours when no auction clock is running at all. Rendering it under
  // `is_running` bound it to the bid clock anyway, so a manager whose client
  // believed the auction was paused lost the one control that would still have
  // worked, on the one player it was needed for. That is the second half of
  // what team 6 hit: the board said paused, and the Decline button was not
  // absent because declining was refused, but because the same flag drew both.
  const show_election_control =
    is_election_mode &&
    Boolean(nominated_pid) &&
    isStarted &&
    !isComplete &&
    is_initialized

  return (
    <div className='auction__bar'>
      <div className='auction__bar-body'>
        <div className='auction__bid-info'>
          {/* WHICH live block this is, because the two are not the same thing
              to a manager: an opt-in block they agreed to attend, or the
              mandatory final block that ends the auction.

              IT SITS WITH THE STATUS, NOT ON THE CLOCK. It was a nowrap line
              inside `.auction__main-timer`, a 60px fixed-basis box laid out as
              a row -- so `Live block until 4:15 PM` and the countdown were
              side by side in sixty pixels, each spilling over the other. It is
              a statement about which session you are in, which is what this
              slot holds; the countdown beside it is a different question. The
              two never co-occur with the settlement status either, since that
              is election mode and this is live. */}
          {is_running && !is_election_mode && (
            <div className='auction__block-label'>
              {is_final_block ? 'Final block' : 'Live block'}
              {block_end_at
                ? ` until ${dayjs.unix(block_end_at).format('h:mm A')}`
                : ''}
            </div>
          )}
          {main}
        </div>
        {(is_running || show_election_control) && (
          <div className='auction__bid-actions'>
            {is_running && !is_election_mode && (
              <div className='auction__main-timer'>
                <Timer
                  expiration={timer}
                  alert={isNominating || Boolean(nominated_pid)}
                />
              </div>
            )}
            <div className='auction__main-action'>
              {/* `small` and `disabled` are on each button rather than on
                  the group. The group propagates nothing — see
                  button-group.js. */}
              {is_running && (
                <ButtonGroup className={classNames.join(' ')}>
                  {(!nominated_pid || !isWinningBid) && (
                    <Button
                      small
                      disabled={disabled}
                      onClick={handle_down_click}
                    >
                      <Icon name='remove' />
                    </Button>
                  )}
                  {action}
                  {(!nominated_pid || !isWinningBid) && (
                    <Button small disabled={disabled} onClick={handle_up_click}>
                      <Icon name='add' />
                    </Button>
                  )}
                </ButtonGroup>
              )}
              {/* Where the pass button used to sit. A decline is the same
                  action the pass was, and a maximum is the one it never had.
                  Drawn on its own condition rather than the bid clock's — see
                  `show_election_control` above. */}
              {show_election_control && (
                <AuctionElectionControl
                  pid={nominated_pid}
                  compact
                  ineligible_reason={ineligible_election_reason()}
                  decline_refusal_reason={decline_refusal_reason}
                />
              )}
            </div>
            {is_running && (
              <div className='auction__main-input'>
                <label>Enter Bid</label>
                <input type='number' value={value} onChange={handle_change} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

AuctionMainBid.propTypes = {
  bid: PropTypes.func,
  availableCap: PropTypes.number,
  nominated_pid: PropTypes.string,
  bidValue: PropTypes.number,
  showNotification: PropTypes.func,
  nominate: PropTypes.func,
  selected_pid: PropTypes.string,
  isPaused: PropTypes.bool,
  is_initialized: PropTypes.bool,
  isComplete: PropTypes.bool,
  isLocked: PropTypes.bool,
  auction_capacity: PropTypes.object,
  isAboveCap: PropTypes.bool,
  isNominating: PropTypes.bool,
  isCommish: PropTypes.bool,
  nominating_team_id: PropTypes.number,
  timer: PropTypes.number,
  isWinningBid: PropTypes.bool,
  league: PropTypes.object,
  isStarted: PropTypes.bool,
  free_agency_period_start: PropTypes.object,
  auction_mode: PropTypes.string,
  block_end_at: PropTypes.number,
  is_final_block: PropTypes.bool
}
