import { constants } from '#libs-shared'
import generate_fantasy_league_schedule from './generate-fantasy-league-schedule.mjs'
import db from '#db'

export default async function ({ lid, random_seed }) {
  await db('matchups').del().where({ lid, year: constants.season.year })
  const teams = await db('teams').where({ lid, year: constants.season.year })
  const schedule = generate_fantasy_league_schedule(teams, random_seed)
  const inserts = []
  for (const [index, value] of schedule.entries()) {
    for (const matchup of value) {
      inserts.push({
        hid: matchup.home.uid,
        aid: matchup.away.uid,
        lid,
        week: index + 1,
        year: constants.season.year
      })
    }
  }

  if (inserts.length) {
    await db('matchups').insert(inserts)
  }

  return inserts
}
