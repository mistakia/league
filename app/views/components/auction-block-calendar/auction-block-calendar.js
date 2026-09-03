import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'
import Button from '@components/button'
import TeamName from '@components/team-name'
import Accordion from '@components/accordion'
import { useClockSeconds } from '@core/utils'
import { AUCTION_BLOCK_GRANULARITY_MINUTES } from '#constants'

import './auction-block-calendar.styl'

const SLOT_SECONDS = AUCTION_BLOCK_GRANULARITY_MINUTES * 60
const SLOTS_PER_HOUR = 60 / AUCTION_BLOCK_GRANULARITY_MINUTES
const HOUR_LABELS = ['12a', '6a', '12p', '6p']

/**
 * The free agency period at 15-minute resolution.
 *
 * ONE CELL PER HOUR, NOT ONE CONTROL PER SLOT. A 2026-length period is five days
 * and 480 slots; a hundred-odd hour cells each carrying a density mark is a grid
 * a manager can read at a glance, and the quarter-hours open in the detail panel
 * below it.
 *
 * THE DENSITY MARK SUMMARISES NAMED DATA, it does not replace it. Opt-ins are
 * public by design -- an election is a sealed bid, an availability is not -- and
 * convening a block is a negotiation, so the detail panel names every opted-in
 * team rather than counting them. A manager cannot argue for a slot against a
 * bare count.
 *
 * EVERY CELL STATE IS DRAWN, and none of them were until 2026-09-02. The
 * stylesheet was written against four CSS custom properties this repo declares
 * nowhere, so every background, border and outline in the grid was invalid at
 * computed-value time and dropped: the calendar rendered as 168 invisible boxes
 * against white with no axis, which is what "the schedule does not show the
 * selectable days and blocks" was. An hour is now open, opted-into, mine,
 * convened, the final block, too soon to convene, or outside the period, each
 * distinct and each named in the key beneath the grid.
 *
 * THE HOUR IS THE UNIT A MANAGER ACTUALLY MEANS. "I am free between eight and
 * nine" was four separate clicks and four round trips, so the detail panel
 * carries one control for the whole hour alongside the four per-slot ones. It
 * sends only the slots outside the notice threshold, since the rest cannot
 * convene and the route refuses a set whole rather than in part.
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

  // The hour axis. Without it the grid was 24 unlabelled columns against a day
  // label, so "which of these is Saturday evening" had no answer on screen and
  // a manager could only find a slot by hovering cells one at a time. Labelled
  // every six hours because a cell is about ten pixels wide in the side rail
  // and 24 labels cannot fit; the six-hour boundaries also carry a rule in the
  // stylesheet, so the unlabelled columns are still countable from one.
  const hour_axis = []
  for (let hour = 0; hour < 24; hour += 1) {
    const classes = ['auction__block-calendar-hour-label']
    if (hour % 6 === 0) classes.push('major')
    hour_axis.push(
      <div key={hour} className={classes.join(' ')}>
        {hour % 6 === 0 ? HOUR_LABELS[hour / 6] : ''}
      </div>
    )
  }

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
      block_ats: [slot.at],
      is_opted_in
    })
  }

  const selected_slots = selected_hour ? slots_for_hour(selected_hour) : []

  // The whole hour in one act. Opting in slot by slot is four round trips for
  // what a manager almost always means -- "I am free this hour" -- and the
  // slots inside the notice threshold cannot be acted on at all, so they are
  // excluded rather than sent and refused.
  const actionable_slots = selected_slots.filter(
    (slot) => slot.at >= notice_floor
  )
  const holds_every_actionable_slot =
    actionable_slots.length > 0 &&
    actionable_slots.every(
      (slot) => slot.opt_in_tids && slot.opt_in_tids.includes(teamId)
    )

  const on_toggle_hour = () => {
    if (!teamId || !actionable_slots.length) return
    set_auction_block_opt_in({
      leagueId,
      teamId,
      block_ats: actionable_slots.map((slot) => slot.at),
      is_opted_in: !holds_every_actionable_slot
    })
  }

  // The header doubles as the collapsed summary, so a manager who has not
  // opened the grid still sees the one fact they cannot act without: when the
  // final block lands.
  const header = (
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
  )

  const body = (
    <>
      {/* The rules sit above the grid permanently. Collapsing them behind a
          toggle saved three lines once the grid had been read, which saved the
          vertical cost for the manager already returning every visit -- but
          anonymity of the convening rule has a cost nobody noticed, so the
          legend stays. */}
      <div className='auction__block-calendar-legend'>
        A block convenes when all {denominator} teams with an open roster spot
        opt in, at least {auction_block_notice_minutes} minutes ahead. Pick an
        hour to see its {SLOTS_PER_HOUR} {AUCTION_BLOCK_GRANULARITY_MINUTES}
        -minute slots, and to take the whole hour at once. A cell&apos;s number
        is the most teams any one of its slots has drawn.
      </div>

      <div className='auction__block-calendar-grid'>
        <div className='auction__block-calendar-row auction__block-calendar-axis'>
          <div className='auction__block-calendar-day' />
          {hour_axis}
        </div>

        {grid.map((day) => (
          <div className='auction__block-calendar-row' key={day.at.unix()}>
            <div className='auction__block-calendar-day'>
              {day.at.format('ddd D')}
            </div>
            {day.hours.map((hour) => {
              const slots = slots_for_hour(hour.unix)
              const finalized = slots.filter((slot) => slot.is_finalized).length
              // The density mark: the MOST teams any one of the hour's four
              // slots has drawn, against the unanimity denominator. It counted
              // slots-with-anybody-in-them until 2026-09-02, which answered a
              // question nobody asks -- "3" meant three quarter-hours had at
              // least one team, so an hour one team had blanket-claimed
              // outranked an hour eight teams agreed on. Both are summaries of
              // the named data in the detail panel and neither replaces it, but
              // only this one tells a manager where a block is close.
              const opted = slots.reduce(
                (most, slot) =>
                  Math.max(most, slot.opt_in_tids ? slot.opt_in_tids.size : 0),
                0
              )
              const mine = slots.filter(
                (slot) => slot.opt_in_tids && slot.opt_in_tids.includes(teamId)
              ).length
              const is_final_block_hour =
                final_block_at &&
                final_block_at >= hour.unix &&
                final_block_at < hour.unix + 3600
              // An hour whose LAST slot is already inside the notice threshold
              // cannot convene however many teams opt in, so it is drawn as
              // unavailable rather than left to be discovered one cell at a
              // time in the detail panel.
              const is_too_soon = hour.unix + 3600 - SLOT_SECONDS < notice_floor
              const is_now =
                now >= hour.unix && now < hour.unix + 3600 && hour.is_in_period

              const classes = ['auction__block-calendar-cell']
              if (!hour.is_in_period) classes.push('outside')
              else if (is_too_soon) classes.push('too-soon')
              else classes.push('selectable')
              if (hour.is_in_period && opted) classes.push('has-opt-ins')
              if (finalized) classes.push('finalized')
              if (mine) classes.push('mine')
              if (is_final_block_hour) classes.push('final-block')
              if (is_now) classes.push('now')
              if (selected_hour === hour.unix) classes.push('selected')

              const describe = () => {
                const when = hour.at.format('ddd MMM D, h:mm A')
                if (!hour.is_in_period) return `${when} -- outside the period`
                if (finalized) return `${when} -- a block is convened`
                if (is_too_soon) return `${when} -- too soon to convene`
                const yours = mine
                  ? `, you in ${mine} of ${SLOTS_PER_HOUR}`
                  : ''
                return `${when} -- ${opted} of ${denominator} opted in${yours}`
              }

              return (
                <div
                  key={hour.unix}
                  className={classes.join(' ')}
                  title={describe()}
                  onClick={() => {
                    if (!hour.is_in_period) return
                    set_selected_hour(
                      selected_hour === hour.unix ? null : hour.unix
                    )
                  }}
                >
                  {/* Wrapped rather than bare, because `mine` underlines the
                      count and the cell is a flex container -- a bare text
                      node in one is an anonymous flex item, and whether a
                      decoration set on the container reaches it is the kind of
                      rule that fails silently rather than loudly. */}
                  {Boolean(hour.is_in_period && opted) && (
                    <span className='auction__block-calendar-count'>
                      {opted}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className='auction__block-calendar-key'>
        <span>
          <i className='auction__block-calendar-swatch selectable' />
          open
        </span>
        <span>
          <i className='auction__block-calendar-swatch has-opt-ins' />
          opted in
        </span>
        <span>
          <i className='auction__block-calendar-swatch mine' />
          yours
        </span>
        <span>
          <i className='auction__block-calendar-swatch finalized' />
          convened
        </span>
        <span>
          <i className='auction__block-calendar-swatch final-block' />
          final block
        </span>
        <span>
          <i className='auction__block-calendar-swatch too-soon' />
          too soon
        </span>
      </div>

      {/* The quarter-hours for the selected cell, INLINE rather than in a
          popover. A floating layer over a 120-cell grid puts the thing a
          manager is comparing against on top of the grid they are comparing it
          to, and it costs an @mui/material import the tree is holding a budget
          against. */}
      {selected_hour && (
        <div className='auction__block-calendar-detail'>
          <div className='auction__block-calendar-detail-head'>
            <span className='auction__block-calendar-detail-when'>
              {dayjs.unix(selected_hour).format('ddd MMM D, h:mm A')}
            </span>
            {Boolean(teamId) && actionable_slots.length > 0 && (
              <Button small onClick={on_toggle_hour}>
                {holds_every_actionable_slot
                  ? 'Withdraw from hour'
                  : `Opt into all ${actionable_slots.length}`}
              </Button>
            )}
          </div>
          {selected_slots.map((slot) => {
            const tids = slot.opt_in_tids
            const is_mine = Boolean(tids && tids.includes(teamId))
            const is_inside_notice = slot.at < notice_floor

            const slot_classes = ['auction__block-calendar-slot']
            if (is_mine) slot_classes.push('mine')

            return (
              <div className={slot_classes.join(' ')} key={slot.at}>
                <div className='auction__block-calendar-slot-time'>
                  {dayjs.unix(slot.at).format('h:mm A')}
                </div>
                {/* `nobody yet` is an INVITATION, not an attendance count: it
                    means no team has opted in and yours could be the first. A
                    convened slot has nothing left to opt into, so pairing the
                    two rendered `Convened nobody yet` -- which reads as a block
                    that convened nobody. The final block is the case that hits
                    it every time: it is convened by rule on unfilled roster
                    spots and carries no opt-in rows at all, so the one slot a
                    manager most needs to trust described itself as empty. */}
                <div className='auction__block-calendar-slot-teams'>
                  {slot.is_finalized && (
                    <span className='auction__block-calendar-convened'>
                      Convened
                    </span>
                  )}
                  {tids && tids.size
                    ? tids.map((tid) => <TeamName key={tid} tid={tid} abbrv />)
                    : !slot.is_finalized && (
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
    </>
  )

  // ON REQUEST EVERYWHERE, not just on the phone. A 168-cell grid plus a
  // legend plus a key is the tallest thing in the side rail on any viewport,
  // and opting into a slot is an occasional act while reading the board is
  // continuous -- so the grid costs its full height every visit to serve a
  // decision made once or twice in a period. The header is the summary and
  // carries the final block, which is the one fact that must survive the
  // collapse, so nothing is hidden that a manager cannot act without.
  return (
    <Accordion
      className='auction__block-calendar'
      summary={header}
      unmount_on_collapse
    >
      {body}
    </Accordion>
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
