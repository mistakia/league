import React, { useMemo } from 'react'
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

const format_window = (timestamp) =>
  dayjs.unix(timestamp).format('ddd MMM D, h:mm A')

export default function RestrictedFreeAgencySchedule({
  league,
  teams,
  team_id
}) {
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

  const { window_hours, processing_lead_hours, next_nomination } = info

  return (
    <div className='restricted-free-agency-schedule'>
      <div className='rfa-schedule__title'>
        Restricted Free Agency Nomination Schedule
      </div>
      <div className='rfa-schedule__summary'>
        Nominations rotate in {window_hours}-hour windows. A team's nominee is
        announced when their window opens, and bids on that nominee are
        processed {processing_lead_hours} hour
        {processing_lead_hours === 1 ? '' : 's'} before the next window opens.
      </div>

      {next_nomination && (
        <div className='rfa-schedule__next'>
          <span className='rfa-schedule__next-label'>Next nomination</span>
          <TeamName tid={next_nomination.nominating_team.uid} />
          <span className='rfa-schedule__next-time'>
            {format_window(next_nomination.announce_at)}
          </span>
        </div>
      )}

      <div className='rfa-schedule__table'>
        <div className='rfa-schedule__row rfa-schedule__row--header'>
          <div className='rfa-schedule__cell rfa-schedule__cell--team'>
            Team
          </div>
          <div className='rfa-schedule__cell'>Window opens</div>
          <div className='rfa-schedule__cell'>Bids processed</div>
        </div>
        {info.schedule.map((entry) => {
          const classes = ['rfa-schedule__row']
          if (entry.is_current) classes.push('rfa-schedule__row--current')
          if (entry.is_complete) classes.push('rfa-schedule__row--complete')
          if (entry.nominating_team.uid === team_id) {
            classes.push('rfa-schedule__row--mine')
          }

          return (
            <div key={entry.window_index} className={classes.join(' ')}>
              <div className='rfa-schedule__cell rfa-schedule__cell--team'>
                <TeamName tid={entry.nominating_team.uid} />
              </div>
              <div className='rfa-schedule__cell'>
                {format_window(entry.announce_at)}
              </div>
              <div className='rfa-schedule__cell'>
                {format_window(entry.bids_close_at)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

RestrictedFreeAgencySchedule.propTypes = {
  league: PropTypes.object,
  teams: ImmutablePropTypes.map,
  team_id: PropTypes.number
}
