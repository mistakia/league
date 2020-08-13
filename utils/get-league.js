const db = require('../db')

module.exports = async (leagueId) => {
  const leagues = await db('leagues').where({ uid: leagueId })
  return leagues[0]
}
