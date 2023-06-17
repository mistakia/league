import { constants } from '#libs-shared'
import { getLeague } from '#libs-server'

export default async function (knex) {
  const lid = 1
  const teams = await knex('teams').where({ lid, year: constants.season.year })
  const league = await getLeague({ lid })
  await knex('draft').del()
  for (let i = 0; i < 3 * league.num_teams; i++) {
    const idx = i % league.num_teams
    const team = teams[idx]
    await knex('draft').insert({
      tid: team.uid,
      otid: team.uid,
      lid: league.uid,
      pick: i + 1,
      round: Math.ceil((i + 1) / league.num_teams),
      year: constants.season.year
    })
  }

  for (const team of teams) {
    for (let i = 1; i < 4; i++) {
      await knex('draft').insert({
        tid: team.uid,
        otid: team.uid,
        lid: league.uid,
        round: i,
        year: constants.season.year + 1
      })
    }
  }
}
