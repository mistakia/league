import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'
import Button from '@components/button'
import TeamName from '@components/team-name'
import { useClockSeconds } from '@core/utils'
import { AUCTION_BLOCK_GRANULARITY_MINUTES } from '#constants'

import './auction-block-calendar.styl'

const SLOT_SECONDS = AUCTION_BLOCK_GRANULARITY_MINUTES * 60
const SLOTS_PER_HOUR = 60 / AUCTION_BLOCK_GRANULARITY_MINUTES

/**
 * The free agency period at 15-minute resolution.
 *
 * ONE CELL PER HOUR, NOT ONE CONTROL PER SLOT. A 2026-length period is five days
 * and 480 slots; 120 hour cells each carrying a four-slot density mark is a grid
 * a manager can read at a glance, and the quarter-hours open in a popover.
 *
 * THE DENSITY MARK SUMMARISES NAMED DATA, it does not replace it. Opt-ins are
 * public by design -- an election is a sealed bid, an availability is not -- and
 * convening a block is a negotiation, so the popover names every opted-in team
 * rather than counting them. A manager cannot argue for a slot against a bare
 * count.
 */
export default function AuctionBlockCalendar({
  live_blocks,
  block_eligible_tids,
  final_block_at,
  final_block_spots_remaining,
  free_agency_period_end,
  free_agency_period_start,
  auction_block_notice_minutes,
  teamId,
  set_auction_block_opt_in,
  leagueId
}) {
  const [selected_hour, set_selected_hour] = useState(null)
  // The grid only changes on a slot boundary, so it is rebuilt by the minute
  // while nothing else re-renders it.
  const now = useClockSeconds(1000)
  const now_minute = Math.floor(now / 60)

  const grid = useMemo(() => {
    if (!free_agency_period_start || !free_agency_period_end) return null

    const start = dayjs.unix(free_agency_period_start).startOf('hour')
    const end = dayjs.unix(free_agency_period_end)

    const days = []
    let cursor = start.startOf('day')
    while (cursor.isBefore(end)) {
      const hours = []
      for (let hour = 0; hour < 24; hour += 1) {
        const at = cursor.hour(hour)
        hours.push({
          at,
          unix: at.unix(),
          is_in_period: !at.isBefore(start) && at.isBefore(end)
        })
      }
      days.push({ at: cursor, hours })
      cursor = cursor.add(1, 'day')
    }
    return days
  }, [free_agency_period_start, free_agency_period_end])

  const slots_for_hour = (hour_unix) => {
    const slots = []
    for (let index = 0; index < SLOTS_PER_HOUR; index += 1) {
      const at = hour_unix + index * SLOT_SECONDS
      const slot = live_blocks.get(at)
      slots.push({
        at,
        opt_in_tids: slot ? slot.get('opt_in_tids') : null,
        is_finalized: Boolean(slot && slot.get('is_finalized'))
      })
    }
    return slots
  }

  if (!grid) return null

  // A slot inside the notice threshold cannot convene however many teams opt
  // in, so the boundary is drawn rather than left to be discovered. Read from
  // the league rather than hardcoded: the configured value is still moving.
  const notice_floor = now_minute * 60 + auction_block_notice_minutes * 60

  const denominator = block_eligible_tids.size

  const on_toggle = (slot) => {
    if (!teamId) return
    const is_opted_in = !(slot.opt_in_tids && slot.opt_in_tids.includes(teamId))
    set_auction_block_opt_in({
      leagueId,
      teamId,
      block_at: slot.at,
      is_opted_in
    })
  }

  const selected_slots = selected_hour ? slots_for_hour(selected_hour) : []

  return (
    <div className='auction__block-calendar'>
      <div className='auction__block-calendar-header'>
        <div className='auction__block-calendar-title'>Live Blocks</div>
        <div className='auction__block-calendar-final'>
          {final_block_at ? (
            <>
              <span>Final block</span>
              <strong>
                {dayjs.unix(final_block_at).format('ddd MMM D, h:mm A')}
              </strong>
              {final_block_spots_remaining !== null && (
                <span>{final_block_spots_remaining} spots remaining</span>
              )}
            </>
          ) : (
            <span>Final block not yet computed</span>
          )}
        </div>
      </div>

      <div className='auction__block-calendar-legend'>
        A block convenes when all {denominator} teams with an open roster spot
        opt in, at least {auction_block_notice_minutes} minutes ahead.
      </div>

      <div className='auction__block-calendar-grid'>
        {grid.map((day) => (
          <div className='auction__block-calendar-row' key={day.at.unix()}>
            <div className='auction__block-calendar-day'>
              {day.at.format('ddd D')}
            </div>
            {day.hours.map((hour) => {
              const slots = slots_for_hour(hour.unix)
              const finalized = slots.filter((slot) => slot.is_finalized).length
              // The density mark: how many of the hour's four slots anybody has
              // opted into. It is a summary of the named data in the popover,
              // never a replacement for it.
              const opted = slots.filter(
                (slot) => slot.opt_in_tids && slot.opt_in_tids.size
              ).length
              const mine = slots.filter(
                (slot) => slot.opt_in_tids && slot.opt_in_tids.includes(teamId)
              ).length
              const is_final_block_hour =
                final_block_at &&
                final_block_at >= hour.unix &&
                final_block_at < hour.unix + 3600

              const classes = ['auction__block-calendar-cell']
              if (!hour.is_in_period) classes.push('outside')
              if (finalized) classes.push('finalized')
              if (mine) classes.push('mine')
              if (is_final_block_hour) classes.push('final-block')
              if (selected_hour === hour.unix) classes.push('selected')

              return (
                <div
                  key={hour.unix}
                  className={classes.join(' ')}
                  title={hour.at.format('ddd MMM D, h:mm A')}
                  onClick={() => {
                    if (!hour.is_in_period) return
                    set_selected_hour(
                      selected_hour === hour.unix ? null : hour.unix
                    )
                  }}
                >
                  {hour.is_in_period && opted ? opted : ''}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* The quarter-hours for the selected cell, INLINE rather than in a
          popover. A floating layer over a 120-cell grid puts the thing a
          manager is comparing against on top of the grid they are comparing it
          to, and it costs an @mui/material import the tree is holding a budget
          against. */}
      {selected_hour && (
        <div className='auction__block-calendar-detail'>
          <div className='auction__block-calendar-detail-head'>
            {dayjs.unix(selected_hour).format('ddd MMM D, h:mm A')}
          </div>
          {selected_slots.map((slot) => {
            const tids = slot.opt_in_tids
            const is_mine = Boolean(tids && tids.includes(teamId))
            const is_inside_notice = slot.at < notice_floor

            return (
              <div className='auction__block-calendar-slot' key={slot.at}>
                <div className='auction__block-calendar-slot-time'>
                  {dayjs.unix(slot.at).format('h:mm A')}
                </div>
                <div className='auction__block-calendar-slot-teams'>
                  {slot.is_finalized && (
                    <span className='auction__block-calendar-convened'>
                      Convened
                    </span>
                  )}
                  {tids && tids.size ? (
                    tids.map((tid) => <TeamName key={tid} tid={tid} abbrv />)
                  ) : (
                    <span className='auction__block-calendar-empty'>
                      nobody yet
                    </span>
                  )}
                </div>
                <div className='auction__block-calendar-slot-action'>
                  {is_inside_notice ? (
                    <span className='auction__block-calendar-lapsed'>
                      too soon to convene
                    </span>
                  ) : (
                    <Button small onClick={() => on_toggle(slot)}>
                      {is_mine ? 'Withdraw' : 'Opt in'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

AuctionBlockCalendar.propTypes = {
  live_blocks: ImmutablePropTypes.map,
  block_eligible_tids: ImmutablePropTypes.list,
  final_block_at: PropTypes.number,
  final_block_spots_remaining: PropTypes.number,
  free_agency_period_end: PropTypes.number,
  free_agency_period_start: PropTypes.number,
  auction_block_notice_minutes: PropTypes.number,
  teamId: PropTypes.number,
  set_auction_block_opt_in: PropTypes.func,
  leagueId: PropTypes.number
}
