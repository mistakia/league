import { current_season } from '#constants'
import generate_fantasy_league_schedule from './generate-fantasy-league-schedule.mjs'
import db from '#db'

export default async function ({ lid, random_seed }) {
  await db('matchups').del().where({ lid, season_year: current_season.year })
  const teams = await db('teams').where({
    lid,
    season_year: current_season.year
  })
  const schedule = generate_fantasy_league_schedule(teams, random_seed)
  const inserts = []
  for (const [index, value] of schedule.entries()) {
    for (const matchup of value) {
      inserts.push({
        home_team_id: matchup.home.uid,
        away_team_id: matchup.away.uid,
        lid,
        week: index + 1,
        season_year: current_season.year
      })
    }
  }

  if (inserts.length) {
    await db('matchups').insert(inserts)
  }

  return inserts
}
