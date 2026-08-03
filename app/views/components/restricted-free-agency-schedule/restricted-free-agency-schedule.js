import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import { get_restricted_free_agency_nomination_info } from '@libs-shared'
import TeamName from '@components/team-name'
import { useClockSeconds } from '@components/trade-veto-countdown'

import './restricted-free-agency-schedule.styl'

function teams_to_array(teams) {
  if (!teams || typeof teams.toJS !== 'function') return []
  return Object.values(teams.toJS()).map((team) => ({
    uid: team.uid,
    draft_order: team.draft_order
  }))
}

const format_window_full = (timestamp) =>
  dayjs.unix(timestamp).format('ddd MMM D, h:mm A')

const pad = (value) => String(value).padStart(2, '0')

// Counts down to the bid close, so the reader knows how long they have to act
// rather than having to subtract two clock times themselves.
const format_countdown = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining_seconds = seconds % 60

  if (days) return `${days}d ${pad(hours)}h ${pad(minutes)}m`
  if (hours) return `${hours}h ${pad(minutes)}m ${pad(remaining_seconds)}s`
  return `${minutes}m ${pad(remaining_seconds)}s`
}

export default function RestrictedFreeAgencySchedule({
  league,
  teams,
  team_id
}) {
  const [showAll, setShowAll] = useState(false)
  const now = useClockSeconds(1000)
  // The schedule only changes on a window boundary, so rebuild it by the minute
  // while the countdown below ticks every second
  const now_minute = Math.floor(now / 60)

  const info = useMemo(() => {
    if (!league?.restricted_free_agency_period_start || !teams || !teams.size) {
      return null
    }

    try {
      return get_restricted_free_agency_nomination_info({
        league,
        teams: teams_to_array(teams),
        current_timestamp: now_minute * 60
      })
    } catch (error) {
      console.error('Error building RFA nomination schedule:', error)
      return null
    }
  }, [league, teams, now_minute])

  if (!info || !info.schedule.length) return null

  const { window_hours, processing_lead_hours } = info

  // Filter to current and future windows only
  const future = info.schedule.filter((entry) => !entry.is_complete)
  const current = future.find((entry) => entry.is_current) || null
  const upcoming = future.filter((entry) => !entry.is_current)

  // Show current + first 2 upcoming; expand on toggle
  const condensed = upcoming.slice(0, 2)
  const hidden = upcoming.slice(2)

  return (
    <div className='restricted-free-agency-schedule'>
      <div className='rfa-schedule__title'>
        Restricted Free Agency Nomination Schedule
      </div>
      <div className='rfa-schedule__summary'>
        Nominations rotate in {window_hours}-hour windows. A team's nominee is
        announced when their window opens, and bids are processed{' '}
        {processing_lead_hours} hour
        {processing_lead_hours === 1 ? '' : 's'} before the next window.
      </div>

      {current && (
        <div className='rfa-schedule__current'>
          <div className='rfa-schedule__current-label'>Current window</div>
          <div className='rfa-schedule__current-body'>
            <div className='rfa-schedule__current-team'>
              <TeamName tid={current.nominating_team.uid} />
              {current.nominating_team.uid === team_id && (
                <span className='rfa-schedule__current-tag'>your team</span>
              )}
            </div>
            <div className='rfa-schedule__current-times'>
              <span className='rfa-schedule__current-time-label'>Announce</span>
              <span className='rfa-schedule__current-time'>
                {format_window_full(current.announce_at)}
              </span>
              <span className='rfa-schedule__current-time-label'>
                Bid close
              </span>
              <span className='rfa-schedule__current-time'>
                {format_window_full(current.bids_close_at)}
              </span>
              <span className='rfa-schedule__countdown'>
                {current.bids_close_at > now
                  ? format_countdown(current.bids_close_at - now)
                  : 'closed'}
              </span>
            </div>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className='rfa-schedule__future'>
          <div className='rfa-schedule__future-header'>
            <span className='rfa-schedule__future-title'>Upcoming</span>
            {hidden.length > 0 && (
              <button
                className='rfa-schedule__toggle'
                onClick={() => setShowAll((v) => !v)}
                type='button'
              >
                {showAll
                  ? `Collapse (${hidden.length} hidden)`
                  : `Show more (${upcoming.length} total)`}
              </button>
            )}
          </div>

          {(showAll ? upcoming : condensed).map((entry) => (
            <div
              key={entry.window_index}
              className={`rfa-schedule__future-row${
                entry.is_deadline_approaching
                  ? ' rfa-schedule__future-row--warning'
                  : ''
              }${
                entry.nominating_team.uid === team_id
                  ? ' rfa-schedule__future-row--mine'
                  : ''
              }`}
            >
              <div className='rfa-schedule__future-team'>
                <TeamName tid={entry.nominating_team.uid} />
                {entry.nominating_team.uid === team_id && (
                  <span className='rfa-schedule__future-tag'>your team</span>
                )}
              </div>
              <div className='rfa-schedule__future-time'>
                {format_window_full(entry.announce_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

RestrictedFreeAgencySchedule.propTypes = {
  league: PropTypes.object,
  teams: ImmutablePropTypes.map,
  team_id: PropTypes.number
}
