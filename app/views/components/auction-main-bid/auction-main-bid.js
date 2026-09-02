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
import AuctionSettlementStatus from '@components/auction-settlement-status'
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
  isComplete,
  isLocked,
  isEligible,
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

  const handle_click_nominate = () => {
    if (!is_valid(value)) {
      showNotification({
        message: 'missing or invalid bid amount',
        severity: 'warning'
      })
      return
    }
    nominate(value)
  }

  const classNames = []
  let action = null
  let disabled = false
  if (!league.free_agency_period_start || !isStarted || isComplete) {
    action = null
  } else if (isPaused) {
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
    } else if (isAboveCap) {
      disabled = true
      action = (
        <Button small disabled>
          Exceeded CAP
        </Button>
      )
    } else if (!isEligible) {
      disabled = true
      action = (
        <Button small disabled>
          Ineligible
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
      <Button small disabled={!selected_pid} onClick={handle_click_nominate}>
        Nominate ${value}
      </Button>
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

  const is_running = isStarted && !isComplete && !isPaused

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
          <AuctionSettlementStatus />
          {main}
        </div>
        {is_running && (
          <div className='auction__bid-actions'>
            {!is_election_mode && (
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
              <ButtonGroup className={classNames.join(' ')}>
                {(!nominated_pid || !isWinningBid) && (
                  <Button small disabled={disabled} onClick={handle_down_click}>
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
              {/* Where the pass button used to sit. A decline is the same
                  action the pass was, and a maximum is the one it never had. */}
              {is_election_mode && nominated_pid && (
                <AuctionElectionControl pid={nominated_pid} compact />
              )}
            </div>
            <div className='auction__main-input'>
              <label>Enter Bid</label>
              <input type='number' value={value} onChange={handle_change} />
            </div>
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
  isComplete: PropTypes.bool,
  isLocked: PropTypes.bool,
  isEligible: PropTypes.bool,
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
