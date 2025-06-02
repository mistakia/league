import React from 'react'
import dayjs from 'dayjs'
import { timeago } from './timeago'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { get_restricted_free_agency_nomination_info } from '@libs-shared'

// Helper to convert teams Immutable.Map to array
function teams_to_array(teams) {
  if (!teams || typeof teams.toJS !== 'function') return []
  return Object.values(teams.toJS()).map((team) => ({
    uid: team.uid,
    draft_order: team.draft_order
  }))
}

// Pure function: returns array of Alert elements
export function get_restricted_free_agency_notices({
  league,
  teams,
  team_id,
  transition_players,
  is_team_manager
}) {
  if (!league?.tran_start || !teams || teams.size === 0) return []

  const teams_array = teams_to_array(teams)
  let rfa_info = null
  try {
    rfa_info = get_restricted_free_agency_nomination_info({
      league,
      teams: teams_array
    })
  } catch (error) {
    console.error('Error in get_restricted_free_agency_nomination_info:', error)
    return []
  }

  if (!rfa_info?.upcoming_nominations) return []

  return rfa_info.upcoming_nominations
    .filter(
      (nomination) =>
        nomination.is_deadline_approaching &&
        nomination.nominating_team.uid === team_id
    )
    .filter((nomination) => {
      // Only show if this team hasn't nominated a player
      return !(
        transition_players &&
        transition_players.some(
          (player_map) =>
            player_map.get('tid') === nomination.nominating_team.uid &&
            player_map.get('transition_tag_nominated')
        )
      )
    })
    .map((nomination) => {
      const deadline = dayjs.unix(nomination.deadline_timestamp)
      if (is_team_manager) {
        const deadline_str = deadline.format('dddd [at] h:mm A')
        const time_left = timeago.format(deadline.toDate(), 'league_short')
        return (
          <Alert
            key={`rfa-nomination-deadline-${nomination.team_index}`}
            severity='warning'
          >
            <AlertTitle>RFA Nomination Deadline Approaching</AlertTitle>
            You need to designate a restricted free agent nominee by{' '}
            {deadline_str} ({time_left}). If you don't nominate a player by the
            deadline, you will lose your nomination opportunity.
          </Alert>
        )
      } else {
        return (
          <Alert
            key={`rfa-nomination-deadline-${nomination.team_index}`}
            severity='info'
          >
            <AlertTitle>RFA Nomination Pending</AlertTitle>
            This team needs to designate a restricted free agent nominee before{' '}
            {deadline.format('dddd [at] h:mm A')}.
          </Alert>
        )
      }
    })
}
