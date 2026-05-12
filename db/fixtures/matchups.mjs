import { generate_fantasy_league_schedule } from '#libs-server'
import { current_season } from '#constants'

export default async function (knex) {
  await knex('matchups').del()
  const teams = await knex('teams').where({
    lid: 1,
    year: current_season.year
  })
  const schedule = generate_fantasy_league_schedule(teams)
  for (const [index, value] of schedule.entries()) {
    for (const matchup of value) {
      await knex('matchups').insert({
        hid: matchup.home.uid,
        aid: matchup.away.uid,
        lid: 1,
        week: index + 1,
        year: current_season.year
      })
    }
  }
}
