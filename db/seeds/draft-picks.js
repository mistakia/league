const { constants } = require('../../common')

module.exports = async function (knex) {
  const teams = await knex('teams').where({ lid: 1 })
  const leagues = await knex('leagues').where({ uid: 1 })
  const league = leagues[0]
  await knex('draft').del()
  for (let i = 1; i <= (3 * league.nteams); i++) {
    const idx = i % league.nteams
    const team = teams[idx]
    await knex('draft').insert({
      tid: team.uid,
      otid: team.uid,
      lid: league.uid,
      pick: i,
      round: Math.ceil(i / league.nteams),
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
        year: (constants.season.year + 1)
      })
    }
  }
}
