import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import { get_restricted_free_agency_nomination_info } from '@libs-shared'
import TeamName from '@components/team-name'
import { teams_to_array, useClockSeconds, format_countdown } from '@core/utils'

import './restricted-free-agency-schedule.styl'

const format_window_full = (timestamp) =>
  dayjs.unix(timestamp).format('ddd MMM D, h:mm A')

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
          <div className='rfa-schedule__current-header'>
            <div className='rfa-schedule__current-heading'>
              <div className='rfa-schedule__current-label'>Current window</div>
              <div className='rfa-schedule__current-team'>
                <TeamName tid={current.nominating_team.uid} />
                {current.nominating_team.uid === team_id && (
                  <span className='rfa-schedule__current-tag'>your team</span>
                )}
              </div>
            </div>
            <div className='rfa-schedule__countdown'>
              <div className='rfa-schedule__countdown-value'>
                {current.bids_close_at > now
                  ? format_countdown(current.bids_close_at - now)
                  : 'Closed'}
              </div>
              <div className='rfa-schedule__countdown-label'>
                {current.bids_close_at > now
                  ? 'until bids close'
                  : 'bidding closed'}
              </div>
            </div>
          </div>
          <div className='rfa-schedule__current-times'>
            <div className='rfa-schedule__current-time-block'>
              <span className='rfa-schedule__current-time-label'>
                Announced
              </span>
              <span className='rfa-schedule__current-time'>
                {format_window_full(current.announce_at)}
              </span>
            </div>
            <div className='rfa-schedule__current-time-block'>
              <span className='rfa-schedule__current-time-label'>
                Bids close
              </span>
              <span className='rfa-schedule__current-time'>
                {format_window_full(current.bids_close_at)}
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
