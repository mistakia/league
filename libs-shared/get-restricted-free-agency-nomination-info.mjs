import dayjs from 'dayjs'

import * as constants from './constants.mjs'

/**
 * Determines which teams should nominate restricted free agents based on league start date and draft order
 * Also calculates the nomination deadlines and whether they're approaching soon
 *
 * @param {Object} params - Parameters
 * @param {Object} params.league - League object with tran_start timestamp and restricted_free_agency_announcement_hour
 * @param {Array} params.teams - Teams array with uid and draft_order properties
 * @param {Number} [params.current_timestamp] - Current timestamp in seconds (defaults to now)
 * @param {Number} [params.nomination_warning_hours=48] - Hours before deadline to trigger warning
 * @returns {Object} Object containing nomination info for upcoming teams
 */
const get_restricted_free_agency_nomination_info = ({
  league,
  teams,
  current_timestamp = Math.round(Date.now() / 1000),
  nomination_warning_hours = 48
}) => {
  if (
    !league ||
    !league.tran_start ||
    !Array.isArray(teams) ||
    !teams.length ||
    league.num_teams !== teams.length
  ) {
    console.log('Returning null due to missing required params')
    return null
  }

  // Set default announcement hour if not provided (default to constants value or 23)
  const announcement_hour =
    league.restricted_free_agency_announcement_hour !== undefined
      ? league.restricted_free_agency_announcement_hour
      : constants.league_default_restricted_free_agency_announcement_hour

  // Calculate a default tran_end if it doesn't exist (30 days after tran_start)
  const tran_end = league.tran_end || league.tran_start + 30 * 24 * 60 * 60

  // Check if we are in RFA period
  if (current_timestamp < league.tran_start || current_timestamp > tran_end) {
    return null
  }

  // Sort teams by draft_order desc (highest to lowest)
  // Add a fallback if draft_order doesn't exist
  const sorted_teams = [...teams].sort((a, b) => {
    const a_draft_order = a.draft_order !== undefined ? a.draft_order : 0
    const b_draft_order = b.draft_order !== undefined ? b.draft_order : 0
    return b_draft_order - a_draft_order
  })

  const current_date = dayjs.unix(current_timestamp)
  const tran_start_date = dayjs.unix(league.tran_start)

  // Calculate days since start (may be negative if before start)
  const days_since_start = current_date.diff(tran_start_date, 'day')

  // Calculate which teams should be nominating based on day number
  const upcoming_nominations = []

  // Look at current and next few days to see which teams will be nominating
  // For each team, calculate their nomination day and deadline
  sorted_teams.forEach((team, index) => {
    // Calculate which day this team would nominate (based on their position)
    const team_nomination_day = index

    // If we're past the first round, we need to adjust by team count
    const current_round = Math.floor(days_since_start / sorted_teams.length)
    const day_in_round = days_since_start % sorted_teams.length

    // Days until this team's turn (could be negative if already passed)
    let days_until_nomination = team_nomination_day - day_in_round

    // If days is negative, it means we're past this team in the current round
    // So we need to wait until the next round
    if (days_until_nomination < 0 && current_round >= 0) {
      days_until_nomination += sorted_teams.length
    }

    // Calculate nomination date (the day they should nominate)
    const nomination_date = current_date.add(days_until_nomination, 'day')

    // Special handling for hour 24 (midnight at end of day)
    // If announcement_hour is 24, we need to set it to hour 0 of the next day
    let deadline_date
    let deadline_hour

    if (announcement_hour === 24) {
      // For hour 24, we use hour 0 of the next day
      deadline_date = nomination_date.add(1, 'day')
      deadline_hour = 0
    } else {
      deadline_date = nomination_date
      deadline_hour = announcement_hour
    }

    const deadline_timestamp = deadline_date
      .hour(deadline_hour)
      .minute(0)
      .second(0)
      .unix()

    // Check if deadline is within warning period
    const warning_seconds = nomination_warning_hours * 60 * 60
    const is_deadline_approaching =
      deadline_timestamp - current_timestamp <= warning_seconds

    // Include all teams with approaching deadlines, plus the next team that will nominate
    // even if their deadline isn't immediately approaching
    const should_include = is_deadline_approaching || days_until_nomination <= 2

    if (should_include) {
      upcoming_nominations.push({
        nominating_team: team,
        deadline_timestamp,
        is_deadline_approaching,
        days_until_nomination,
        team_index: index
      })
    }
  })

  // Sort by days until nomination
  upcoming_nominations.sort(
    (a, b) => a.days_until_nomination - b.days_until_nomination
  )

  return {
    upcoming_nominations,
    days_since_start
  }
}

export default get_restricted_free_agency_nomination_info
