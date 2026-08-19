import get_restricted_free_agency_nomination_info from './get-restricted-free-agency-nomination-info.mjs'

/**
 * The next restricted free agency nomination window belonging to a specific
 * team — the entry the "Next nomination" card renders, and the signal the
 * league-home layout keys on when deciding whether that card sits beside the
 * schedule. Returns null when the team has no future window, including when
 * the whole schedule is empty or the period has ended.
 *
 * @param {object} params
 * @param {object} params.league - League with restricted_free_agency_period_start and window settings
 * @param {object[]} params.teams - Teams with team_id and draft_order
 * @param {Number} params.team_id - Team id whose next window to find
 * @param {Number} [params.current_timestamp] - Current timestamp in seconds
 * @returns {object|null} The team's next upcoming window entry, or null
 */
const get_restricted_free_agency_nomination_window = ({
  league,
  teams,
  team_id,
  current_timestamp = Math.round(Date.now() / 1000)
}) => {
  const info = get_restricted_free_agency_nomination_info({
    league,
    teams,
    current_timestamp
  })
  if (!info || !info.schedule.length) return null

  return (
    info.schedule.find(
      (entry) =>
        entry.nominating_team?.team_id === team_id &&
        entry.announce_at > current_timestamp
    ) || null
  )
}

export default get_restricted_free_agency_nomination_window
