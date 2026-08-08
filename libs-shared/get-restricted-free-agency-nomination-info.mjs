import dayjs from 'dayjs'

import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'

import {
  get_restricted_free_agency_window_config,
  get_restricted_free_agency_window_start,
  get_restricted_free_agency_window_index,
  get_restricted_free_agency_processing_time,
  get_restricted_free_agency_nominating_team_index
} from './get-restricted-free-agency-window.mjs'

/**
 * Builds the full restricted free agency nomination schedule for a league:
 * which team nominates in each window, when that window opens and closes, and
 * which nominations are still ahead.
 *
 * Every window boundary is derived from the league's window configuration, so
 * this returns the same schedule the announce and processing scripts act on.
 *
 * @param {Object} params
 * @param {Object} params.league - League with restricted_free_agency_period_start and window settings
 * @param {Array} params.teams - Teams with uid and draft_order
 * @param {Number} [params.current_timestamp] - Current timestamp in seconds
 * @param {Number} [params.nomination_warning_hours=48] - Hours before a deadline to flag it as approaching
 * @returns {Object|null} Schedule, current window, and upcoming nominations
 */
const get_restricted_free_agency_nomination_info = ({
  league,
  teams,
  current_timestamp = Math.round(Date.now() / 1000),
  nomination_warning_hours = 48
}) => {
  if (
    !league ||
    !league.restricted_free_agency_period_start ||
    !league.restricted_free_agency_first_window_at ||
    !Array.isArray(teams) ||
    !teams.length ||
    league.num_teams !== teams.length
  ) {
    return null
  }

  const period_start = timestamptz_to_epoch(
    league.restricted_free_agency_period_start
  )
  // timestamptz, so parse rather than coerce — Number(Date) yields milliseconds
  const first_window_at = dayjs(
    league.restricted_free_agency_first_window_at
  ).unix()
  const period_end =
    timestamptz_to_epoch(league.restricted_free_agency_period_end) ||
    first_window_at + 30 * 24 * 60 * 60

  if (current_timestamp > period_end) {
    return null
  }

  // Highest draft_order nominates first
  const sorted_teams = [...teams].sort(
    (a, b) => (b.draft_order || 0) - (a.draft_order || 0)
  )

  const { window_hours, processing_lead_hours, bid_window_hours } =
    get_restricted_free_agency_window_config({ league })

  // Windows run from the anchor up to the last one opening inside the period
  const window_count =
    get_restricted_free_agency_window_index({
      league,
      timestamp: period_end
    }) + 1

  const current_window_index = get_restricted_free_agency_window_index({
    league,
    timestamp: current_timestamp
  })

  const warning_seconds = nomination_warning_hours * 60 * 60
  const schedule = []

  for (let window_index = 0; window_index < window_count; window_index++) {
    const team_index = get_restricted_free_agency_nominating_team_index({
      window_index,
      num_teams: sorted_teams.length
    })
    const announce_at = get_restricted_free_agency_window_start({
      league,
      window_index
    })
    const bids_close_at = get_restricted_free_agency_processing_time({
      league,
      window_index
    })

    schedule.push({
      window_index,
      team_index,
      nominating_team: sorted_teams[team_index],
      announce_at,
      bids_close_at,
      // The team on the clock must nominate before their window opens
      deadline_timestamp: announce_at,
      is_current: window_index === current_window_index,
      is_complete: window_index < current_window_index,
      is_deadline_approaching:
        announce_at > current_timestamp &&
        announce_at - current_timestamp <= warning_seconds
    })
  }

  const upcoming_nominations = schedule.filter(
    (entry) => entry.announce_at > current_timestamp
  )

  const current_window =
    schedule.find((entry) => entry.is_current) ||
    (current_window_index < 0 ? null : schedule[schedule.length - 1])

  return {
    window_hours,
    processing_lead_hours,
    bid_window_hours,
    period_start,
    period_end,
    current_window_index,
    current_window,
    schedule,
    upcoming_nominations,
    next_nomination: upcoming_nominations[0] || null
  }
}

export default get_restricted_free_agency_nomination_info
