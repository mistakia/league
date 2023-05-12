import { getSchedule } from '#utils'
import { constants } from '#common'

export default async function (knex) {
  await knex('matchups').del()
  const teams = await knex('teams').where({
    lid: 1,
    year: constants.season.year
  })
  const schedule = getSchedule(teams)
  for (const [index, value] of schedule.entries()) {
    for (const matchup of value) {
      await knex('matchups').insert({
        hid: matchup.home.uid,
        aid: matchup.away.uid,
        lid: 1,
        week: index + 1,
        year: constants.season.year
      })
    }
  }
}
