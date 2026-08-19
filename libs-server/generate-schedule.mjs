import { current_season } from '#constants'
import generate_fantasy_league_schedule from './generate-fantasy-league-schedule.mjs'
import db from '#db'

/**
 * Write a league's Qualifying Season schedule from a drawn team order.
 *
 * `team_order` is the published result of the league's verifiable draw -- team
 * uids in the order the draw produced. It is required rather than optional
 * because the schedule is fully determined by it: an unordered call would
 * produce a schedule nobody can audit, which is the state this replaced.
 *
 * The delete runs only after the whole schedule has been built, so a team order
 * that fails validation leaves the existing matchups untouched rather than
 * emptying the table.
 *
 * @param {object} params
 * @param {number} params.lid
 * @param {number[]} params.team_order - every team uid in the league, once each
 */
export default async function ({ lid, team_order }) {
  const teams = await db('teams').where({
    lid,
    season_year: current_season.year
  })

  if (!teams.length) {
    throw new Error(`no teams for league ${lid} in ${current_season.year}`)
  }

  if (!Array.isArray(team_order) || !team_order.length) {
    throw new Error(
      'team_order is required -- pass the drawn order of team ids'
    )
  }

  const teams_by_team_id = new Map(teams.map((team) => [team.team_id, team]))
  const seen = new Set()
  const ordered_teams = []

  for (const team_id of team_order) {
    const team = teams_by_team_id.get(team_id)
    if (!team) {
      throw new Error(
        `team_order names team ${team_id}, which is not in league ${lid}`
      )
    }
    if (seen.has(team_id)) {
      throw new Error(`team_order names team ${team_id} more than once`)
    }
    seen.add(team_id)
    ordered_teams.push(team)
  }

  const missing = teams.filter((team) => !seen.has(team.team_id))
  if (missing.length) {
    throw new Error(
      `team_order omits ${missing.length} team(s): ${missing.map((t) => t.team_id).join(', ')}`
    )
  }

  const schedule = generate_fantasy_league_schedule(ordered_teams)

  const inserts = []
  for (const [index, week] of schedule.entries()) {
    for (const matchup of week) {
      inserts.push({
        home_team_id: matchup.home.team_id,
        away_team_id: matchup.away.team_id,
        lid,
        week: index + 1,
        season_year: current_season.year
      })
    }
  }

  await db('matchups').del().where({ lid, season_year: current_season.year })

  if (inserts.length) {
    await db('matchups').insert(inserts)
  }

  return inserts
}
