import React, { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import { get_restricted_free_agency_nomination_info } from '@libs-shared'
import TeamName from '@components/team-name'

import './restricted-free-agency-schedule.styl'

function teams_to_array(teams) {
  if (!teams || typeof teams.toJS !== 'function') return []
  return Object.values(teams.toJS()).map((team) => ({
    uid: team.uid,
    draft_order: team.draft_order
  }))
}

const format_window_short = (timestamp) =>
  dayjs.unix(timestamp).format('M/D hA')

const format_window_full = (timestamp) =>
  dayjs.unix(timestamp).format('ddd MMM D, h:mm A')

export default function RestrictedFreeAgencySchedule({
  league,
  teams,
  team_id
}) {
  const [showAll, setShowAll] = useState(false)

  const info = useMemo(() => {
    if (!league?.restricted_free_agency_period_start || !teams || !teams.size) {
      return null
    }

    try {
      return get_restricted_free_agency_nomination_info({
        league,
        teams: teams_to_array(teams)
      })
    } catch (error) {
      console.error('Error building RFA nomination schedule:', error)
      return null
    }
  }, [league, teams])

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
                {format_window_short(current.announce_at)}
              </span>
              <span className='rfa-schedule__current-time-label'>
                Bid close
              </span>
              <span className='rfa-schedule__current-time'>
                {format_window_short(current.bids_close_at)}
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
