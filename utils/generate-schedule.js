const { constants } = require('../common')
const getSchedule = require('./get-schedule')
const db = require('../db')

module.exports = async function ({ lid }) {
  await db('matchups').del().where({ lid, year: constants.season.year })
  const teams = await db('teams').where({ lid })
  const schedule = getSchedule(teams)
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
  await db('matchups').insert(inserts)

  return inserts
}
