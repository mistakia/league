import { get_playoff_seeding } from '#libs-shared'

/**
 * Whether the league is organized into Divisions, refusing the half-configured
 * case rather than guessing.
 *
 * `get_playoff_seeding` treats a null division as a Set key like any other, so
 * every undivided team collapses into ONE pseudo-division whose "winner" is
 * merely the best undivided team. Reporting that as a division title is wrong,
 * and with has_division_winner_berths set it would guarantee that phantom
 * winner a playoff berth. So a league either has Divisions or it does not --
 * the same disposition generate-fantasy-league-schedule's group_by_division
 * already takes on the same data.
 *
 * @param {object} params
 * @param {object[]} params.teams - Team rows carrying `division`
 * @returns {boolean} True when every team carries a division
 */
export const league_has_divisions = ({ teams }) => {
  const undivided = teams.filter(
    (team) => team.division === null || team.division === undefined
  )

  if (undivided.length === teams.length) return false

  if (undivided.length) {
    throw new Error(
      `${undivided.length} of ${teams.length} teams carry no division; a league either has Divisions or it does not`
    )
  }

  return true
}

/**
 * The division winners of a season whose regular season is over, or null when
 * the league has no divisions.
 *
 * @param {object} params
 * @param {object[]} params.teams - Team rows carrying `team_id` and `division`
 * @param {Record<number, object>} params.team_stats_by_tid - Final standings by team id
 * @param {object} params.playoff_format - The league's season playoff settings
 * @returns {Set<number> | null} Winning team ids, or null with no divisions
 */
export const resolve_decided_division_winners = ({
  teams,
  team_stats_by_tid,
  playoff_format
}) => {
  if (!league_has_divisions({ teams })) return null

  const { division_winner_tids } = get_playoff_seeding({
    teams: teams.map((team) => ({
      ...(team_stats_by_tid[team.team_id] || {}),
      tid: team.team_id,
      division: team.division
    })),
    ...playoff_format
  })

  return new Set(division_winner_tids)
}

/**
 * A decided season's division odds for one team: 1 or 0 where the league has
 * divisions, null where it does not.
 *
 * Null rather than 0 because the column is answering "did this team win its
 * division" for a league that has none, and a 0 is a claim the team lost one.
 *
 * @param {object} params
 * @param {Set<number> | null} params.division_winner_tids - From resolve_decided_division_winners
 * @param {number} params.team_id - Team to report on
 * @returns {number | null} Division odds
 */
export const decided_division_odds = ({ division_winner_tids, team_id }) => {
  if (division_winner_tids === null) return null
  return division_winner_tids.has(team_id) ? 1.0 : 0.0
}
