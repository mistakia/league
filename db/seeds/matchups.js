const { getSchedule } = require('../../utils')
const { constants } = require('../../common')

module.exports = async function (knex) {
  await knex('matchups').del()
  const teams = await knex('teams').where({ lid: 1 })
  const schedule = getSchedule(teams)
  for (const [index, value] of schedule.entries()) {
    for (const matchup of value) {
      await knex('matchups').insert({
        hid: matchup.home.uid,
        aid: matchup.away.uid,
        lid: 1,
        week: index + 1,
        year: constants.year
      })
    }
  }
}
